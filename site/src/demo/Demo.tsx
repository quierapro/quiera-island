import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localeOf, useLang, useTr, type Tr } from "../i18n";
import {
  APP_VOLUMES,
  demoEvents,
  desktopFiles,
  initialClips,
  initialNotifications,
  makeClip,
  makeNotification,
  outputs,
  tracks,
  type ClipItem,
  type DemoEvent,
  type DemoNotification,
} from "./data";
import {
  CALENDAR_ACTIVITY,
  CALENDAR_PEEK,
  CalendarActivity,
  CalendarPanel,
  CalendarPeek,
  MIRROR_SIZE,
  MirrorView,
  TIMER_ACTIVITY,
  TimerActivity,
  TimerLive,
  TimerPicker,
  agendaSize,
  timerPanelSize,
  type TimerPhase,
} from "./extra";
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

export type SceneId = "veille" | "musique" | "lanceur" | "agenda" | "minuteur" | "notifications" | "controles" | "shelf" | "jeux";

interface Scene {
  id: SceneId;
  label: string;
  title: string;
  desc: string;
  /** How long the scene plays before the next, while nobody touches the demo. */
  ms: number;
}

export function scenes(tr: Tr): Scene[] {
  return [
    {
      id: "veille",
      label: tr("Veille", "Idle"),
      title: tr("L'heure au repos, et les petits événements du PC.", "The time at rest, and the PC's little events."),
      desc: tr(
        "Au repos, l'île n'affiche que l'heure. Branchez le chargeur, connectez un casque ou un clavier Bluetooth (avec sa batterie), activez Verr. Maj : un aperçu discret apparaît, puis l'île se range. Survolez-la pour l'ouvrir.",
        "At rest, the island only shows the time. Plug in the charger, connect headphones or a Bluetooth keyboard (with its battery), turn on Caps Lock: a discreet peek appears, then the island tucks away. Hover it to open it.",
      ),
      ms: 13000,
    },
    {
      id: "musique",
      label: tr("Musique", "Music"),
      title: tr("Votre musique et ses paroles, mot à mot.", "Your music and its lyrics, word by word."),
      desc: tr(
        "Pendant la lecture, la pilule affiche le mot chanté. Survolez-la pour ouvrir le lecteur : pochette, progression, paroles synchronisées. Plusieurs sources jouent ? Les points sous le lecteur passent de l'une à l'autre, et la contrôlent.",
        "While music plays, the pill shows the word being sung. Hover it to open the player: cover, progress, synced lyrics. Several sources playing? The dots under the player switch between them, and control the one shown.",
      ),
      ms: 11000,
    },
    {
      id: "lanceur",
      label: tr("Lanceur", "Launcher"),
      title: tr("Un lanceur pour tout Windows.", "A launcher for all of Windows."),
      desc: tr(
        "Alt+Espace ouvre une recherche dans l'île : applis, fichiers de tous vos disques, calculs, minuteurs et recherche web. Tapez « images » ou « vidéos » pour filtrer par type. Ici aussi, vous pouvez taper.",
        "Alt+Space opens a search in the island: apps, files from all your drives, calculations, timers and web search. Type “images” or “videos” to filter by type. You can type here too.",
      ),
      ms: 11000,
    },
    {
      id: "agenda",
      label: tr("Agenda", "Calendar"),
      title: tr("Vos réunions, et un bouton pour les rejoindre.", "Your meetings, and a button to join them."),
      desc: tr(
        "Collez le lien iCal de votre agenda Google, Outlook ou iCloud : l'île annonce chaque réunion quelques minutes avant, avec un bouton Rejoindre qui ouvre Teams, Meet ou Zoom. Un coup d'œil dans le miroir avant d'y aller ?",
        "Paste your Google, Outlook or iCloud calendar's iCal link: the island announces each meeting a few minutes before, with a Join button that opens Teams, Meet or Zoom. A look in the mirror before you go?",
      ),
      ms: 11000,
    },
    {
      id: "minuteur",
      label: tr("Minuteur", "Timer"),
      title: tr("Un minuteur toujours sous les yeux.", "A timer always in sight."),
      desc: tr(
        "Tapez « 5 min » ou « pomodoro » dans le lanceur, ou choisissez la durée avec les roues de son onglet. Le compte à rebours reste dans la pilule, et l'île sonne à la fin.",
        "Type “5 min” or “pomodoro” in the launcher, or pick the time with the wheels in its tab. The countdown stays in the pill, and the island rings at the end.",
      ),
      ms: 11000,
    },
    {
      id: "notifications",
      label: "Notifications",
      title: tr("Vos notifications, au bon endroit.", "Your notifications, in the right place."),
      desc: tr(
        "Les notifications de Windows passent sur l'île quelques secondes, puis restent dans leur onglet. Un clic ouvre l'appli concernée, la croix les retire. Le mode Ne pas déranger est respecté.",
        "Windows' notifications pass over the island for a few seconds, then stay in their tab. A click opens the app, the cross dismisses them. Do Not Disturb is respected.",
      ),
      ms: 10000,
    },
    {
      id: "controles",
      label: tr("Contrôles", "Controls"),
      title: tr("Wi-Fi, Bluetooth et son, sans ouvrir les Paramètres.", "Wi-Fi, Bluetooth and sound, without opening Settings."),
      desc: tr(
        "Activez le Wi-Fi ou le Bluetooth, changez de sortie audio et réglez le volume de chaque application en faisant glisser les curseurs.",
        "Turn Wi-Fi or Bluetooth on, switch the audio output and set each app's volume by dragging the sliders.",
      ),
      ms: 8000,
    },
    {
      id: "shelf",
      label: tr("Shelf & presse-papiers", "Shelf & clipboard"),
      title: tr("Vos fichiers et vos copies, sous la main.", "Your files and your copies, at hand."),
      desc: tr(
        "Glissez un fichier sur l'île pour le garder de côté : essayez avec ceux du bureau, ou un fichier de votre ordinateur (il ne quitte pas votre navigateur). « Envoyer au téléphone » affiche un QR code à scanner. Copiez du texte sur cette page : il arrive dans le presse-papiers de l'île.",
        "Drag a file onto the island to keep it aside: try the desktop's, or a file from your computer (it never leaves your browser). “Send to phone” shows a QR code to scan. Copy some text on this page: it lands in the island's clipboard.",
      ),
      ms: 9000,
    },
    {
      id: "jeux",
      label: tr("Jeux", "Games"),
      title: tr("Discrète en jeu, là quand vous l'appelez.", "Out of the way in games, there when you call it."),
      desc: tr(
        "En plein écran, l'île se cache toute seule. Votre raccourci (Ctrl+Alt+I, une touche, ou Ctrl pressé deux fois) l'affiche par-dessus le jeu, et la recache. Fermée, elle laisse passer les clics vers ce qu'il y a dessous : les onglets du navigateur restent cliquables.",
        "In fullscreen, the island hides by itself. Your shortcut (Ctrl+Alt+I, a single key, or Ctrl pressed twice) shows it over the game, and hides it again. Closed, it lets clicks through to what lies below: your browser's tabs stay clickable.",
      ),
      ms: 9000,
    },
  ];
}

type Peek =
  | { key: number; system: SystemPeek }
  | { key: number; notification: DemoNotification }
  | { key: number; meeting: DemoEvent };

interface DemoTimer {
  total: number;
  pomodoro: boolean;
  phase: TimerPhase;
  /** While running: when it ends. Paused: what is left. */
  endsAt: number;
  left: number;
}

const PIN_TAB: Partial<Record<SceneId, Tab>> = { controles: "controls", shelf: "shelf" };
const HOVER_OPEN_MS = 140;
const LEAVE_CLOSE_MS = 380;
const DEMO_FILE_TYPE = "application/x-quiera-demo-file";

/** A small picture for the demo's holiday photo. */
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
  const lang = useLang();
  const tr = useTr();
  const locale = localeOf(lang);
  const SCENES = useMemo(() => scenes(tr), [lang]);
  const TRACKS = useMemo(() => tracks(lang), [lang]);
  const DESKTOP_FILES = useMemo(() => desktopFiles(lang), [lang]);
  const EVENTS = useMemo(() => demoEvents(lang), [lang]);
  const OUTPUTS = useMemo(() => outputs(lang), [lang]);

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
  const showPeek = useCallback((content: { system: SystemPeek } | { notification: DemoNotification } | { meeting: DemoEvent }, ms: number) => {
    clearTimeout(peekTimer.current);
    setPeek({ key: ++peekKey.current, ...content } as Peek);
    peekTimer.current = window.setTimeout(() => setPeek(null), ms);
  }, []);

  // ---- Media: several sources, the dots switch between them.
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
    [pos, seek, shuffle, TRACKS.length],
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
  const pickSource = (i: number) => {
    setTrackIndex(i);
    setClock({ pos: 20_000 + i * 31_000, at: Date.now() });
    setPlaying(true);
  };

  // ---- Launcher
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const typedByUser = useRef(false);
  const rows: LaunchRow[] = launcherOpen ? search(query, lang) : [];

  // ---- Timer: in the pill, and its tab.
  const [timer, setTimer] = useState<DemoTimer | null>(null);
  const [wheels, setWheels] = useState({ h: 0, m: 5, s: 0 });
  const tick = useNow(250, visible && timer?.phase === "running");
  const timerLeft = timer ? (timer.phase === "running" ? Math.max(0, timer.endsAt - (tick || Date.now())) : timer.left) : 0;
  const startTimer = (ms: number, pomodoro = false) => setTimer({ total: ms, pomodoro, phase: "running", endsAt: Date.now() + ms, left: ms });
  useEffect(() => {
    if (timer?.phase === "running" && timerLeft <= 0) setTimer({ ...timer, phase: "ringing", left: 0 });
  }, [timer, timerLeft]);
  useEffect(() => {
    if (timer?.phase !== "ringing") return;
    const done = setTimeout(() => setTimer(null), 8000);
    return () => clearTimeout(done);
  }, [timer?.phase]);
  const timerMain = () => {
    if (!timer) return;
    if (timer.phase === "ringing") startTimer(timer.total, timer.pomodoro);
    else if (timer.phase === "paused") setTimer({ ...timer, phase: "running", endsAt: Date.now() + timer.left });
    else setTimer({ ...timer, phase: "paused", left: timerLeft });
  };

  // ---- Calendar: a meeting coming, in the pill and its tab.
  const [meeting, setMeeting] = useState<DemoEvent | null>(null);
  const [meetingSince, setMeetingSince] = useState(0);
  const minuteTick = useNow(1000, visible && meeting !== null);
  const meetingIn = meeting ? Math.max(0, meeting.inMinutes - Math.floor(((minuteTick || meetingSince) - meetingSince) / 6000)) : 0;
  const announceMeeting = () => {
    const first = EVENTS[0];
    setMeeting(first);
    setMeetingSince(Date.now());
    showPeek({ meeting: first }, 4200);
  };
  const join = (event: DemoEvent) =>
    showPeek({ system: { kind: "opened", title: event.service ?? "", letter: (event.service ?? "?")[0], color: event.service === "Teams" ? "#5b5fc7" : "#1fa463" } }, 1800);

  // ---- Fullscreen game: the island hidden, shown by the shortcut.
  const [game, setGame] = useState(false);
  const [shownInGame, setShownInGame] = useState(false);
  const [keyFlash, setKeyFlash] = useState(0);
  const pressShortcut = () => {
    setShownInGame((s) => !s);
    setKeyFlash((k) => k + 1);
  };

  // ---- Notifications, controls, Shelf, clipboard
  const [notifications, setNotifications] = useState<DemoNotification[]>(() => initialNotifications(lang));
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
  const [clips, setClips] = useState<ClipItem[]>(() => initialClips(lang));
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
    setTab(PIN_TAB[scene] ?? (scene === "notifications" ? "notifications" : scene === "agenda" ? "calendar" : scene === "minuteur" ? "timer" : "home"));
    setPhone(false);
    setMediaOn(scene === "musique");
    setGame(scene === "jeux");
    setShownInGame(false);
    if (scene !== "agenda") setMeeting(null);
    if (scene !== "minuteur") setTimer(null);

    switch (scene) {
      case "veille":
        later(() => showPeek({ system: { kind: "power", level: 76 } }, 2600), 1200);
        later(() => showPeek({ system: { kind: "headset", battery: 82 } }, 2800), 4600);
        later(() => showPeek({ system: { kind: "bluetooth", device: "keyboard", name: tr("Clavier sans fil", "Wireless keyboard"), battery: 94, low: false } }, 2800), 8000);
        later(() => showPeek({ system: { kind: "caps", on: true } }, 2000), 11200);
        break;
      case "musique":
        setPlaying(true);
        setTrackIndex(0);
        setClock({ pos: 17_400, at: Date.now() });
        later(() => setOpen(true), 3000);
        later(() => !typedByUser.current && pickSource(1), 7600);
        break;
      case "lanceur": {
        later(() => setLauncherOpen(true), 700);
        const script = [tr("rapport", "report"), "images", "12*4+2"];
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
      case "agenda":
        later(announceMeeting, 900);
        later(() => setOpen(true), 6200);
        break;
      case "minuteur": {
        later(() => setLauncherOpen(true), 600);
        let t = 1000;
        for (let i = 1; i <= 5; i++) {
          const text = "5 min".slice(0, i);
          later(() => !typedByUser.current && (setQuery(text), setActive(0)), t);
          t += 120;
        }
        later(() => {
          if (typedByUser.current) return;
          setLauncherOpen(false);
          setQuery("");
          startTimer(5 * 60_000);
        }, t + 1300);
        later(() => setOpen(true), t + 5200);
        break;
      }
      case "notifications":
        later(() => receiveNotification(), 900);
        later(() => setOpen(true), 5200);
        break;
      case "jeux":
        later(pressShortcut, 2600);
        later(pressShortcut, 6600);
        break;
    }
    return () => timers.current.forEach(clearTimeout);
  }, [scene]);

  const receiveNotification = () => {
    const item = makeNotification([0, 3, 4][notifCount.current++ % 3], lang);
    setNotifications((list) => [item, ...list]);
    showPeek({ notification: item }, 4000);
  };

  // ---- Scenes advance by themselves until the visitor takes over.
  useEffect(() => {
    if (interacted || !visible) return;
    const index = SCENES.findIndex((s) => s.id === scene);
    const timer = setTimeout(() => onScene(SCENES[(index + 1) % SCENES.length].id), SCENES[index].ms);
    return () => clearTimeout(timer);
  }, [scene, interacted, visible, onScene, SCENES]);

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

  // ---- Surface, size and view, as the app decides them. Of the live
  // activities, the timer comes first, then a meeting, then the music.
  const pinned = PIN_TAB[scene] !== undefined;
  const expanded = !launcherOpen && (open || pinned || dragOver);
  const live = timer ? "timer" : meeting ? "meeting" : mediaOn ? "media" : null;
  const surface = launcherOpen ? "launcher" : expanded ? "expanded" : peek ? "peek" : live ? "activity" : "idle";
  const hidden = game && !shownInGame && !launcherOpen;

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
              : tab === "timer"
                ? timerPanelSize(timer !== null)
                : tab === "calendar"
                  ? agendaSize(2, EVENTS.length)
                  : tab === "mirror"
                    ? MIRROR_SIZE
                    : mediaOn
                      ? track.lyrics
                        ? SIZES.player
                        : SIZES.playerNoLyrics
                      : SIZES.clock;
    size = [Math.max(w, 300), h + TAB_BAR_HEIGHT, r];
  } else if (surface === "peek" && peek)
    size = "system" in peek ? systemPeekSize(peek.system) : "meeting" in peek ? CALENDAR_PEEK : SIZES.peek;
  else if (surface === "activity") size = live === "timer" ? TIMER_ACTIVITY : live === "meeting" ? CALENDAR_ACTIVITY : SIZES.activity;
  else size = SIZES.idle;

  // The visitor takes over: the scene's script stops, so it never undoes what they just did.
  const touch = () => {
    setInteracted(true);
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

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
      case "timer":
        startTimer(row.ms, row.pomodoro);
        setTab("timer");
        break;
      case "calc":
        navigator.clipboard?.writeText(row.value).catch(() => {});
        addClip(row.value);
        break;
      case "settings":
        showPeek({ system: { kind: "opened", title: tr("Réglages de Quiera", "Quiera settings"), letter: "Q", color: "#7136ff" } }, 1800);
        break;
      case "web":
        showPeek({ system: { kind: "opened", title: tr(`« ${row.query} » sur le web`, `“${row.query}” on the web`), letter: "W", color: "#0a84ff" } }, 1800);
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
          <PhoneShare what={shelf.length === 1 ? shelf[0].name : tr(`${shelf.length} fichiers`, `${shelf.length} files`)} onBack={() => setPhone(false)} />
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
    else if (tab === "timer")
      content = timer ? (
        <TimerLive left={timerLeft} phase={timer.phase} pomodoro={timer.pomodoro} onStop={() => setTimer(null)} onMain={timerMain} />
      ) : (
        <TimerPicker value={wheels} onChange={setWheels} onStart={() => startTimer(((wheels.h * 60 + wheels.m) * 60 + wheels.s) * 1000)} />
      );
    else if (tab === "calendar") content = <CalendarPanel events={EVENTS} locale={locale} live={null} onJoin={join} />;
    else if (tab === "mirror") content = <MirrorView />;
    else if (mediaOn)
      content = (
        <Player
          track={track}
          pos={pos}
          playing={playing}
          shuffle={shuffle}
          repeat={repeat}
          sources={TRACKS.map((t, i) => ({ app: t.app, playing: i === trackIndex ? playing : i === 1 }))}
          source={trackIndex}
          onSource={(i) => {
            touch();
            pickSource(i);
          }}
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
          counts={{ notifications: notifications.length, shelf: shelf.length, clipboard: clips.length, calendar: scene === "agenda" ? EVENTS.length : 0 }}
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
    view =
      "system" in peek ? (
        <SystemPeekView peek={peek.system} />
      ) : "meeting" in peek ? (
        <CalendarPeek event={peek.meeting} minutes={meetingIn} onJoin={() => join(peek.meeting)} />
      ) : (
        <NotificationPeek item={peek.notification} />
      );
  } else if (surface === "activity") {
    viewKey = `activity:${live}`;
    view =
      live === "timer" && timer ? (
        <TimerActivity left={timerLeft} total={timer.total} phase={timer.phase} />
      ) : live === "meeting" && meeting ? (
        <CalendarActivity event={meeting} minutes={meetingIn} />
      ) : (
        <MediaActivity track={track} pos={pos} playing={playing} />
      );
  } else {
    viewKey = "idle";
    view = <ClockIdle />;
  }

  const chips = sceneChips();

  function sceneChips(): { label: string; run(): void; kbd?: boolean }[] {
    switch (scene) {
      case "veille":
        return [
          { label: tr("Brancher le chargeur", "Plug in the charger"), run: () => showPeek({ system: { kind: "power", level: 40 + Math.floor(Math.random() * 55) } }, 2600) },
          { label: tr("Connecter un casque", "Connect headphones"), run: () => showPeek({ system: { kind: "headset", battery: 30 + Math.floor(Math.random() * 70) } }, 2800) },
          {
            label: tr("Allumer le clavier", "Turn on the keyboard"),
            run: () => showPeek({ system: { kind: "bluetooth", device: "keyboard", name: tr("Clavier sans fil", "Wireless keyboard"), battery: 94, low: false } }, 2800),
          },
          {
            label: tr("Souris presque vide", "Mouse running low"),
            run: () => showPeek({ system: { kind: "bluetooth", device: "mouse", name: tr("Souris sans fil", "Wireless mouse"), battery: 12, low: true } }, 3000),
          },
          {
            label: tr("Verr. Maj", "Caps Lock"),
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
          { label: playing ? "Pause" : tr("Lecture", "Play"), run: togglePlay },
          { label: tr("Morceau suivant", "Next track"), run: () => skip(1) },
          { label: tr("Changer de source", "Switch source"), run: () => (setOpen(true), pickSource((trackIndex + 1) % TRACKS.length)) },
          { label: open ? tr("Fermer le lecteur", "Close the player") : tr("Ouvrir le lecteur", "Open the player"), run: () => setOpen((o) => !o) },
        ];
      case "lanceur":
        return [
          { label: tr("Alt + Espace", "Alt + Space"), kbd: true, run: () => openLauncher() },
          { label: "spo", run: () => openLauncher("spo") },
          { label: tr("vidéos", "videos"), run: () => openLauncher(tr("vidéos", "videos")) },
          { label: "(18+6)/4", run: () => openLauncher("(18+6)/4") },
          { label: "pomodoro", run: () => openLauncher("pomodoro") },
        ];
      case "agenda":
        return [
          { label: tr("Recevoir le rappel", "Get the reminder"), run: () => (setOpen(false), announceMeeting()) },
          { label: tr("Ouvrir l'agenda", "Open the calendar"), run: () => (setTab("calendar"), setOpen(true)) },
          { label: tr("Se voir avant", "Check yourself first"), run: () => (setTab("mirror"), setOpen(true)) },
          { label: tr("Rejoindre", "Join"), run: () => (setOpen(false), join(EVENTS[0])) },
        ];
      case "minuteur":
        return [
          { label: "5 min", run: () => openLauncher("5 min") },
          { label: tr("Minuteur de 10 s", "10 s timer"), run: () => (setOpen(false), startTimer(10_000)) },
          { label: timer?.phase === "paused" ? tr("Reprendre", "Resume") : "Pause", run: timerMain },
          { label: tr("Choisir avec les roues", "Pick with the wheels"), run: () => (setTimer(null), setTab("timer"), setOpen(true)) },
        ];
      case "notifications":
        return [
          { label: tr("Recevoir une notification", "Get a notification"), run: () => (setOpen(false), receiveNotification()) },
          { label: tr("Ouvrir la liste", "Open the list"), run: () => (setTab("notifications"), setOpen(true)) },
        ];
      case "controles":
        return [
          { label: controls.muted ? tr("Rétablir le son", "Unmute") : tr("Couper le son", "Mute"), run: () => setControls((c) => ({ ...c, muted: !c.muted })) },
          { label: tr("Changer de sortie", "Switch output"), run: () => setControls((c) => ({ ...c, outputsOpen: !c.outputsOpen })) },
        ];
      case "shelf":
        return [
          {
            label: tr("Copier un texte", "Copy some text"),
            run: () => {
              const text = tr("Quiera, la Dynamic Island de Windows", "Quiera, the Dynamic Island for Windows");
              navigator.clipboard?.writeText(text).catch(() => {});
              addClip(text);
            },
          },
          {
            label: tr("Envoyer au téléphone", "Send to phone"),
            run: () => {
              if (shelf.length === 0) addDesktopFile(0);
              setTab("shelf");
              setPhone(true);
            },
          },
          { label: tr("Voir le presse-papiers", "See the clipboard"), run: () => setTab("clipboard") },
          { label: tr("Voir le Shelf", "See the Shelf"), run: () => setTab("shelf") },
        ];
      case "jeux":
        return [{ label: "Ctrl + Alt + I", kbd: true, run: pressShortcut }];
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
            <div className={`wallpaper ${game ? "wallpaper--game" : ""}`} aria-hidden="true">
              {game && (
                <div className="game-hud">
                  <span className="game-hud-score">12 450</span>
                  <span className="game-hud-bar" />
                </div>
              )}
            </div>
            {game && keyFlash > 0 && (
              <div key={keyFlash} className="game-key" aria-hidden="true">
                Ctrl + Alt + I
              </div>
            )}
            {scene === "shelf" && (
              <div className="desk">
                {DESKTOP_FILES.map((f, i) => (
                  <button
                    key={f.name}
                    type="button"
                    className="desk-file"
                    draggable
                    title={tr("Glissez-le sur l'île (ou cliquez)", "Drag it onto the island (or click)")}
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
            <div className={`isl-stage ${hidden ? "isl-stage--hidden" : ""}`} style={{ transform: `translateX(-50%) scale(${scale})` }}>
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
        <div className="scene-pills" role="tablist" aria-label={tr("Démonstrations", "Demos")}>
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
              <span className="scene-try-label">{tr("Essayez :", "Try it:")}</span>
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
