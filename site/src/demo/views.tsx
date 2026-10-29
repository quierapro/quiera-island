/**
 * The island's views, rebuilt for the page from the app's own
 * (src/island, src/modules): same sizes, same layout, same styles.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AppVolume, ClipItem, DemoNotification, LaunchItem, LyricLine, Track } from "./data";
import {
  BellIcon,
  BluetoothIcon,
  CapsIcon,
  CheckIcon,
  ChevronIcon,
  ClipboardIcon,
  ClockIcon,
  CloseIcon,
  EqualsIcon,
  FileGlyph,
  GearIcon,
  GlobeIcon,
  HeadphonesIcon,
  LinkIcon,
  NoteIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SearchIcon,
  ShuffleIcon,
  SkipIcon,
  SlidersIcon,
  SpeakerIcon,
  TrayIcon,
  WifiIcon,
} from "./icons";
import type { LaunchRow } from "./launcher";

export type Size = [width: number, height: number, radius: number];

export const TAB_BAR_HEIGHT = 32;
export const SIZES = {
  idle: [124, 34, 17] as Size,
  activity: [236, 34, 17] as Size,
  peek: [340, 46, 22] as Size,
  clock: [260, 92, 26] as Size,
  player: [650, 176, 30] as Size,
  playerNoLyrics: [400, 176, 30] as Size,
};

/* ---------------------------------------------------------------- Shell */

interface ShellProps {
  size: Size;
  grow: boolean;
  viewKey: string;
  children: ReactNode;
  onPointerEnter?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
  onClick?: () => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

/** The black body, its two flares into the screen edge, and the view inside. */
export function Shell({ size, grow, viewKey, children, ...handlers }: ShellProps) {
  const [w, h, r] = size;
  return (
    <div className="isl" style={{ width: w + (grow ? 10 : 0), height: h + (grow ? 2 : 0) }} {...handlers}>
      <svg className="isl-flare isl-flare--left" width="14" height="13" viewBox="0 0 14 13" aria-hidden="true">
        <path d="M0 0C10 0 13 3 13 13H14V0Z" />
      </svg>
      <svg className="isl-flare isl-flare--right" width="14" height="13" viewBox="0 0 14 13" aria-hidden="true">
        <path d="M0 0C10 0 13 3 13 13H14V0Z" />
      </svg>
      <div className="isl-body" style={{ borderBottomLeftRadius: r + (grow ? 1 : 0), borderBottomRightRadius: r + (grow ? 1 : 0) }}>
        <div key={viewKey} className="isl-view" style={{ width: w, height: h }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Tabs */

export type Tab = "home" | "controls" | "notifications" | "shelf" | "clipboard";

export function TabBar({
  tab,
  hasMedia,
  counts,
  onSelect,
}: {
  tab: Tab;
  hasMedia: boolean;
  counts: { notifications: number; shelf: number; clipboard: number };
  onSelect(tab: Tab): void;
}) {
  const tabs: { id: Tab; label: string; icon: ReactNode; badge?: number }[] = [
    { id: "home", label: hasMedia ? "Lecture" : "Heure", icon: hasMedia ? <NoteIcon size={17} /> : <ClockIcon /> },
    { id: "controls", label: "Contrôles", icon: <SlidersIcon size={17} /> },
    { id: "notifications", label: "Notifications", icon: <BellIcon size={17} />, badge: counts.notifications },
    { id: "shelf", label: "Shelf", icon: <TrayIcon size={18} />, badge: counts.shelf },
    { id: "clipboard", label: "Presse-papiers", icon: <ClipboardIcon size={17} />, badge: counts.clipboard },
  ];
  const shown = tabs.filter((t) => t.id === "home" || t.id === "controls" || (t.badge ?? 0) > 0 || t.id === tab);
  return (
    <div className="tabs" role="tablist" style={{ height: TAB_BAR_HEIGHT }}>
      {shown.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          aria-label={t.label}
          title={t.label}
          className={`tab ${tab === t.id ? "tab--active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(t.id);
          }}
        >
          <span className="tab-icon">{t.icon}</span>
          {t.badge ? <span className="tab-badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Clock */

/** The time, ticking; 0 until mounted, so the prerendered page and the first render agree. */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, active]);
  return now;
}

const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function ClockIdle() {
  const now = useNow(10_000);
  return <div className="clock-idle">{now ? time(new Date(now)) : ""}</div>;
}

export function ClockPanel() {
  const ms = useNow(10_000);
  const now = new Date(ms);
  const day = ms ? now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "";
  return (
    <div className="clock-panel">
      <div className="clock-panel-time">{ms ? time(now) : ""}</div>
      <div className="clock-panel-day">{day.charAt(0).toUpperCase() + day.slice(1)}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Media */

function Art({ track, size, radius }: { track: Track; size: number; radius: number }) {
  return <div className="media-art" style={{ width: size, height: size, borderRadius: radius, background: track.cover }} />;
}

function Bars({ playing }: { playing: boolean }) {
  return (
    <span className={`media-bars ${playing ? "media-bars--playing" : ""}`} style={{ height: 14 }} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function lineAt(lines: LyricLine[], pos: number): number {
  let index = 0;
  for (let i = 0; i < lines.length; i++) if (lines[i].start <= pos) index = i;
  return index;
}

function wordsSung(line: LyricLine, pos: number): number {
  const span = (line.end - line.start) * 0.8;
  return Math.min(line.words.length, Math.floor(((pos - line.start) / span) * line.words.length) + 1);
}

/** The compact pill while music plays: the word being sung. */
export function MediaActivity({ track, pos, playing }: { track: Track; pos: number; playing: boolean }) {
  let word = track.title;
  if (track.lyrics && playing) {
    const line = track.lyrics[lineAt(track.lyrics, pos)];
    word = line.words[Math.max(0, wordsSung(line, pos) - 1)];
  }
  return (
    <div className="media-activity">
      <Art track={track} size={20} radius={6} />
      <span className="media-word">
        <span key={word} className="media-word-text">
          {word}
        </span>
      </span>
      <Bars playing={playing} />
    </div>
  );
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export interface PlayerActions {
  toggle(): void;
  skip(by: 1 | -1): void;
  seek(ms: number): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
}

export function Player({
  track,
  pos,
  playing,
  shuffle,
  repeat,
  actions,
}: {
  track: Track;
  pos: number;
  playing: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "track";
  actions: PlayerActions;
}) {
  return (
    <div className="media-expanded">
      <div className="media-player">
        <div className="media-head">
          <Art track={track} size={60} radius={14} />
          <div className="media-text">
            <span className="media-title media-title--lg">{track.title}</span>
            <span className="media-artist">{track.artist}</span>
          </div>
        </div>
        <div className="media-progress">
          <span className="media-time">{mmss(pos)}</span>
          <div className="media-track">
            <div className="media-fill" style={{ transform: `scaleX(${Math.min(1, pos / track.durationMs)})` }} />
            <input
              className="media-seek"
              type="range"
              min={0}
              max={track.durationMs}
              step={1000}
              value={Math.min(pos, track.durationMs)}
              aria-label="Position dans le morceau"
              onChange={(e) => actions.seek(Number(e.target.value))}
            />
          </div>
          <span className="media-time media-time--end">-{mmss(track.durationMs - pos)}</span>
        </div>
        <div className="media-controls">
          <button type="button" className={`media-btn media-btn--small ${shuffle ? "media-btn--on" : ""}`} aria-label="Lecture aléatoire" aria-pressed={shuffle} onClick={actions.toggleShuffle}>
            <ShuffleIcon size={18} />
          </button>
          <button type="button" className="media-btn" aria-label="Précédent" onClick={() => actions.skip(-1)}>
            <SkipIcon size={22} back />
          </button>
          <button type="button" className="media-btn media-btn--play" aria-label={playing ? "Pause" : "Lecture"} onClick={actions.toggle}>
            <span key={playing ? "pause" : "play"} className="media-btn-glyph">
              {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
            </span>
          </button>
          <button type="button" className="media-btn" aria-label="Suivant" onClick={() => actions.skip(1)}>
            <SkipIcon size={22} />
          </button>
          <button
            type="button"
            className={`media-btn media-btn--small ${repeat !== "off" ? "media-btn--on" : ""}`}
            aria-label="Répéter"
            onClick={actions.cycleRepeat}
          >
            <RepeatIcon size={18} one={repeat === "track"} />
          </button>
        </div>
      </div>
      {track.lyrics && <Lyrics lines={track.lyrics} pos={pos} onSeek={actions.seek} />}
    </div>
  );
}

const ROW = 27;

function Lyrics({ lines, pos, onSeek }: { lines: LyricLine[]; pos: number; onSeek(ms: number): void }) {
  const index = lineAt(lines, pos);
  return (
    <div className="lyrics" style={{ height: ROW * 5 }}>
      <div className="lyrics-track" style={{ transform: `translateY(${(1 - index) * ROW}px)` }}>
        {lines.map((line, i) => {
          const distance = Math.min(Math.abs(i - index), 3);
          const sung = i === index ? wordsSung(line, pos) : 0;
          return (
            <div
              key={i}
              className="lyric lyric--seek"
              data-distance={distance}
              style={{ height: ROW }}
              onClick={() => onSeek(line.start + 1)}
            >
              {i === index
                ? line.words.map((w, k) => (
                    <span key={k} className={`lyric-word ${k < sung ? "lyric-word--sung" : ""}`}>
                      {w}{" "}
                    </span>
                  ))
                : line.words.join(" ")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Launcher */

function Letter({ letter, color, size = 26, radius = 7 }: { letter: string; color: string; size?: number; radius?: number }) {
  return (
    <span className="letter-icon" style={{ width: size, height: size, borderRadius: radius, background: color, fontSize: size * 0.55 }}>
      {letter}
    </span>
  );
}

function Highlighted({ text, match }: { text: string; match: [number, number] | null }) {
  if (!match) return <>{text}</>;
  return (
    <>
      {text.slice(0, match[0])}
      <strong>{text.slice(match[0], match[1])}</strong>
      {text.slice(match[1])}
    </>
  );
}

function ItemIcon({ item }: { item: LaunchItem }) {
  if (item.kind === "app") return <Letter letter={item.letter ?? "?"} color={item.color ?? "#2a2a30"} />;
  return <FileGlyph kind={item.kind} />;
}

export function Launcher({
  query,
  rows,
  active,
  inputRef,
  onQuery,
  onKey,
  onPick,
  onHover,
}: {
  query: string;
  rows: LaunchRow[];
  active: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onQuery(q: string): void;
  onKey(e: React.KeyboardEvent): void;
  onPick(i: number): void;
  onHover(i: number): void;
}) {
  return (
    <div className="launch">
      <div className="launch-bar">
        <SearchIcon size={20} />
        <input
          ref={inputRef}
          className="launch-input"
          value={query}
          placeholder="Rechercher des applis, des fichiers…"
          aria-label="Rechercher"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={onKey}
        />
      </div>
      {rows.length > 0 && (
        <div className="launch-list" role="listbox">
          {rows.map((row, i) => (
            <div
              key={i}
              role="option"
              aria-selected={i === active}
              className={`launch-row ${i === active ? "launch-row--on" : ""}`}
              onPointerEnter={() => onHover(i)}
              onClick={() => onPick(i)}
            >
              <LaunchRowContent row={row} />
              {i === active && <span className="launch-hint">{row.type === "calc" ? "Copier" : "Entrée"}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LaunchRowContent({ row }: { row: LaunchRow }) {
  switch (row.type) {
    case "calc":
      return (
        <>
          <span className="launch-icon launch-icon--glyph">
            <EqualsIcon />
          </span>
          <span className="launch-title launch-title--big">{row.value}</span>
        </>
      );
    case "settings":
      return (
        <>
          <span className="launch-icon launch-icon--glyph">
            <GearIcon />
          </span>
          <span className="launch-title">Réglages de Quiera</span>
        </>
      );
    case "web":
      return (
        <>
          <span className="launch-icon launch-icon--glyph">
            <GlobeIcon />
          </span>
          <span className="launch-title">Rechercher « {row.query} » sur le web</span>
        </>
      );
    case "item":
      return (
        <>
          <ItemIcon item={row.item} />
          {row.item.sub ? (
            <span className="launch-text">
              <span className="launch-title">
                <Highlighted text={row.item.title} match={row.match} />
              </span>
              <span className="launch-sub">{row.item.sub}</span>
            </span>
          ) : (
            <span className="launch-title">
              <Highlighted text={row.item.title} match={row.match} />
            </span>
          )}
        </>
      );
  }
}

/* ---------------------------------------------------------------- Notifications */

export function notificationsSize(count: number): [number, number] {
  if (count === 0) return [380, 120];
  return [460, 38 + Math.min(count, 3) * 70];
}

const ago = (minutes: number) => (minutes < 1 ? "à l'instant" : `il y a ${minutes} min`);

export function Notifications({
  items,
  onOpen,
  onDismiss,
  onClear,
}: {
  items: DemoNotification[];
  onOpen(id: number): void;
  onDismiss(id: number): void;
  onClear(): void;
}) {
  if (items.length === 0) {
    return (
      <div className="notif-empty">
        <BellIcon size={22} />
        Aucune notification
      </div>
    );
  }
  return (
    <div className="notif">
      <div className="notif-head">
        <span className="notif-count">
          {items.length} notification{items.length > 1 ? "s" : ""}
        </span>
        <button type="button" className="notif-clear" onClick={onClear}>
          Tout effacer
        </button>
      </div>
      <div className="notif-list">
        {items.map((n) => (
          <div key={n.id} className="notif-row" onClick={() => onOpen(n.id)}>
            <Letter letter={n.letter} color={n.color} size={34} radius={9} />
            <div className="notif-content">
              <div className="notif-meta">
                <span className="notif-app">{n.app}</span>
                <span className="notif-time">{ago(n.minutesAgo)}</span>
              </div>
              <div className="notif-title">{n.title}</div>
              <div className="notif-body">{n.body}</div>
            </div>
            <button
              type="button"
              className="notif-dismiss"
              aria-label="Retirer"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(n.id);
              }}
            >
              <CloseIcon size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationPeek({ item }: { item: DemoNotification }) {
  return (
    <div className="notif-peek">
      <Letter letter={item.letter} color={item.color} size={28} radius={8} />
      <div className="notif-content">
        <div className="notif-title">{item.title}</div>
        <div className="notif-peek-body">{item.body}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Controls */

export function controlsSize(outputsOpen: boolean, apps: number): [number, number] {
  const rows = outputsOpen ? 3 : Math.min(apps, 3);
  return [460, 158 + 10 + 14 + 6 + rows * 34 + (rows - 1) * 6];
}

/** A slider shaped like a pill, dragged anywhere along it. */
function PillSlider({
  level,
  muted,
  big,
  label,
  icon,
  onLevel,
  onIcon,
}: {
  level: number;
  muted: boolean;
  big?: boolean;
  label: string;
  icon: ReactNode;
  onLevel(level: number): void;
  onIcon(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const levelAt = (x: number) => {
    const box = ref.current!.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (x - box.left) / box.width)) * 100);
  };
  return (
    <div
      ref={ref}
      className={`ctl-pill ${big ? "ctl-pill--big" : ""} ${drag ? "ctl-pill--drag" : ""} ${muted ? "ctl-pill--muted" : ""}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={level}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest(".ctl-pill-icon")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
        onLevel(levelAt(e.clientX));
      }}
      onPointerMove={(e) => drag && onLevel(levelAt(e.clientX))}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onLevel(Math.min(100, level + 5));
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onLevel(Math.max(0, level - 5));
        else return;
        e.preventDefault();
      }}
    >
      <div className="ctl-pill-fill" style={{ width: `${muted ? 0 : level}%` }} />
      <div className="ctl-pill-content">
        <button type="button" className="ctl-pill-icon" aria-label={muted ? "Rétablir le son" : "Couper le son"} onClick={onIcon}>
          {icon}
        </button>
        <span className="ctl-pill-label">{label}</span>
        <span className="ctl-pill-value">{muted ? "Muet" : level}</span>
      </div>
    </div>
  );
}

export interface ControlsState {
  wifi: boolean;
  bluetooth: boolean;
  volume: number;
  muted: boolean;
  output: number;
  outputsOpen: boolean;
  apps: AppVolume[];
}

export function Controls({
  state,
  outputs,
  onChange,
}: {
  state: ControlsState;
  outputs: string[];
  onChange(next: Partial<ControlsState>): void;
}) {
  return (
    <div className="ctl">
      <div className="ctl-toggles">
        <button type="button" className={`ctl-toggle ${state.wifi ? "ctl-toggle--on" : ""}`} aria-pressed={state.wifi} onClick={() => onChange({ wifi: !state.wifi })}>
          <span className="ctl-toggle-icon">
            <WifiIcon size={16} />
          </span>
          <span className="ctl-toggle-text">
            <span className="ctl-toggle-label">Wi-Fi</span>
            <span className="ctl-toggle-state">{state.wifi ? "Activé" : "Désactivé"}</span>
          </span>
        </button>
        <button type="button" className={`ctl-toggle ${state.bluetooth ? "ctl-toggle--on" : ""}`} aria-pressed={state.bluetooth} onClick={() => onChange({ bluetooth: !state.bluetooth })}>
          <span className="ctl-toggle-icon">
            <BluetoothIcon size={16} />
          </span>
          <span className="ctl-toggle-text">
            <span className="ctl-toggle-label">Bluetooth</span>
            <span className="ctl-toggle-state">{state.bluetooth ? "Activé" : "Désactivé"}</span>
          </span>
        </button>
      </div>
      <button type="button" className={`ctl-current ${state.outputsOpen ? "ctl-current--open" : ""}`} onClick={() => onChange({ outputsOpen: !state.outputsOpen })}>
        <span className="ctl-current-label">Sortie</span>
        <span className="ctl-current-name">{outputs[state.output]}</span>
        <span style={{ transform: state.outputsOpen ? "rotate(180deg)" : undefined, transition: "transform .2s", display: "grid" }}>
          <ChevronIcon />
        </span>
      </button>
      <PillSlider
        big
        label="Volume"
        level={state.volume}
        muted={state.muted}
        icon={<SpeakerIcon size={17} muted={state.muted || state.volume === 0} />}
        onLevel={(volume) => onChange({ volume, muted: false })}
        onIcon={() => onChange({ muted: !state.muted })}
      />
      <div className="ctl-section">
        <div className="ctl-caption">{state.outputsOpen ? "Sorties audio" : "Applications"}</div>
        <div className="ctl-list">
          {state.outputsOpen
            ? outputs.map((name, i) => (
                <button key={name} type="button" className={`ctl-output ${i === state.output ? "ctl-output--on" : ""}`} onClick={() => onChange({ output: i, outputsOpen: false })}>
                  {i === 1 ? <HeadphonesIcon size={16} /> : <SpeakerIcon size={16} />}
                  <span className="ctl-output-name">{name}</span>
                  {i === state.output && <CheckIcon size={14} />}
                </button>
              ))
            : state.apps.map((app, i) => (
                <PillSlider
                  key={app.name}
                  label={app.name}
                  level={app.level}
                  muted={app.muted}
                  icon={<Letter letter={app.letter} color={app.color} size={20} radius={5} />}
                  onLevel={(level) => onChange({ apps: state.apps.map((a, k) => (k === i ? { ...a, level, muted: false } : a)) })}
                  onIcon={() => onChange({ apps: state.apps.map((a, k) => (k === i ? { ...a, muted: !a.muted } : a)) })}
                />
              ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Shelf */

export interface ShelfItem {
  id: number;
  name: string;
  size: number;
  kind: string;
  thumb: string | null;
}

export function shelfSize(count: number): [number, number] {
  return count === 0 ? [380, 120] : [560, 150];
}

export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} o`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} Ko`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
  return `${(bytes / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Go`;
}

export function Shelf({ items, target, onRemove, onClear }: { items: ShelfItem[]; target: boolean; onRemove(id: number): void; onClear(): void }) {
  if (items.length === 0) {
    return (
      <div className={`shelf-empty ${target ? "shelf-empty--target" : ""}`}>
        <TrayIcon size={22} />
        Déposez des fichiers ici
      </div>
    );
  }
  return (
    <div className={`shelf ${target ? "shelf--target" : ""}`}>
      <div className="shelf-head">
        <span className="shelf-count">
          {items.length} fichier{items.length > 1 ? "s" : ""}
        </span>
        <button type="button" className="shelf-clear" onClick={onClear}>
          Tout retirer
        </button>
      </div>
      <div className="shelf-row">
        {items.map((item) => (
          <div key={item.id} className="shelf-tile" title={item.name}>
            <div className={`shelf-thumb ${item.thumb ? "shelf-thumb--image" : ""}`}>
              {item.thumb ? <img src={item.thumb} alt="" /> : <FileGlyph kind={item.kind} size={44} />}
              <button type="button" className="shelf-remove" aria-label={`Retirer ${item.name}`} onClick={() => onRemove(item.id)}>
                <CloseIcon size={9} />
              </button>
            </div>
            <div className="shelf-name">{item.name}</div>
            <div className="shelf-size">{formatSize(item.size)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Clipboard */

export function clipboardSize(count: number): [number, number] {
  return count === 0 ? [380, 120] : [560, 150];
}

export function Clipboard({ items, copied, onCopy, onClear }: { items: ClipItem[]; copied: number | null; onCopy(item: ClipItem): void; onClear(): void }) {
  if (items.length === 0) {
    return (
      <div className="clip-empty">
        <ClipboardIcon size={22} />
        Ce que vous copiez apparaîtra ici
      </div>
    );
  }
  return (
    <div className="clip">
      <div className="clip-head">
        <span className="clip-count">
          {items.length} élément{items.length > 1 ? "s" : ""}
        </span>
        <button type="button" className="clip-clear" onClick={onClear}>
          Tout effacer
        </button>
      </div>
      <div className="clip-row">
        {items.map((item) => (
          <div key={item.id} className="clip-card" onClick={() => onCopy(item)} title="Cliquer pour copier">
            <div className="clip-body">
              {item.kind === "link" ? (
                <div className="clip-link">
                  <span className="clip-host">
                    <LinkIcon size={13} />
                    {new URL(item.text).host}
                  </span>
                  <span className="clip-url">{item.text}</span>
                </div>
              ) : (
                <p className="clip-text">{item.text}</p>
              )}
            </div>
            <div className="clip-foot">{item.kind === "link" ? "Lien" : `${item.text.length} caractères`}</div>
            {copied === item.id && (
              <div className="clip-copied">
                <CheckIcon size={14} />
                Copié
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- System peeks */

export type SystemPeek =
  | { kind: "power"; level: number }
  | { kind: "headset"; battery: number }
  | { kind: "caps"; on: boolean }
  | { kind: "volume"; level: number }
  | { kind: "copied"; text: string }
  | { kind: "opened"; title: string; letter: string; color: string; file?: string };

export function systemPeekSize(peek: SystemPeek): Size {
  switch (peek.kind) {
    case "power":
      return [290, 40, 20];
    case "headset":
      return [330, 50, 25];
    case "caps":
      return [220, 38, 19];
    case "volume":
      return [290, 38, 19];
    case "copied":
      return [300, 40, 20];
    case "opened":
      return [300, 42, 21];
  }
}

export function SystemPeekView({ peek }: { peek: SystemPeek }) {
  switch (peek.kind) {
    case "power":
      return (
        <div className="peek-row">
          <span className="peek-battery peek-battery--charging">
            <span className="peek-battery-body">
              <span className="peek-battery-fill" style={{ transform: `scaleX(${peek.level / 100})` }} />
            </span>
            <span className="peek-battery-tip" />
          </span>
          <span className="peek-title">En charge</span>
          <span className="peek-value peek-value--good">{peek.level} %</span>
        </div>
      );
    case "headset": {
      const c = 2 * Math.PI * 12;
      return (
        <div className="peek-row">
          <span className="peek-icon">
            <HeadphonesIcon size={17} />
          </span>
          <span className="peek-text">
            <span className="peek-caption">Connecté</span>
            <span className="peek-title peek-title--ellipsis">Casque sans fil</span>
          </span>
          <span className="peek-ring">
            <svg width="30" height="30" viewBox="0 0 30 30">
              <circle className="peek-ring-track" cx="15" cy="15" r="12" />
              <circle className="peek-ring-fill" cx="15" cy="15" r="12" strokeDasharray={`${(c * peek.battery) / 100} ${c}`} />
            </svg>
            <span className="peek-ring-text">{peek.battery}</span>
          </span>
        </div>
      );
    }
    case "caps":
      return (
        <div className="peek-row">
          <span className="peek-key">
            <CapsIcon />
          </span>
          <span className="peek-title">Verr. Maj</span>
          <span className={`peek-dot ${peek.on ? "peek-dot--on" : ""}`} />
        </div>
      );
    case "volume":
      return (
        <div className="peek-row">
          <SpeakerIcon size={17} muted={peek.level === 0} />
          <span className="peek-bar">
            <span className="peek-bar-fill" style={{ transform: `scaleX(${peek.level / 100})` }} />
          </span>
          <span className="peek-value">{peek.level}</span>
        </div>
      );
    case "copied":
      return (
        <div className="peek-row">
          <span className="peek-copied">
            <CheckIcon size={13} />
          </span>
          <span className="peek-snippet">
            <span className="peek-snippet-text">{peek.text}</span>
          </span>
        </div>
      );
    case "opened":
      return (
        <div className="peek-row">
          {peek.file ? <FileGlyph kind={peek.file} size={24} /> : <Letter letter={peek.letter} color={peek.color} size={24} radius={7} />}
          <span className="peek-title peek-title--ellipsis">{peek.title}</span>
          <span className="peek-value">s'ouvre…</span>
        </div>
      );
  }
}
