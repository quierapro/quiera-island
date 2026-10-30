import { useCallback, useEffect, useRef, useState } from "react";
import {
  APP_VOLUMES,
  DESKTOP_FILES,
  INITIAL_CLIPS,
  OUTPUTS,
  TRACKS,
  initialNotifications,
  makeClip,
  makeNotification,
  type ClipItem,
  type DemoNotification,
} from "./data";
import { FileGlyph } from "./icons";
import { launcherHeight, search, type LaunchRow } from "./launcher";
import {
  Clipboard,
  ClockIdle,
  ClockPanel,
  Controls,
  Launcher,
  MediaActivity,
  NotificationPeek,
  Notifications,
  Player,
  SIZES,
  Shell,
  PhoneShare,
  Shelf,
  SystemPeekView,
  TAB_BAR_HEIGHT,
  TabBar,
  clipboardSize,
  controlsSize,
  notificationsSize,
  shelfSize,
  systemPeekSize,
  useNow,
  type ControlsState,
  type ShelfItem,
  type Size,
  type SystemPeek,
  type Tab,
} from "./views";

export type SceneId = "veille" | "musique" | "lanceur" | "notifications" | "controles" | "shelf";

interface Scene {
  id: SceneId;
  label: string;
  title: string;
  desc: string;
  /** How long the scene plays before the next, while nobody touches the demo. */
  ms: number;
}

export const SCENES: Scene[] = [
  {
    id: "veille",
    label: "Veille",
    title: "L'heure au repos, et les petits événements du PC.",
    desc: "Au repos, l'île n'affiche que l'heure. Branchez le chargeur, connectez un casque ou activez Verr. Maj : un aperçu discret apparaît, puis l'île se range. Survolez-la pour l'ouvrir.",
    ms: 11000,
  },
  {
    id: "musique",
    label: "Musique",
    title: "Votre musique et ses paroles, mot à mot.",
    desc: "Pendant la lecture, la pilule affiche le mot chanté. Survolez-la pour ouvrir le lecteur : pochette, progression, aléatoire, répétition et paroles synchronisées. Cliquez sur une ligne pour y aller.",
    ms: 11000,
  },
  {
    id: "lanceur",
    label: "Lanceur",
    title: "Un lanceur pour tout Windows.",
    desc: "Alt+Espace ouvre une recherche dans l'île : applis, fichiers de tous vos disques, calculs et recherche web. Tapez « images » ou « vidéos » pour filtrer par type. Ici aussi, vous pouvez taper.",
    ms: 11000,
  },
  {
    id: "notifications",
    label: "Notifications",
    title: "Vos notifications, au bon endroit.",
    desc: "Les notifications de Windows passent sur l'île quelques secondes, puis restent dans leur onglet. Un clic ouvre l'appli concernée, la croix les retire. Le mode Ne pas déranger est respecté.",
    ms: 10000,
  },
  {
    id: "controles",
    label: "Contrôles",
    title: "Wi-Fi, Bluetooth et son, sans ouvrir les Paramètres.",
    desc: "Activez le Wi-Fi ou le Bluetooth, changez de sortie audio et réglez le volume de chaque application en faisant glisser les curseurs.",
    ms: 8000,
  },
  {
    id: "shelf",
    label: "Shelf & presse-papiers",
    title: "Vos fichiers et vos copies, sous la main.",
    desc: "Glissez un fichier sur l'île pour le garder de côté : essayez avec ceux du bureau, ou un fichier de votre ordinateur (il ne quitte pas votre navigateur). « Envoyer au téléphone » affiche un QR code à scanner. Copiez du texte sur cette page : il arrive dans le presse-papiers de l'île.",
    ms: 9000,
  },
];

type Peek = { key: number; system: SystemPeek } | { key: number; notification: DemoNotification };

const PIN_TAB: Partial<Record<SceneId, Tab>> = { controles: "controls", shelf: "shelf" };
const HOVER_OPEN_MS = 140;
const LEAVE_CLOSE_MS = 380;
const DEMO_FILE_TYPE = "application/x-quiera-demo-file";

/** A small picture for the demo's « vacances.jpg ». */
const BEACH =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><defs><linearGradient id="s" x2="0" y2="1"><stop offset="0" stop-color="#5ec8f2"/><stop offset="1" stop-color="#bfe9ff"/></linearGradient></defs><rect width="56" height="56" fill="url(#s)"/><circle cx="42" cy="14" r="6" fill="#ffd36b"/><path d="M0 34c10-4 18 2 28-1s18-5 28-1v24H0Z" fill="#2a8fc9"/><path d="M0 44c14-5 30-3 56 0v12H0Z" fill="#f2d49b"/></svg>',
  );

function kindOf(name: string, type: string): string {
  if (type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg|heic)$/i.test(name)) return "image";
  if (type.startsWith("video/") || /\.(mp4|mov|mkv|avi|webm)$/i.test(name)) return "video";
  if (type.startsWith("audio/") || /\.(mp3|wav|flac|ogg|m4a)$/i.test(name)) return "music";
  return "document";
}

let shelfId = 1;

export function Demo({ scene, onScene }: { scene: SceneId; onScene(id: SceneId): void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(1);
  const [interacted, setInteracted] = useState(false);

  // ---- Hover: grow at once, open a moment later, close a moment after leaving.
  const [near, setNear] = useState(false);
  const [open, setOpen] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("home");

  // ---- Peeks
  const [peek, setPeek] = useState<Peek | null>(null);
  const peekTimer = useRef<number | undefined>(undefined);
  const peekKey = useRef(0);
  const showPeek = useCallback((content: { system: SystemPeek } | { notification: DemoNotification }, ms: number) => {
    clearTimeout(peekTimer.current);
    setPeek({ key: ++peekKey.current, ...content } as Peek);
    peekTimer.current = window.setTimeout(() => setPeek(null), ms);
  }, []);

  // ---- Media
  const [mediaOn, setMediaOn] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState({ pos: 0, at: Date.now() });
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "track">("off");
  const now = useNow(100, visible && mediaOn && playing);
  const track = TRACKS[trackIndex];
  const pos = Math.min(track.durationMs, clock.pos + (playing ? Math.max(0, now - clock.at) : 0));

  const seek = useCallback((ms: number) => setClock({ pos: ms, at: Date.now() }), []);
  const skip = useCallback(
    (by: 1 | -1) => {
      if (by === -1 && pos > 3000) return seek(0);
      setTrackIndex((i) => {
        if (shuffle && by === 1) return (i + 1 + Math.floor(Math.random() * (TRACKS.length - 1))) % TRACKS.length;
        return (i + by + TRACKS.length) % TRACKS.length;
      });
      setClock({ pos: 0, at: Date.now() });
    },
    [pos, seek, shuffle],
  );

  useEffect(() => {
    if (playing && pos >= track.durationMs) {
      if (repeat === "track") seek(0);
      else skip(1);
    }
  }, [playing, pos, track.durationMs, repeat, seek, skip]);

  const togglePlay = () => {
    setClock({ pos, at: Date.now() });
    setPlaying((p) => !p);
  };

  // ---- Launcher
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const typedByUser = useRef(false);
  const rows: LaunchRow[] = launcherOpen ? search(query) : [];

  // ---- Notifications, controls, Shelf, clipboard
  const [notifications, setNotifications] = useState<DemoNotification[]>(initialNotifications);
  const notifCount = useRef(0);
  const [controls, setControls] = useState<ControlsState>({
    wifi: true,
    bluetooth: true,
    volume: 64,
    muted: false,
    output: 0,
    outputsOpen: false,
    apps: APP_VOLUMES,
  });
  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  // The Shelf's "send to phone" panel is open.
  const [phone, setPhone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [clips, setClips] = useState<ClipItem[]>(INITIAL_CLIPS);
  const [copied, setCopied] = useState<number | null>(null);

  // ---- Scene scripts: what plays while nobody touches the demo.
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearTimeout(peekTimer.current);
    setPeek(null);
    setOpen(false);
    setNear(false);
    setLauncherOpen(false);
    setQuery("");
    typedByUser.current = false;
    setTab(PIN_TAB[scene] ?? (scene === "notifications" ? "notifications" : "home"));
    setPhone(false);

    switch (scene) {
      case "veille":
        setMediaOn(false);
        later(() => showPeek({ system: { kind: "power", level: 76 } }, 2600), 1200);
        later(() => showPeek({ system: { kind: "headset", battery: 82 } }, 2800), 4800);
        later(() => showPeek({ system: { kind: "caps", on: true } }, 2000), 8400);
        break;
      case "musique":
        setMediaOn(true);
        setPlaying(true);
        setTrackIndex(0);
        setClock({ pos: 17_400, at: Date.now() });
        later(() => setOpen(true), 3000);
        break;
      case "lanceur": {
        setMediaOn(false);
        later(() => setLauncherOpen(true), 700);
        const script = ["rapport", "images", "12*4+2"];
        let t = 1200;
        for (const word of script) {
          for (let i = 1; i <= word.length; i++) {
            const text = word.slice(0, i);
            later(() => !typedByUser.current && (setQuery(text), setActive(0)), t);
            t += 110;
          }
          t += 2000;
        }
        break;
      }
      case "notifications":
        setMediaOn(false);
        later(() => receiveNotification(), 900);
        later(() => setOpen(true), 5200);
        break;
      default:
        setMediaOn(false);
    }
    return () => timers.current.forEach(clearTimeout);
  }, [scene]);

  const receiveNotification = () => {
    const item = makeNotification([0, 3, 4][notifCount.current++ % 3]);
    setNotifications((list) => [item, ...list]);
    showPeek({ notification: item }, 4000);
  };

  // ---- Scenes advance by themselves until the visitor takes over.
  useEffect(() => {
    if (interacted || !visible) return;
    const index = SCENES.findIndex((s) => s.id === scene);
    const timer = setTimeout(() => onScene(SCENES[(index + 1) % SCENES.length].id), SCENES[index].ms);
    return () => clearTimeout(timer);
  }, [scene, interacted, visible, onScene]);

  // ---- Only run while on screen; scale the island to the laptop's screen.
  useEffect(() => {
    const root = rootRef.current!;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(root);
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, (e.contentRect.width - 16) / 690)));
    ro.observe(screenRef.current!);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  // ---- Text copied anywhere on the page lands in the island's clipboard.
  const addClip = useCallback(
    (text: string) => {
      const clean = text.trim().slice(0, 400);
      if (!clean) return;
      setClips((list) => [makeClip(clean), ...list.filter((c) => c.text !== clean)].slice(0, 12));
      showPeek({ system: { kind: "copied", text: clean } }, 1800);
    },
    [showPeek],
  );
  useEffect(() => {
    const onCopy = () => addClip(window.getSelection()?.toString() ?? "");
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, [addClip]);

  // A file dropped beside the island must not make the browser leave the page.
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  // ---- Surface, size and view, as the app decides them.
  const pinned = PIN_TAB[scene] !== undefined;
  const expanded = !launcherOpen && (open || pinned || dragOver);
  const surface = launcherOpen ? "launcher" : expanded ? "expanded" : peek ? "peek" : mediaOn ? "activity" : "idle";

  let size: Size;
  if (surface === "launcher") size = [640, launcherHeight(rows.length), 28];
  else if (surface === "expanded") {
    const [w, h, r]: Size =
      tab === "controls"
        ? [...controlsSize(controls.outputsOpen, controls.apps.length), 26]
        : tab === "notifications"
          ? [...notificationsSize(notifications.length), 26]
          : tab === "shelf"
            ? [...shelfSize(shelf.length), 26]
            : tab === "clipboard"
              ? [...clipboardSize(clips.length), 26]
              : mediaOn
                ? track.lyrics
                  ? SIZES.player
                  : SIZES.playerNoLyrics
                : SIZES.clock;
    size = [Math.max(w, 300), h + TAB_BAR_HEIGHT, r];
  } else if (surface === "peek" && peek) size = "system" in peek ? systemPeekSize(peek.system) : SIZES.peek;
  else size = surface === "activity" ? SIZES.activity : SIZES.idle;

  const touch = () => setInteracted(true);

  const enter = () => {
    touch();
    setNear(true);
    clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_MS);
  };
  const leave = (e: React.PointerEvent) => {
    // A finger lifted is not the pointer leaving: a tap keeps the island open.
    if (e.pointerType === "touch") return;
    setNear(false);
    clearTimeout(hoverTimer.current);
    if (!launcherOpen) hoverTimer.current = window.setTimeout(() => setOpen(false), LEAVE_CLOSE_MS);
  };

  const openLauncher = (text = "") => {
    touch();
    typedByUser.current = true;
    timers.current.forEach(clearTimeout);
    setOpen(false);
    setLauncherOpen(true);
    setQuery(text);
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };
  const closeLauncher = () => {
    setLauncherOpen(false);
    setQuery("");
  };

  const pick = (i: number) => {
    const row = rows[i];
    if (!row) return;
    closeLauncher();
    switch (row.type) {
      case "item":
        showPeek(
          {
            system:
              row.item.kind === "app"
                ? { kind: "opened", title: row.item.title, letter: row.item.letter ?? "?", color: row.item.color ?? "#333" }
                : { kind: "opened", title: row.item.title, letter: "", color: "", file: row.item.kind },
          },
          1800,
        );
        break;
      case "calc":
        navigator.clipboard?.writeText(row.value).catch(() => {});
        addClip(row.value);
        break;
      case "settings":
        showPeek({ system: { kind: "opened", title: "Réglages de Quiera", letter: "Q", color: "#7136ff" } }, 1800);
        break;
      case "web":
        showPeek({ system: { kind: "opened", title: `« ${row.query} » sur le web`, letter: "W", color: "#0a84ff" } }, 1800);
        break;
    }
  };

  const onLauncherKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((a) => Math.min(rows.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter") pick(active);
    else if (e.key === "Escape") closeLauncher();
    else return;
    e.preventDefault();
  };

  // ---- Shelf drops: files from the visitor's computer, or the demo desktop's.
  const accepts = (e: React.DragEvent) => e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes(DEMO_FILE_TYPE);
  const dragEnter = (e: React.DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    touch();
    setDragOver(true);
    setLauncherOpen(false);
    setTab("shelf");
  };
  const drop = (e: React.DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    setDragOver(false);
    const demo = e.dataTransfer.getData(DEMO_FILE_TYPE);
    if (demo) addDesktopFile(Number(demo));
    const files = Array.from(e.dataTransfer.files).slice(0, 12);
    if (files.length) {
      setShelf((list) => [
        ...list,
        ...files.map((f) => {
          const kind = kindOf(f.name, f.type);
          return { id: shelfId++, name: f.name, size: f.size, kind, thumb: kind === "image" ? URL.createObjectURL(f) : null };
        }),
      ]);
    }
    if (!pinned) setOpen(true);
  };
  const addDesktopFile = (index: number) => {
    const f = DESKTOP_FILES[index];
    if (!f) return;
    setShelf((list) => [...list, { id: shelfId++, name: f.name, size: f.size, kind: f.kind, thumb: f.kind === "image" ? BEACH : null }]);
  };
  const removeShelf = (ids: number[]) =>
    setShelf((list) =>
      list.filter((item) => {
        const gone = ids.includes(item.id);
        if (gone && item.thumb?.startsWith("blob:")) URL.revokeObjectURL(item.thumb);
        return !gone;
      }),
    );

  // ---- What the island shows.
  let view: React.ReactNode;
  let viewKey: string;
  if (surface === "launcher") {
    viewKey = "launcher";
    view = (
      <Launcher
        query={query}
        rows={rows}
        active={active}
        inputRef={inputRef}
        onQuery={(q) => {
          typedByUser.current = true;
          touch();
          setQuery(q);
          setActive(0);
        }}
        onKey={onLauncherKey}
        onPick={pick}
        onHover={setActive}
      />
    );
  } else if (surface === "expanded") {
    viewKey = "expanded";
    let content: React.ReactNode;
    if (tab === "controls") content = <Controls state={controls} outputs={OUTPUTS} onChange={(next) => setControls((c) => ({ ...c, ...next }))} />;
    else if (tab === "notifications")
      content = (
        <Notifications
          items={notifications}
          onOpen={(id) => {
            const n = notifications.find((x) => x.id === id);
            setNotifications((list) => list.filter((x) => x.id !== id));
            if (n) showPeek({ system: { kind: "opened", title: n.app, letter: n.letter, color: n.color } }, 1600);
          }}
          onDismiss={(id) => setNotifications((list) => list.filter((x) => x.id !== id))}
          onClear={() => setNotifications([])}
        />
      );
    else if (tab === "shelf")
      content =
        phone && shelf.length > 0 && !dragOver ? (
          <PhoneShare what={shelf.length === 1 ? shelf[0].name : `${shelf.length} fichiers`} onBack={() => setPhone(false)} />
        ) : (
          <Shelf
            items={shelf}
            target={dragOver}
            onRemove={(id) => removeShelf([id])}
            onClear={() => removeShelf(shelf.map((s) => s.id))}
            onSend={() => setPhone(true)}
          />
        );
    else if (tab === "clipboard")
      content = (
        <Clipboard
          items={clips}
          copied={copied}
          onCopy={(item) => {
            navigator.clipboard?.writeText(item.text).catch(() => {});
            setCopied(item.id);
            setTimeout(() => setCopied((c) => (c === item.id ? null : c)), 1100);
          }}
          onClear={() => setClips([])}
        />
      );
    else if (mediaOn)
      content = (
        <Player
          track={track}
          pos={pos}
          playing={playing}
          shuffle={shuffle}
          repeat={repeat}
          actions={{
            toggle: togglePlay,
            skip,
            seek,
            toggleShuffle: () => setShuffle((s) => !s),
            cycleRepeat: () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "track" : "off")),
          }}
        />
      );
    else content = <ClockPanel />;
    view = (
      <>
        <TabBar
          tab={tab}
          hasMedia={mediaOn}
          counts={{ notifications: notifications.length, shelf: shelf.length, clipboard: clips.length }}
          onSelect={(t) => {
            touch();
            setTab(t);
          }}
        />
        <div key={tab} className="isl-tab" style={{ height: size[1] - TAB_BAR_HEIGHT }}>
          {content}
        </div>
      </>
    );
  } else if (surface === "peek" && peek) {
    viewKey = `peek:${peek.key}`;
    view = "system" in peek ? <SystemPeekView peek={peek.system} /> : <NotificationPeek item={peek.notification} />;
  } else if (surface === "activity") {
    viewKey = "activity";
    view = <MediaActivity track={track} pos={pos} playing={playing} />;
  } else {
    viewKey = "idle";
    view = <ClockIdle />;
  }

  const chips = sceneChips();

  function sceneChips(): { label: string; run(): void; kbd?: boolean }[] {
    switch (scene) {
      case "veille":
        return [
          { label: "Brancher le chargeur", run: () => showPeek({ system: { kind: "power", level: 40 + Math.floor(Math.random() * 55) } }, 2600) },
          { label: "Connecter un casque", run: () => showPeek({ system: { kind: "headset", battery: 30 + Math.floor(Math.random() * 70) } }, 2800) },
          {
            label: "Verr. Maj",
            run: () => showPeek({ system: { kind: "caps", on: !(peek && "system" in peek && peek.system.kind === "caps" && peek.system.on) } }, 2000),
          },
          {
            label: "Volume +",
            run: () => {
              const level = Math.min(100, controls.volume + 8);
              setControls((c) => ({ ...c, volume: level, muted: false }));
              showPeek({ system: { kind: "volume", level } }, 1600);
            },
          },
        ];
      case "musique":
        return [
          { label: playing ? "Pause" : "Lecture", run: togglePlay },
          { label: "Morceau suivant", run: () => skip(1) },
          { label: open ? "Fermer le lecteur" : "Ouvrir le lecteur", run: () => setOpen((o) => !o) },
        ];
      case "lanceur":
        return [
          { label: "Alt + Espace", kbd: true, run: () => openLauncher() },
          { label: "spo", run: () => openLauncher("spo") },
          { label: "vidéos", run: () => openLauncher("vidéos") },
          { label: "(18+6)/4", run: () => openLauncher("(18+6)/4") },
          { label: "réglages", run: () => openLauncher("réglages") },
        ];
      case "notifications":
        return [
          { label: "Recevoir une notification", run: () => (setOpen(false), receiveNotification()) },
          { label: "Ouvrir la liste", run: () => (setTab("notifications"), setOpen(true)) },
        ];
      case "controles":
        return [
          { label: controls.muted ? "Rétablir le son" : "Couper le son", run: () => setControls((c) => ({ ...c, muted: !c.muted })) },
          { label: "Changer de sortie", run: () => setControls((c) => ({ ...c, outputsOpen: !c.outputsOpen })) },
        ];
      case "shelf":
        return [
          { label: "Copier un texte", run: () => {
              const text = "Quiera, la Dynamic Island de Windows";
              navigator.clipboard?.writeText(text).catch(() => {});
              addClip(text);
            } },
          {
            label: "Envoyer au téléphone",
            run: () => {
              if (shelf.length === 0) addDesktopFile(0);
              setTab("shelf");
              setPhone(true);
            },
          },
          { label: "Voir le presse-papiers", run: () => setTab("clipboard") },
          { label: "Voir le Shelf", run: () => setTab("shelf") },
        ];
    }
  }

  const current = SCENES.find((s) => s.id === scene)!;

  return (
    <div className="demo" ref={rootRef} onPointerDown={touch} onKeyDown={touch}>
      <div className="laptop">
        <div className="laptop-frame">
          <div
            className="laptop-screen"
            ref={screenRef}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest(".isl, .desk-file")) return;
              setNear(false);
              setOpen(false);
              closeLauncher();
            }}
            onDragEnter={dragEnter}
            onDragOver={(e) => accepts(e) && e.preventDefault()}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
          >
            <div className="wallpaper" aria-hidden="true" />
            {scene === "shelf" && (
              <div className="desk">
                {DESKTOP_FILES.map((f, i) => (
                  <button
                    key={f.name}
                    type="button"
                    className="desk-file"
                    draggable
                    title="Glissez-le sur l'île (ou cliquez)"
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DEMO_FILE_TYPE, String(i));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => {
                      touch();
                      setTab("shelf");
                      addDesktopFile(i);
                    }}
                  >
                    {f.kind === "image" ? <img src={BEACH} alt="" width={40} height={40} /> : <FileGlyph kind={f.kind} size={40} />}
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="isl-stage" style={{ transform: `translateX(-50%) scale(${scale})` }}>
              <Shell
                size={size}
                grow={near && (surface === "idle" || surface === "activity" || surface === "peek")}
                viewKey={viewKey}
                onPointerEnter={enter}
                onPointerLeave={leave}
                onClick={() => {
                  touch();
                  if (!expanded && !launcherOpen) setOpen(true);
                }}
                onDragEnter={dragEnter}
                onDragOver={(e) => {
                  if (!accepts(e)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={drop}
              >
                {view}
              </Shell>
            </div>
          </div>
        </div>
      </div>

      <div className="scene-bar">
        <div className="scene-pills" role="tablist" aria-label="Démonstrations">
          {SCENES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === scene}
              className={`scene-pill ${s.id === scene ? "is-active" : ""} ${s.id === scene && !interacted && visible ? "is-timed" : ""}`}
              style={{ "--scene-ms": `${s.ms}ms` } as React.CSSProperties}
              onClick={() => {
                touch();
                onScene(s.id);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div key={scene} className="scene-text">
          <h2 className="scene-title">{current.title}</h2>
          <p className="scene-desc">{current.desc}</p>
          {chips.length > 0 && (
            <div className="scene-try">
              <span className="scene-try-label">Essayez :</span>
              {chips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={`try-chip ${c.kbd ? "try-chip--kbd" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    touch();
                    c.run();
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
