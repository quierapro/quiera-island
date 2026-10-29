//! The launcher's file index: every file and folder of the fixed drives,
//! walked in the background and searched in memory, so results come as you
//! type. System folders, caches, build outputs and engine installs are left
//! out: they would bury what people look for (on a game developer's PC, an
//! Unreal Engine install alone is half a million files).
//!
//! Names are packed in one string per index, not one allocation each: an
//! entry costs about 50 bytes.
//!
//! The index is rebuilt every so often; a file made since then shows up at
//! the next rebuild.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{LazyLock, RwLock};
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::{launcher, platform, protocol};

/// Beyond this, the walk stops: the index stays light.
const MAX_ENTRIES: usize = 800_000;
/// Rebuilt when the launcher opens on an index older than this.
const STALE_AFTER: Duration = Duration::from_secs(10 * 60);
/// The first walk waits a little: Quiera's own start comes first.
const FIRST_WALK_DELAY: Duration = Duration::from_secs(5);

/// Folders never walked, by name (any depth).
const SKIPPED: &[&str] = &[
    "node_modules",
    "__pycache__",
    "site-packages",
    "$recycle.bin",
    "system volume information",
    "appdata",
    "steamapps",
    "windows.old",
    "$windows.~bt",
    "$windows.~ws",
    "$winreagent",
];
/// Folders never walked at a drive's root.
const SKIPPED_AT_ROOT: &[&str] = &[
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
    "recovery",
    "perflogs",
    "msocache",
    "xboxgames",
    "adobetemp",
    "temp",
    "tmp",
];

/// A name inside the index's packed strings.
#[derive(Clone, Copy)]
struct Span {
    start: u32,
    len: u32,
}

struct Node {
    name: Span,
    /// Lowercase name, what queries are matched against.
    lower: Span,
    /// Index of the folder it is in; `u32::MAX` for a drive.
    parent: u32,
    /// Last change, in seconds since 1970 (0 when unknown).
    modified: u32,
    dir: bool,
}

#[derive(Default)]
struct Index {
    nodes: Vec<Node>,
    names: String,
    lowers: String,
    built: Option<Instant>,
}

fn push(text: &mut String, part: &str) -> Span {
    let start = text.len() as u32;
    text.push_str(part);
    Span {
        start,
        len: part.len() as u32,
    }
}

fn slice(text: &str, span: Span) -> &str {
    &text[span.start as usize..(span.start + span.len) as usize]
}

impl Index {
    fn add(&mut self, name: &str, parent: u32, dir: bool, modified: u32) -> u32 {
        let name_span = push(&mut self.names, name);
        let lower = push(&mut self.lowers, &fold(name));
        self.nodes.push(Node {
            name: name_span,
            lower,
            parent,
            modified,
            dir,
        });
        (self.nodes.len() - 1) as u32
    }

    fn name(&self, node: &Node) -> &str {
        slice(&self.names, node.name)
    }

    fn path(&self, id: u32) -> Option<PathBuf> {
        let mut parts = Vec::new();
        let mut at = id;
        while at != u32::MAX {
            let node = self.nodes.get(at as usize)?;
            parts.push(self.name(node));
            at = node.parent;
        }
        let mut path = PathBuf::new();
        for part in parts.iter().rev() {
            path.push(part);
        }
        Some(path)
    }
}

static INDEX: LazyLock<RwLock<Index>> = LazyLock::new(RwLock::default);
static WALKING: AtomicBool = AtomicBool::new(false);
/// Bumped at each rebuild: a result from an older index opens nothing.
static GENERATION: AtomicU32 = AtomicU32::new(0);

/// Whether a folder is left out of the walk, by its name alone.
pub fn skipped(name: &str, at_root: bool) -> bool {
    let lower = name.to_lowercase();
    lower.starts_with('.')
        || SKIPPED.contains(&lower.as_str())
        || (at_root && SKIPPED_AT_ROOT.contains(&lower.as_str()))
}

/// Whether a folder is generated rather than made by hand, by what it holds:
/// a cache (`CACHEDIR.TAG`, which Rust's `target` folders carry), a Python
/// environment (`pyvenv.cfg`), a Unity project's `Library` cache, or an
/// Unreal Engine install.
pub fn generated(dir: &Path, name: &str) -> bool {
    dir.join("CACHEDIR.TAG").exists()
        || dir.join("pyvenv.cfg").exists()
        || (name.eq_ignore_ascii_case("library")
            && dir
                .parent()
                .is_some_and(|p| p.join("ProjectSettings").is_dir()))
        || (name.eq_ignore_ascii_case("engine") && dir.join("Build").join("Build.version").exists())
}

/// When an entry last changed (read with the folder listing on Windows: no
/// extra disk access).
fn modified(entry: &std::fs::DirEntry) -> u32 {
    entry
        .metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_secs().min(u64::from(u32::MAX)) as u32)
}

/// What a query can ask for besides a name.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Image,
    Video,
    Audio,
    Document,
}

/// A file's kind, from its extension.
pub fn kind_of(name: &str) -> Option<Kind> {
    let ext = name.rsplit_once('.')?.1;
    match ext {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "bmp" | "tif" | "tiff" | "svg"
        | "avif" | "psd" => Some(Kind::Image),
        "mp4" | "mov" | "mkv" | "avi" | "webm" | "wmv" | "m4v" | "flv" | "mts" => Some(Kind::Video),
        "mp3" | "wav" | "flac" | "ogg" | "m4a" | "aac" | "wma" | "opus" => Some(Kind::Audio),
        "pdf" | "doc" | "docx" | "odt" | "txt" | "md" | "rtf" | "xls" | "xlsx" | "ods" | "ppt"
        | "pptx" | "odp" | "csv" => Some(Kind::Document),
        _ => None,
    }
}

/// The kind a (folded) word asks for: "images", "photo", "vidéos", "musique"…
pub fn kind_word(word: &str) -> Option<Kind> {
    match word {
        "image" | "images" | "img" | "photo" | "photos" | "capture" | "captures" | "screenshot"
        | "screenshots" => Some(Kind::Image),
        "video" | "videos" | "film" | "films" | "clip" | "clips" => Some(Kind::Video),
        "musique" | "musiques" | "audio" | "son" | "sons" | "music" => Some(Kind::Audio),
        "document" | "documents" | "doc" | "docs" => Some(Kind::Document),
        _ => None,
    }
}

/// Splits a folded query into the kind it asks for and the words to match.
pub fn parse_query(query: &str) -> (Option<Kind>, Vec<&str>) {
    let mut kind = None;
    let mut words = Vec::new();
    for word in query.split_whitespace() {
        match kind_word(word) {
            Some(k) if kind.is_none() => kind = Some(k),
            _ => words.push(word),
        }
    }
    (kind, words)
}

/// Walks `roots` into a fresh index.
fn walk(roots: &[PathBuf]) -> Index {
    let mut index = Index::default();
    // (folder on disk, its node, whether it is a drive)
    let mut stack: Vec<(PathBuf, u32, bool)> = Vec::new();
    for root in roots {
        let id = index.add(&root.to_string_lossy(), u32::MAX, true, 0);
        stack.push((root.clone(), id, true));
    }
    while let Some((dir, id, at_root)) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            if index.nodes.len() >= MAX_ENTRIES {
                return index;
            }
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            // Links and junctions could loop or repeat whole trees.
            if kind.is_symlink() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            if kind.is_dir() {
                let path = entry.path();
                if skipped(&name, at_root) || generated(&path, &name) {
                    continue;
                }
                let child = index.add(&name, id, true, modified(&entry));
                stack.push((path, child, false));
            } else {
                index.add(&name, id, false, modified(&entry));
            }
        }
    }
    index
}

/// Rebuilds the index in the background, unless a walk is already running.
pub fn refresh() {
    if WALKING.swap(true, Ordering::Relaxed) {
        return;
    }
    let spawned = std::thread::Builder::new()
        .name("quiera-files".into())
        .spawn(|| {
            // Nobody waits on it: it gives way to everything else.
            platform::lower_thread_priority();
            let started = Instant::now();
            let mut index = walk(&platform::fixed_drives());
            index.built = Some(Instant::now());
            log::info!(
                "file index: {} entries ({} MB of names) in {:.1} s",
                index.nodes.len(),
                (index.names.len() + index.lowers.len()) / 1_000_000,
                started.elapsed().as_secs_f32()
            );
            *INDEX.write().unwrap_or_else(|e| e.into_inner()) = index;
            GENERATION.fetch_add(1, Ordering::Relaxed);
            WALKING.store(false, Ordering::Relaxed);
        });
    if spawned.is_err() {
        WALKING.store(false, Ordering::Relaxed);
    }
}

/// Builds the index a little after start.
pub fn start() {
    std::thread::spawn(|| {
        std::thread::sleep(FIRST_WALK_DELAY);
        if crate::settings::get().launcher.index_files {
            refresh();
        }
    });
}

/// Drops the index (file search turned off): its memory goes back.
pub fn clear() {
    *INDEX.write().unwrap_or_else(|e| e.into_inner()) = Index::default();
    GENERATION.fetch_add(1, Ordering::Relaxed);
}

/// Rebuilds the index if it is old (called when the launcher opens).
pub fn refresh_if_stale() {
    if !crate::settings::get().launcher.index_files {
        return;
    }
    let stale = INDEX
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .built
        .is_none_or(|at| at.elapsed() > STALE_AFTER);
    if stale {
        refresh();
    }
}

/// Lowercase and without accents, so "ecrire", "écrire" and "Écrire" read
/// the same, whether the accent is part of the letter or a separate sign
/// after it (how macOS and some downloads store names).
pub fn fold(text: &str) -> String {
    text.chars()
        .flat_map(char::to_lowercase)
        .filter_map(|c| match c {
            '\u{300}'..='\u{36f}' => None,
            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' | 'ā' => Some('a'),
            'ç' | 'ć' | 'č' => Some('c'),
            'è' | 'é' | 'ê' | 'ë' | 'ē' | 'ę' | 'ě' => Some('e'),
            'ì' | 'í' | 'î' | 'ï' | 'ī' => Some('i'),
            'ñ' | 'ń' | 'ň' => Some('n'),
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' | 'ø' | 'ō' => Some('o'),
            'ù' | 'ú' | 'û' | 'ü' | 'ū' | 'ů' => Some('u'),
            'ý' | 'ÿ' => Some('y'),
            'š' | 'ś' => Some('s'),
            'ž' | 'ź' | 'ż' => Some('z'),
            c => Some(c),
        })
        .collect()
}

/// How well a folded name answers folded query words, 0 for not at
/// all: every word must be in it; starting the name or a word scores more.
pub fn score(name: &str, words: &[&str]) -> u32 {
    let mut total = 0;
    for word in words {
        let Some(at) = name.find(word) else { return 0 };
        let word_start = at == 0
            || name[..at]
                .chars()
                .next_back()
                .is_some_and(|c| !c.is_alphanumeric());
        total += if at == 0 {
            30
        } else if word_start {
            20
        } else {
            10
        };
    }
    // Shorter names match more of what was typed.
    total * 100 / (name.chars().count() as u32 + 10)
}

/// Mirrors `FileHit` in `src/ipc/launcher.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct FileHit {
    /// The node's index, valid for this index only.
    pub id: u32,
    /// Which index it comes from.
    pub generation: u32,
    /// Its icon (the shell's, a preview for images).
    pub icon: String,
    pub name: String,
    /// The folder it is in, as people read it.
    pub folder: String,
    pub dir: bool,
    /// Last change, in seconds since 1970 (0 when unknown).
    pub modified: u32,
}

/// The best matches for `query`, best first.
pub fn search(query: &str, limit: usize) -> Vec<FileHit> {
    if !crate::settings::get().launcher.index_files {
        return Vec::new();
    }
    let query = fold(query.trim());
    if query.chars().count() < 2 {
        return Vec::new();
    }
    // "images" alone: the latest images; "vidéo montage": videos named so.
    let (kind, words) = parse_query(&query);
    if kind.is_none() && words.is_empty() {
        return Vec::new();
    }
    let index = INDEX.read().unwrap_or_else(|e| e.into_inner());
    let generation = GENERATION.load(Ordering::Relaxed);
    // (score, modified, id): the best first, the most recent among equals.
    let mut best: Vec<(u32, u32, u32)> = index
        .nodes
        .iter()
        .enumerate()
        .filter(|(_, n)| n.parent != u32::MAX)
        .filter_map(|(i, n)| {
            let lower = slice(&index.lowers, n.lower);
            if let Some(kind) = kind
                && (n.dir || kind_of(lower) != Some(kind))
            {
                return None;
            }
            let s = if words.is_empty() {
                1
            } else {
                score(lower, &words)
            };
            (s > 0).then_some((s + u32::from(n.dir) * 5, n.modified, i as u32))
        })
        .collect();
    best.sort_unstable_by_key(|&(s, modified, _)| std::cmp::Reverse((s, modified)));
    best.truncate(limit);
    best.into_iter()
        .filter_map(|(_, _, id)| {
            let node = &index.nodes[id as usize];
            let folder = index.path(node.parent)?;
            Some(FileHit {
                id,
                generation,
                icon: protocol::url(launcher::ICON_SCHEME, &format!("f{generation}-{id}")),
                name: index.name(node).to_owned(),
                folder: folder.to_string_lossy().into_owned(),
                dir: node.dir,
                modified: node.modified,
            })
        })
        .collect()
}

/// The full path of a search result, if its index is still the current one.
pub fn path_of(id: u32, generation: u32) -> Option<PathBuf> {
    if generation != GENERATION.load(Ordering::Relaxed) {
        return None;
    }
    INDEX.read().unwrap_or_else(|e| e.into_inner()).path(id)
}

/// Whether the index has been built at least once.
pub fn ready() -> bool {
    INDEX
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .built
        .is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn leaves_system_build_and_hidden_folders_out() {
        assert!(skipped("node_modules", false));
        assert!(skipped(".git", false));
        assert!(skipped("AppData", false));
        assert!(skipped("Windows", true));
        assert!(!skipped("Windows", false), "only at a drive's root");
        assert!(!skipped("Documents", true));
        assert!(!skipped("Projets", false));
    }

    #[test]
    fn reads_kinds_from_names_and_queries() {
        assert_eq!(kind_of("capture.png"), Some(Kind::Image));
        assert_eq!(kind_of("rush.mp4"), Some(Kind::Video));
        assert_eq!(kind_of("notes"), None);
        assert_eq!(
            parse_query(&fold("Vidéos montage")),
            (Some(Kind::Video), vec!["montage"])
        );
        assert_eq!(parse_query("images"), (Some(Kind::Image), vec![]));
        assert_eq!(parse_query("rapport"), (None, vec!["rapport"]));
    }

    #[test]
    fn a_kind_alone_gives_the_latest_files_of_that_kind() {
        let mut index = Index::default();
        let root = index.add("C:\\", u32::MAX, true, 0);
        index.add("vieille.png", root, false, 100);
        index.add("recente.jpg", root, false, 900);
        index.add("rush montage.mp4", root, false, 500);
        index.add("notes.txt", root, false, 999);
        index.built = Some(Instant::now());
        *INDEX.write().unwrap() = index;
        let names = |q: &str| search(q, 7).into_iter().map(|h| h.name).collect::<Vec<_>>();
        assert_eq!(names("images"), ["recente.jpg", "vieille.png"]);
        assert_eq!(names("vidéo montage"), ["rush montage.mp4"]);
        assert_eq!(names("photos montage"), Vec::<String>::new());
    }

    #[test]
    fn reads_names_without_case_or_accents() {
        assert_eq!(fold("Écrire Cours.MP4"), "ecrire cours.mp4");
        // "e" followed by a combining acute accent, as macOS stores it.
        assert_eq!(fold("e\u{301}crire"), "ecrire");
        assert_eq!(fold("Noël à Paris"), "noel a paris");
    }

    #[test]
    fn scores_starts_words_and_short_names_higher() {
        let words = ["rapport"];
        assert!(score("rapport.pdf", &words) > score("mon-rapport.pdf", &words));
        assert!(score("mon-rapport.pdf", &words) > score("monrapport.pdf", &words));
        assert!(score("rapport.pdf", &words) > score("rapport-final-v2-definitif.pdf", &words));
        assert_eq!(score("photo.png", &words), 0);
        assert!(score("rapport stage 2026.docx", &["stage", "rapport"]) > 0);
        assert_eq!(score("rapport.docx", &["stage", "rapport"]), 0);
    }

    fn temp_tree(tag: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("quiera-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        root
    }

    fn names(index: &Index) -> Vec<&str> {
        index.nodes.iter().map(|n| index.name(n)).collect()
    }

    #[test]
    fn walks_a_tree_and_rebuilds_paths() {
        let root = temp_tree("walk");
        std::fs::create_dir_all(root.join("Projets/site/node_modules/lib")).unwrap();
        std::fs::write(root.join("Projets/site/index.html"), "").unwrap();
        std::fs::write(root.join("Projets/site/node_modules/lib/x.js"), "").unwrap();

        let index = walk(std::slice::from_ref(&root));
        assert!(names(&index).contains(&"index.html"));
        assert!(!names(&index).contains(&"x.js"), "node_modules is skipped");
        let html = names(&index)
            .iter()
            .position(|n| *n == "index.html")
            .unwrap();
        assert_eq!(
            index.path(html as u32).unwrap(),
            root.join("Projets").join("site").join("index.html")
        );
        std::fs::remove_dir_all(&root).unwrap();
    }

    /// The real drives: how big the index is and how fast it answers.
    /// `cargo test real_drives -- --ignored --nocapture`
    #[test]
    #[ignore = "walks the whole machine"]
    fn real_drives() {
        let started = Instant::now();
        let index = walk(&platform::fixed_drives());
        let walked = started.elapsed();
        let bytes = index.nodes.len() * std::mem::size_of::<Node>()
            + index.names.len()
            + index.lowers.len();
        *INDEX.write().unwrap() = index;
        let started = Instant::now();
        let hits = search("rapport", 7);
        let searched = started.elapsed();
        println!(
            "{} entries, {} MB, walked in {:.1} s, searched in {} ms ({} hits)",
            INDEX.read().unwrap().nodes.len(),
            bytes / 1_000_000,
            walked.as_secs_f32(),
            searched.as_millis(),
            hits.len()
        );
    }

    /// Images and videos on the real drives: are they indexed and found?
    /// `cargo test real_media -- --ignored --nocapture`
    #[test]
    #[ignore = "walks the whole machine"]
    fn real_media() {
        let index = walk(&platform::fixed_drives());
        let ext = |n: &str| n.rsplit('.').next().unwrap_or("").to_lowercase();
        let images = ["jpg", "jpeg", "png", "gif", "webp", "heic"];
        let videos = ["mp4", "mov", "mkv", "avi", "webm"];
        let mut found_images = Vec::new();
        let mut found_videos = Vec::new();
        for (i, n) in index.nodes.iter().enumerate() {
            let e = ext(index.name(n));
            if !n.dir && images.contains(&e.as_str()) {
                found_images.push(i as u32);
            } else if !n.dir && videos.contains(&e.as_str()) {
                found_videos.push(i as u32);
            }
        }
        println!(
            "images: {}, videos: {}",
            found_images.len(),
            found_videos.len()
        );
        for list in [&found_images, &found_videos] {
            for id in list.iter().rev().step_by((list.len() / 3).max(1)).take(3) {
                println!("  {}", index.path(*id).unwrap().display());
            }
        }
        // Each sample searched by its name must come back.
        let samples: Vec<String> = found_images
            .iter()
            .chain(&found_videos)
            .step_by(997)
            .take(5)
            .map(|&id| index.name(&index.nodes[id as usize]).to_owned())
            .collect();
        *INDEX.write().unwrap() = index;
        for name in samples {
            let stem = name
                .rsplit_once('.')
                .map_or(name.as_str(), |(s, _)| s)
                .to_owned();
            let hits = search(&stem, 7);
            println!(
                "search {stem:?}: {}",
                if hits.iter().any(|h| h.name == name) {
                    "found"
                } else {
                    "MISSING"
                }
            );
            if !hits.iter().any(|h| h.name == name) {
                println!("  wanted {name:?}, got:");
                for h in &hits {
                    println!("    {:?} in {}", h.name, h.folder);
                }
            }
        }
        for query in ["images", "videos"] {
            let started = Instant::now();
            let hits = search(query, 3);
            println!(
                "{query:?} in {} ms: {:?}",
                started.elapsed().as_millis(),
                hits.iter().map(|h| &h.name).collect::<Vec<_>>()
            );
        }
    }

    #[test]
    fn leaves_generated_folders_out_but_keeps_the_projects() {
        let root = temp_tree("generated");
        // A Rust build folder, a Python environment, a Unity cache, an Unreal install.
        std::fs::create_dir_all(root.join("app/target/debug")).unwrap();
        std::fs::write(root.join("app/target/CACHEDIR.TAG"), "").unwrap();
        std::fs::write(root.join("app/target/debug/app.exe"), "").unwrap();
        std::fs::write(root.join("app/main.rs"), "").unwrap();
        std::fs::create_dir_all(root.join("py/venv")).unwrap();
        std::fs::write(root.join("py/venv/pyvenv.cfg"), "").unwrap();
        std::fs::create_dir_all(root.join("jeu/Library/Artifacts")).unwrap();
        std::fs::create_dir_all(root.join("jeu/ProjectSettings")).unwrap();
        std::fs::create_dir_all(root.join("jeu/Assets")).unwrap();
        std::fs::write(root.join("jeu/Assets/Player.cs"), "").unwrap();
        std::fs::create_dir_all(root.join("UE_5.8/Engine/Build")).unwrap();
        std::fs::write(root.join("UE_5.8/Engine/Build/Build.version"), "").unwrap();
        // A Library folder of one's own stays.
        std::fs::create_dir_all(root.join("Musique/Library")).unwrap();

        let index = walk(std::slice::from_ref(&root));
        let names = names(&index);
        for kept in ["main.rs", "Player.cs", "Musique", "Library", "UE_5.8"] {
            assert!(names.contains(&kept), "{kept} is kept");
        }
        for left in ["target", "venv", "Artifacts", "Engine", "app.exe"] {
            assert!(!names.contains(&left), "{left} is left out");
        }
        std::fs::remove_dir_all(&root).unwrap();
    }
}
