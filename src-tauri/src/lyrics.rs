//! Word-synced lyrics from NetEase Cloud Music ("yrc" format), fetched by
//! the backend because the service sends no CORS headers.
//!
//! This is NetEase's unofficial web API: it can change or block at any
//! time, and it is not licensed for third-party apps. Only the track's
//! title, artist and duration are sent. The UI falls back to LRCLIB when
//! this returns nothing. (A setting to turn it off comes in step 5.)

use std::time::Duration;

use serde::Deserialize;

const USER_AGENT: &str = "Quiera/0.1 (+https://github.com/quierapro/quiera-island)";
const SEARCH_URL: &str = "https://music.163.com/api/search/get";
const LYRIC_URL: &str = "https://music.163.com/api/song/lyric/v1";

#[derive(Debug, Clone, Deserialize)]
pub struct Song {
    pub id: u64,
    pub name: String,
    #[serde(default)]
    pub artists: Vec<Artist>,
    /// Length in ms.
    #[serde(default)]
    pub duration: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Artist {
    pub name: String,
}

#[derive(Deserialize)]
struct SearchResponse {
    result: Option<SearchResult>,
}

#[derive(Deserialize)]
struct SearchResult {
    #[serde(default)]
    songs: Vec<Song>,
}

#[derive(Deserialize)]
struct LyricResponse {
    yrc: Option<LyricBody>,
}

#[derive(Deserialize)]
struct LyricBody {
    lyric: Option<String>,
}

/// Lowercase letters and digits only, so "Don't Stop (Remix)" compares
/// equal to "dont stop remix".
fn normalize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

/// The search result that is the same recording, or None when nothing is
/// close enough: wrong lyrics are worse than none.
pub fn best_match(
    songs: &[Song],
    title: &str,
    artist: &str,
    duration_ms: Option<u64>,
) -> Option<u64> {
    let want_title = normalize(title);
    let want_artist = normalize(artist);
    if want_title.is_empty() {
        return None;
    }
    songs
        .iter()
        .filter_map(|song| {
            let name = normalize(&song.name);
            let title_score = if name == want_title {
                3
            } else if !name.is_empty() && (name.contains(&want_title) || want_title.contains(&name))
            {
                1
            } else {
                return None;
            };
            let artist_score = if want_artist.is_empty() {
                0
            } else if song.artists.iter().any(|a| {
                let a = normalize(&a.name);
                !a.is_empty() && (a.contains(&want_artist) || want_artist.contains(&a))
            }) {
                2
            } else {
                -2
            };
            let duration_score = match duration_ms {
                Some(d) if song.duration > 0 => match song.duration.abs_diff(d) {
                    0..=3000 => 2,
                    3001..=8000 => 1,
                    _ => -3,
                },
                _ => 0,
            };
            let score = title_score + artist_score + duration_score;
            (score >= 3).then_some((score, song.id))
        })
        .max_by_key(|&(score, _)| score)
        .map(|(_, id)| id)
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(6)))
        .user_agent(USER_AGENT)
        .build()
        .into()
}

fn fetch(
    title: &str,
    artist: &str,
    duration_ms: Option<u64>,
) -> Result<Option<String>, ureq::Error> {
    let agent = agent();
    let query = format!("{title} {artist}");
    let found: SearchResponse = agent
        .get(SEARCH_URL)
        .query("s", query.trim())
        .query("type", "1")
        .query("limit", "8")
        .call()?
        .body_mut()
        .read_json()?;
    let songs = found.result.map(|r| r.songs).unwrap_or_default();
    let Some(id) = best_match(&songs, title, artist, duration_ms) else {
        return Ok(None);
    };
    let lyric: LyricResponse = agent
        .get(LYRIC_URL)
        .query("id", id.to_string())
        .query("lv", "1")
        .query("yv", "1")
        .call()?
        .body_mut()
        .read_json()?;
    Ok(lyric
        .yrc
        .and_then(|b| b.lyric)
        .filter(|l| !l.trim().is_empty()))
}

/// The word-synced lyrics (raw "yrc" text) of a track, or None.
#[tauri::command]
pub async fn lyrics_word_synced(
    title: String,
    artist: String,
    duration_ms: Option<u64>,
) -> Result<Option<String>, String> {
    if !crate::settings::get().media.netease {
        return Ok(None);
    }
    tauri::async_runtime::spawn_blocking(move || fetch(&title, &artist, duration_ms))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| {
            log::info!("word-synced lyrics unavailable: {e}");
            e.to_string()
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn song(id: u64, name: &str, artist: &str, duration: u64) -> Song {
        Song {
            id,
            name: name.into(),
            artists: vec![Artist {
                name: artist.into(),
            }],
            duration,
        }
    }

    #[test]
    fn picks_the_same_title_artist_and_length() {
        let songs = [
            song(1, "Bad Guy (Remix)", "Someone Else", 200_000),
            song(2, "bad guy", "Billie Eilish", 194_000),
            song(3, "Bad Guy", "Billie Eilish", 260_000),
        ];
        assert_eq!(
            best_match(&songs, "Bad Guy", "Billie Eilish", Some(194_087)),
            Some(2)
        );
    }

    #[test]
    fn rejects_a_different_song() {
        let songs = [song(1, "Good Girl", "Billie Eilish", 194_000)];
        assert_eq!(
            best_match(&songs, "Bad Guy", "Billie Eilish", Some(194_000)),
            None
        );
    }

    #[test]
    fn rejects_the_right_title_by_another_artist_with_another_length() {
        let songs = [song(1, "Flowers", "Someone Else", 300_000)];
        assert_eq!(
            best_match(&songs, "Flowers", "Miley Cyrus", Some(200_000)),
            None
        );
    }

    #[test]
    fn works_without_a_duration() {
        let songs = [song(7, "Tout va bien", "Orelsan", 0)];
        assert_eq!(best_match(&songs, "Tout va bien", "OrelSan", None), Some(7));
    }

    #[test]
    fn ignores_case_and_punctuation() {
        assert_eq!(normalize("Don't Stop (Remix)!"), "dontstopremix");
    }
}
