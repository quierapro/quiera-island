import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode, lazy, Suspense } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createIslandController } from "../machine/controller";
import { CALENDAR_ACTIVITY, CALENDAR_PEEK, initialState, reduce, surfaceOf, TIMER_ACTIVITY, type Surface, type Tab } from "../machine/island-machine";
import { primaryActivity } from "../machine/arbiter";
import { benchRequested, runBench } from "../dev/bench";
// Development only: loaded on demand, so neither it nor its CSS ships.
const DebugPanel = import.meta.env.DEV ? lazy(() => import("../dev/DebugPanel").then((m) => ({ default: m.DebugPanel }))) : null;
import { getFullscreen, onFullscreen } from "../ipc/system";
import { BIRTH, targetBox, targetFor, type ShellTarget } from "./geometry";
import { IslandShell } from "./IslandShell";
import { useMedia } from "../modules/media/store";
import { useMediaActivity } from "../modules/media/useMediaActivity";
import { lyricsKind, useLyrics } from "../modules/media/lyrics";
import { MediaActivity, MediaExpanded, MediaPeek, mediaSize } from "../modules/media/views";
import { CLOCK_PANEL_SIZE, ClockPanel, IdleClock } from "../modules/clock/Clock";
import { shelfContentSize } from "../modules/shelf/format";
import { ShelfView } from "../modules/shelf/ShelfView";
import { startShelf, useShelf } from "../modules/shelf/store";
import { useFileDrop } from "../modules/shelf/useFileDrop";
import { TAB_BAR_HEIGHT, TabBar } from "./TabBar";
import { clipboardContentSize } from "../modules/clipboard/format";
import { ClipboardView } from "../modules/clipboard/ClipboardView";
import { startClipboard, useClipboard } from "../modules/clipboard/store";
import { notificationsContentSize } from "../modules/notifications/format";
import { NotificationsView } from "../modules/notifications/NotificationsView";
import { startNotifications, useNotifications } from "../modules/notifications/store";
import { ControlsView } from "../modules/controls/ControlsView";
import { controlsContentSize } from "../modules/controls/format";
import { useControls, useControlsRefresh, useOutputsOpen } from "../modules/controls/store";
import { Launcher } from "../modules/launcher/Launcher";
import { launcherSize } from "../modules/launcher/search";
import { onLauncher } from "../ipc/launcher";
import { SYSTEM_PEEK_PREFIX, useSystemPeek, useSystemPeeks } from "../modules/system/store";
import { SystemPeekView, systemPeekSize } from "../modules/system/SystemPeekView";
import { onIslandNear, onIslandRest, onIslandToggle, setIslandMemory, setIslandPassThrough, type RegionRect } from "../ipc/island";
import { useIslandRegion } from "./region";
import { useSettings } from "../settings/store";
import { startWelcome, useWelcome } from "../modules/welcome/store";
import { WELCOME_PILL_SIZE, WELCOME_SIZE, WelcomePill, WelcomeTour } from "../modules/welcome/WelcomeViews";
import { TIMER_ACTIVITY_SIZE, TimerActivity, TimerPanel, timerPanelSize } from "../modules/timer/TimerViews";
import { useTimer } from "../modules/timer/store";
import { CALENDAR_ACTIVITY_SIZE, CALENDAR_PEEK_SIZE, CalendarActivity, CalendarPanel, CalendarPeek } from "../modules/calendar/CalendarViews";
import { agenda, agendaSize, byDay } from "../modules/calendar/format";
import { startCalendar, useCalendarEvents, useNextMeeting } from "../modules/calendar/store";
import type { CalendarEvent } from "../ipc/calendar";
import { MIRROR_SIZE, MirrorView } from "../modules/mirror/MirrorView";
import { BIRTH_IMPACT_MS, DURATIONS, REGION_HOLD_MS } from "./springs";
import "./island.css";

/** The welcome's activity: above music, so a first launch is greeted. */
const WELCOME = "welcome";
/** The welcome pill appears once the island has settled after its birth. */
const WELCOME_DELAY_MS = 1500;
/** A running timer shows over the music; ringing, over almost everything. */
const TIMER_PRIORITY = 20;
const TIMER_RINGING_PRIORITY = 50;
/** A meeting coming shows over the music, below the timer. */
const CALENDAR_PRIORITY = 15;
const CALENDAR_PEEK_MS = 6000;

/** The bubble at the end of its rise, just before it meets the edge. */
const RISEN: ShellTarget = { ...BIRTH, y: 0 };
/** The bubble as it appears: below the edge, not yet painted. */
const UNBORN: ShellTarget = { ...BIRTH, fill: 0 };

/**
 * What a surface shows. The open panel shows the current tab: at home the
 * player, or the clock without music; or the shelf.
 */
function viewFor(
  surface: Surface,
  state: { tab: Tab; dragging: boolean; peekId: string | null; welcome: boolean; timer: boolean; timerSet: boolean },
  calendar: { meeting: CalendarEvent | null; shown: boolean; events: readonly CalendarEvent[] },
  hasMedia: boolean,
  onLauncherRows: (rows: number) => void,
): { key: string; content: ReactNode } {
  const { tab, dragging, peekId, welcome, timer, timerSet } = state;
  switch (surface) {
    case "launcher":
      return { key: "launcher", content: <Launcher onRows={onLauncherRows} /> };
    case "hidden":
      return { key: surface, content: null };
    case "idle":
      return { key: surface, content: <IdleClock /> };
    case "activity":
      if (welcome) return { key: "activity:welcome", content: <WelcomePill /> };
      if (timer) return { key: "activity:timer", content: <TimerActivity /> };
      if (calendar.shown && calendar.meeting) return { key: "activity:calendar", content: <CalendarActivity event={calendar.meeting} /> };
      return { key: surface, content: <MediaActivity /> };
    case "peek":
      // Peeks of different kinds crossfade; a peek updated in place does not.
      if (peekId?.startsWith(SYSTEM_PEEK_PREFIX)) return { key: `peek:${peekId}`, content: <SystemPeekView /> };
      if (peekId === CALENDAR_PEEK) return { key: "peek:calendar", content: calendar.meeting ? <CalendarPeek event={calendar.meeting} /> : null };
      return { key: "peek:media", content: <MediaPeek /> };
    case "expanded":
      // The wheels and the countdown crossfade.
      if (tab === "timer") return { key: timerSet ? "expanded:timer" : "expanded:timer-pick", content: <TimerPanel /> };
      if (tab === "mirror") return { key: "expanded:mirror", content: <MirrorView /> };
      if (tab === "calendar") return { key: "expanded:calendar", content: <CalendarPanel events={calendar.events} /> };
      if (tab === "shelf") return { key: "expanded:shelf", content: <ShelfView dragging={dragging} /> };
      if (tab === "clipboard") return { key: "expanded:clipboard", content: <ClipboardView /> };
      if (tab === "notifications") return { key: "expanded:notifications", content: <NotificationsView /> };
      if (tab === "controls") return { key: "expanded:controls", content: <ControlsView /> };
      if (welcome) return { key: "expanded:welcome", content: <WelcomeTour /> };
      return hasMedia ? { key: "expanded:media", content: <MediaExpanded /> } : { key: "expanded:clock", content: <ClockPanel /> };
  }
}

/**
 * How content enters. Blur is costly on large areas (measured: frames of
 * 50–95 ms on the 600 × 196 panel with software rendering), so the panel
 * scales in instead; small compact content keeps the blur.
 */
/** A closed island this long asks for low memory. */
const LOW_MEMORY_AFTER_MS = 4000;

const ENTER: Record<Surface, { blur: number; scale: number }> = {
  hidden: { blur: 0, scale: 1 },
  idle: { blur: 0, scale: 1 },
  activity: { blur: 8, scale: 1 },
  peek: { blur: 8, scale: 1 },
  expanded: { blur: 0, scale: 0.98 },
  launcher: { blur: 0, scale: 0.98 },
};

export function Island() {
  const [state, dispatch] = useReducer(reduce, initialState);
  const controller = useMemo(() => createIslandController(dispatch), []);
  useEffect(() => () => controller.dispose(), [controller]);

  const settings = useSettings();
  const systemReduced = useReducedMotion() ?? false;
  const motionSetting = settings.general.motion;
  const reducedMotion = motionSetting === "reduced" || (motionSetting === "system" && systemReduced);
  useEffect(() => controller.setOpenOnHover(settings.general.openOnHover), [controller, settings.general.openOnHover]);
  const [timeScale, setTimeScale] = useState(1);
  const [birth, setBirth] = useState(0);
  const [risen, setRisen] = useState(reducedMotion);
  const [debugRects, setDebugRects] = useState<RegionRect[]>([]);

  // Birth: the bubble rises, then meets the edge and becomes the island.
  useEffect(() => {
    // Reduced motion skips the birth. It can turn on after the first frame
    // (the settings arrive a moment later): the island is then born at once,
    // instead of staying a bubble forever.
    if (reducedMotion) {
      setRisen(true);
      return;
    }
    setRisen(false);
    const t = setTimeout(() => setRisen(true), BIRTH_IMPACT_MS * timeScale);
    return () => clearTimeout(t);
    // Replayed on demand from the debug panel (`birth`), not on speed changes.
  }, [birth, reducedMotion]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // StrictMode mounts effects twice in development; only the live one runs.
    let live = true;
    benchRequested().then((yes) => {
      if (yes && live) void runBench(controller, dispatch);
    });
    return () => {
      live = false;
    };
  }, [controller]);

  // A fullscreen app on the island's monitor hides it, unless the settings
  // keep it on screen. Listen first, then ask, so a change between the two
  // is not missed. The shortcut shows or hides it by hand (`forced`), until
  // the fullscreen changes: the next game hides it again.
  const hideInFullscreen = settings.general.hideInFullscreen;
  const [fullscreen, setFullscreen] = useState(false);
  const [forced, setForced] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    let unlisten: (() => void) | undefined;
    const apply = (on: boolean) => {
      if (!live) return;
      setFullscreen(on);
      setForced(null);
    };
    onFullscreen(apply)
      .then((stop) => {
        if (live) unlisten = stop;
        else stop();
        return getFullscreen();
      })
      .then(apply)
      .catch(() => {});
    return () => {
      live = false;
      unlisten?.();
    };
  }, []);
  const shown = forced ?? !(fullscreen && hideInFullscreen);
  useEffect(() => dispatch({ type: "visibility", visible: shown }), [shown]);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  // A hidden island cannot see the pointer leave.
  useEffect(() => {
    if (!state.visible) controller.resetPointer();
  }, [state.visible, controller]);

  // The launcher's shortcut, handled by the backend (it gives the island the keyboard).
  const [launcherRows, setLauncherRows] = useState(0);
  useEffect(() => {
    let live = true;
    let unlisten: (() => void) | undefined;
    onLauncher(
      () => {
        setLauncherRows(0);
        dispatch({ type: "launcher.open" });
      },
      () => dispatch({ type: "launcher.close" }),
    )
      .then((stop) => {
        if (live) unlisten = stop;
        else stop();
      })
      .catch(() => {});
    return () => {
      live = false;
      unlisten?.();
    };
  }, []);

  useFileDrop(controller);
  useMediaActivity(controller, dispatch);
  useSystemPeeks(controller);
  const systemPeek = useSystemPeek();
  const media = useMedia();
  useEffect(() => startShelf(), []);
  const shelfItems = useShelf();
  useEffect(() => startClipboard(), []);
  const clipItems = useClipboard();
  useEffect(() => startNotifications(), []);
  const notifItems = useNotifications();
  const controls = useControls();
  const outputsOpen = useOutputsOpen();

  // First launch: a welcome pill, then the tour when opened.
  useEffect(() => startWelcome(), []);
  const welcome = useWelcome();
  useEffect(() => {
    if (!welcome) {
      dispatch({ type: "activity.clear", id: WELCOME });
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "activity.set", activity: { id: WELCOME, priority: 100 } }), WELCOME_DELAY_MS);
    return () => clearTimeout(timer);
  }, [welcome]);
  const welcoming = welcome && primaryActivity(state.activities)?.id === WELCOME;

  // The timer: a live activity while it exists.
  const timer = useTimer();
  const hasTimer = timer !== null;
  const timerRinging = timer?.phase === "ringing";
  useEffect(() => {
    if (!hasTimer) {
      dispatch({ type: "activity.clear", id: TIMER_ACTIVITY });
      return;
    }
    dispatch({ type: "activity.set", activity: { id: TIMER_ACTIVITY, priority: timerRinging ? TIMER_RINGING_PRIORITY : TIMER_PRIORITY } });
  }, [hasTimer, timerRinging]);
  const timing = hasTimer && primaryActivity(state.activities)?.id === TIMER_ACTIVITY;

  // The calendar: a meeting coming is a live activity, announced once by a peek.
  useEffect(() => startCalendar(), []);
  const calendarEvents = useCalendarEvents();
  const meeting = useNextMeeting(settings.calendar.remindMinutes * 60_000);
  const meetingId = meeting?.id ?? null;
  const announced = useRef(new Set<string>());
  useEffect(() => {
    if (!meeting) {
      dispatch({ type: "activity.clear", id: CALENDAR_ACTIVITY });
      return;
    }
    dispatch({ type: "activity.set", activity: { id: CALENDAR_ACTIVITY, priority: CALENDAR_PRIORITY } });
    if (!announced.current.has(meeting.id) && meeting.start > Date.now()) {
      announced.current.add(meeting.id);
      controller.showPeek(CALENDAR_PEEK, CALENDAR_PEEK_MS);
    }
  }, [meetingId, controller]);
  const meetingShown = Boolean(meeting) && primaryActivity(state.activities)?.id === CALENDAR_ACTIVITY;
  const coming = agenda(calendarEvents, Date.now());

  const surface = surfaceOf(state);

  // Closed, the island lets clicks go to the window under it (a browser's
  // tabs); the backend says when the pointer rests on it, and it opens.
  const closed = surface === "idle" || surface === "activity" || surface === "peek" || surface === "hidden";
  const passThrough = settings.general.passThrough && closed && !state.hovered && !state.dragging;
  useEffect(() => setIslandPassThrough(passThrough), [passThrough]);
  // The pointer on it shows at once (it grows a little, as when hovered).
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!passThrough) setNear(false);
  }, [passThrough]);
  useEffect(() => {
    let live = true;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (live ? stops.push(stop) : stop());
    onIslandRest(() => controller.pointerRest()).then(keep).catch(() => {});
    onIslandNear((on) => setNear(on)).then(keep).catch(() => {});
    // The shortcut: show the island (over a game), or hide it.
    onIslandToggle(() => setForced(!shownRef.current)).then(keep).catch(() => {});
    return () => {
      live = false;
      stops.forEach((stop) => stop());
    };
  }, [controller]);

  // A closed island asks WebView2 to keep its memory low; it is back to
  // normal as soon as the island opens (and the switch costs nothing seen).
  const roomy = surface === "expanded" || surface === "launcher";
  useEffect(() => {
    if (roomy) {
      setIslandMemory(false);
      return;
    }
    const timer = setTimeout(() => setIslandMemory(true), LOW_MEMORY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [roomy]);

  const lyrics = useLyrics(media.state);
  const hasMedia = Boolean(media.state);
  // The controls are always offered: the open panel always has its tabs.
  const showTabs = surface === "expanded";
  useControlsRefresh(surface === "expanded", surface === "expanded" && state.tab === "controls");
  let size = mediaSize(surface, media.state, lyricsKind(lyrics));
  if (surface === "peek" && state.peek?.id.startsWith(SYSTEM_PEEK_PREFIX)) size = systemPeekSize(systemPeek);
  if (surface === "launcher") size = launcherSize(launcherRows);
  if (surface === "activity" && welcoming) size = WELCOME_PILL_SIZE;
  if (surface === "activity" && timing) size = TIMER_ACTIVITY_SIZE;
  if (surface === "activity" && meetingShown) size = CALENDAR_ACTIVITY_SIZE;
  if (surface === "peek" && state.peek?.id === CALENDAR_PEEK) size = CALENDAR_PEEK_SIZE;
  if (surface === "expanded") {
    const [w, h, r] =
      state.tab === "mirror"
        ? MIRROR_SIZE
        : state.tab === "calendar"
        ? agendaSize(byDay(coming, Date.now()).length, coming.length)
        : state.tab === "timer"
        ? timerPanelSize(timer)
        : state.tab === "shelf"
          ? [...shelfContentSize(shelfItems.length), 26]
          : state.tab === "clipboard"
            ? [...clipboardContentSize(clipItems.length), 26]
            : state.tab === "notifications"
              ? [...notificationsContentSize(notifItems.length), 26]
              : state.tab === "controls"
                ? [...controlsContentSize(controls?.apps.length ?? 0, outputsOpen), 26]
                : welcoming
                  ? WELCOME_SIZE
                  : hasMedia
                    ? (size ?? CLOCK_PANEL_SIZE)
                    : CLOCK_PANEL_SIZE;
    size = showTabs ? [Math.max(w, 300), h + TAB_BAR_HEIGHT, r] : [w, h, r];
  }
  const target = risen ? targetFor(surface, state.hovered || (near && passThrough), size) : RISEN;
  const viewSize = targetFor(surface, false, size);
  const tabOffset = showTabs ? TAB_BAR_HEIGHT : 0;

  const islandBox = targetBox(risen ? target : BIRTH, window.innerWidth);
  useIslandRegion(islandBox ? [islandBox, ...debugRects] : debugRects, REGION_HOLD_MS);

  const view = viewFor(
    surface,
    { tab: state.tab, dragging: state.dragging, peekId: state.peek?.id ?? null, welcome: welcoming, timer: timing, timerSet: hasTimer },
    { meeting, shown: meetingShown, events: calendarEvents },
    hasMedia,
    setLauncherRows,
  );
  const content = risen ? view.content : null;
  const ease = [0.33, 1, 0.68, 1] as const;

  return (
    <div className="island-stage">
      <IslandShell
        key={birth}
        target={target}
        initial={reducedMotion ? target : UNBORN}
        timeScale={timeScale}
        reducedMotion={reducedMotion}
        onPointerEnter={controller.pointerEnter}
        onPointerLeave={controller.pointerLeave}
        onPress={controller.press}
      >
        <AnimatePresence initial={false}>
          {showTabs && (
            <motion.div
              key="tabs"
              className="island-view"
              style={{ width: viewSize.width, height: TAB_BAR_HEIGHT, x: "-50%" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: DURATIONS.contentIn * timeScale, delay: DURATIONS.contentInDelay * timeScale } }}
              exit={{ opacity: 0, transition: { duration: DURATIONS.contentOut * timeScale } }}
            >
              <TabBar
                tab={state.tab}
                hasMedia={hasMedia}
                counts={{ shelf: shelfItems.length, clipboard: clipItems.length, notifications: notifItems.length, calendar: coming.length }}
                order={settings.tabs.order}
                hidden={settings.tabs.hidden}
                onSelect={(tab) => dispatch({ type: "tab.select", tab })}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {content && (
            <motion.div
              key={view.key}
              className="island-view"
              style={{ top: tabOffset, width: viewSize.width, height: viewSize.height - tabOffset, x: "-50%" }}
              initial={{ opacity: 0, y: 4, scale: ENTER[surface].scale, filter: `blur(${ENTER[surface].blur}px)` }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                filter: "blur(0px)",
                transition: {
                  duration: DURATIONS.contentIn * timeScale,
                  delay: DURATIONS.contentInDelay * timeScale,
                  ease,
                },
              }}
              exit={{ opacity: 0, transition: { duration: DURATIONS.contentOut * timeScale } }}
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>
      </IslandShell>

      {DebugPanel && (
        <Suspense fallback={null}>
          <DebugPanel
          state={state}
          surface={surface}
          controller={controller}
          dispatch={dispatch}
          timeScale={timeScale}
          onTimeScale={setTimeScale}
          onRebirth={() => setBirth((b) => b + 1)}
          islandBox={islandBox}
          onRects={setDebugRects}
          />
        </Suspense>
      )}
    </div>
  );
}
