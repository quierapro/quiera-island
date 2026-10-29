import { useEffect, useMemo, useRef, useState } from "react";
import { closeLauncher, getLauncherApps, launchApp, openFile, searchFiles, type FileHit, type LauncherApp } from "../../ipc/launcher";
import { openLink } from "../../ipc/notifications";
import { arrivedLabel } from "../notifications/format";
import { formatNumber } from "./calc";
import { compose, MAX_ROWS, type Result } from "./results";
import "./launcher.css";

const ignore = () => {};
const USAGE_KEY = "quiera.launcher.usage";
/** Files are searched once typing pauses this long. */
const FILE_DELAY_MS = 90;

/** How often each app was opened from here, to rank it higher. Per device. */
function readUsage(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function countUse(key: string) {
  try {
    const usage = readUsage();
    usage[key] = (usage[key] ?? 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    // Storage unavailable: the ranking just does not learn.
  }
}

/** "D:\nom a trouver\src" → "D:\…\nom a trouver\src": the end says the most. */
function shortFolder(folder: string, max = 54): string {
  if (folder.length <= max) return folder;
  const root = folder.slice(0, 3);
  return `${root}…${folder.slice(folder.length - (max - root.length - 1))}`;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17" />
    </svg>
  );
}

function Icon({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="launch-icon launch-icon--letter">{name.slice(0, 1).toUpperCase()}</span>
  ) : (
    <img className="launch-icon" src={src} alt="" draggable={false} onError={() => setFailed(true)} />
  );
}

function Row({ result, selected, copied }: { result: Result; selected: boolean; copied: boolean }) {
  switch (result.kind) {
    case "app":
      return (
        <>
          <Icon src={result.app.icon} name={result.app.name} />
          <span className="launch-title">{result.app.name}</span>
          <span className="launch-hint">{selected ? "Ouvrir ↵" : "Application"}</span>
        </>
      );
    case "file":
      return (
        <>
          <Icon src={result.file.icon} name={result.file.name} />
          <span className="launch-text">
            <span className="launch-title">{result.file.name}</span>
            <span className="launch-sub">{shortFolder(result.file.folder)}</span>
          </span>
          <span className="launch-hint">
            {selected
              ? "Ouvrir ↵ · Dossier Ctrl ↵"
              : result.file.modified
                ? arrivedLabel(result.file.modified * 1000, Date.now())
                : result.file.dir
                  ? "Dossier"
                  : "Fichier"}
          </span>
        </>
      );
    case "calc":
      return (
        <>
          <span className="launch-icon launch-icon--glyph">=</span>
          <span className="launch-title launch-title--big">{formatNumber(result.value)}</span>
          <span className="launch-hint">{copied ? "Copié ✓" : selected ? "Copier ↵" : "Calcul"}</span>
        </>
      );
    case "web":
      return (
        <>
          <span className="launch-icon launch-icon--glyph">
            <GlobeIcon />
          </span>
          <span className="launch-title">
            Rechercher « <strong>{result.query}</strong> » sur le web
          </span>
          <span className="launch-hint">{selected ? "Ouvrir ↵" : "Google"}</span>
        </>
      );
  }
}

/**
 * The launcher: a search bar in the island. A calculation when the text is
 * one, apps (ranked by name, then by use), files and folders of the drives,
 * and always a web search. Arrows move, Enter opens, Ctrl+Enter shows a file
 * in its folder, Escape clears then closes.
 */
export function Launcher({ onRows }: { onRows(rows: number): void }) {
  const [query, setQuery] = useState("");
  const [apps, setApps] = useState<LauncherApp[]>([]);
  const [files, setFiles] = useState<{ query: string; hits: FileHit[]; ready: boolean }>({ query: "", hits: [], ready: true });
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const usage = useMemo(readUsage, []);

  useEffect(() => {
    getLauncherApps().then(setApps).catch(ignore);
  }, []);

  // Files, once typing pauses; an answer for an older query is dropped.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFiles({ query: q, hits: [], ready: true });
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      searchFiles(q, MAX_ROWS)
        .then(({ ready, hits }) => live && setFiles({ query: q, hits, ready }))
        .catch(ignore);
    }, FILE_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  // The window gets the keyboard a moment after the island opens.
  useEffect(() => {
    const focus = () => input.current?.focus();
    focus();
    const timer = setTimeout(focus, 60);
    window.addEventListener("focus", focus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", focus);
    };
  }, []);

  // Clicking elsewhere closes it; the keyboard already went there.
  useEffect(() => {
    const blur = () => closeLauncher(false).catch(ignore);
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, []);

  const fileHits = files.query === query.trim() ? files.hits : [];
  const list = useMemo(() => compose(query, apps, fileHits, usage), [query, apps, fileHits, usage]);
  useEffect(() => onRows(list.length), [list.length, onRows]);
  useEffect(() => {
    setSelected(0);
    setCopied(false);
  }, [query]);

  const run = (result: Result | undefined, reveal: boolean) => {
    if (!result) return;
    switch (result.kind) {
      case "app":
        countUse(result.app.key);
        launchApp(result.app.key).catch(ignore);
        break;
      case "file":
        openFile(result.file, reveal).catch(ignore);
        break;
      case "calc":
        navigator.clipboard
          .writeText(String(result.value))
          .then(() => {
            setCopied(true);
            setTimeout(() => closeLauncher(true).catch(ignore), 500);
          })
          .catch(ignore);
        break;
      case "web":
        openLink(`https://www.google.com/search?q=${encodeURIComponent(result.query)}`)
          .then(() => closeLauncher(false))
          .catch(ignore);
        break;
    }
  };

  return (
    <div className="launch">
      <div className="launch-bar">
        <SearchIcon />
        <input
          ref={input}
          className="launch-input"
          value={query}
          placeholder="Une app, un fichier, « images », un calcul…"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              if (query) setQuery("");
              else closeLauncher(true).catch(ignore);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, list.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(list[selected], e.ctrlKey);
            }
          }}
        />
        {!files.ready && <span className="launch-indexing">Indexation des fichiers…</span>}
      </div>
      {list.length > 0 && (
        <div className="launch-list" role="listbox">
          {list.map((result, i) => (
            <div
              key={result.id}
              role="option"
              aria-selected={i === selected}
              className={`launch-row ${i === selected ? "launch-row--on" : ""}`}
              onPointerEnter={() => setSelected(i)}
              onClick={(e) => {
                e.stopPropagation();
                run(result, e.ctrlKey);
              }}
            >
              <Row result={result} selected={i === selected} copied={copied && result.kind === "calc"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
