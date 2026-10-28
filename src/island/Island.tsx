import { useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createIslandController } from "../machine/controller";
import { initialState, reduce, surfaceOf, type Surface, type Tab } from "../machine/island-machine";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { benchRequested, runBench } from "../dev/bench";
import { DebugPanel } from "../dev/DebugPanel";
import type { RegionRect } from "../ipc/island";
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
import { TAB_BAR_HEIGHT, TabBar } from "./TabBar";
import { useIslandRegion } from "./region";
import { BIRTH_IMPACT_MS, DURATIONS, REGION_HOLD_MS } from "./springs";
import "./island.css";

/** The bubble at the end of its rise, just before it meets the edge. */
const RISEN: ShellTarget = { ...BIRTH, y: 0 };
/** The bubble as it appears: below the edge, not yet painted. */
const UNBORN: ShellTarget = { ...BIRTH, fill: 0 };

/**
 * What a surface shows. The open panel shows the current tab: at home the
 * player, or the clock without music; or the shelf.
 */
function viewFor(surface: Surface, tab: Tab, hasMedia: boolean, dragging: boolean): { key: string; content: ReactNode } {
  switch (surface) {
    case "hidden":
      return { key: surface, content: null };
    case "idle":
      return { key: surface, content: <IdleClock /> };
    case "activity":
      return { key: surface, content: <MediaActivity /> };
    case "peek":
      return { key: surface, content: <MediaPeek /> };
    case "expanded":
      if (tab === "shelf") return { key: "expanded:shelf", content: <ShelfView dragging={dragging} /> };
      return hasMedia ? { key: "expanded:media", content: <MediaExpanded /> } : { key: "expanded:clock", content: <ClockPanel /> };
  }
}

/**
 * How content enters. Blur is costly on large areas (measured: frames of
 * 50–95 ms on the 600 × 196 panel with software rendering), so the panel
 * scales in instead; small compact content keeps the blur.
 */
const ENTER: Record<Surface, { blur: number; scale: number }> = {
  hidden: { blur: 0, scale: 1 },
  idle: { blur: 0, scale: 1 },
  activity: { blur: 8, scale: 1 },
  peek: { blur: 8, scale: 1 },
  expanded: { blur: 0, scale: 0.98 },
};

export function Island() {
  const [state, dispatch] = useReducer(reduce, initialState);
  const controller = useMemo(() => createIslandController(dispatch), []);
  useEffect(() => () => controller.dispose(), [controller]);

  const reducedMotion = useReducedMotion() ?? false;
  const [timeScale, setTimeScale] = useState(1);
  const [birth, setBirth] = useState(0);
  const [risen, setRisen] = useState(reducedMotion);
  const [debugRects, setDebugRects] = useState<RegionRect[]>([]);

  // Birth: the bubble rises, then meets the edge and becomes the island.
  useEffect(() => {
    if (reducedMotion) return;
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

  // A fullscreen app on the island's monitor hides it. Listen first, then
  // ask, so a change between the two is not missed.
  useEffect(() => {
    let live = true;
    let unlisten: (() => void) | undefined;
    const apply = (fullscreen: boolean) => dispatch({ type: "visibility", visible: !fullscreen });
    onFullscreen((on) => live && apply(on))
      .then((stop) => {
        if (live) unlisten = stop;
        else stop();
        return getFullscreen();
      })
      .then((on) => live && apply(on))
      .catch(() => {});
    return () => {
      live = false;
      unlisten?.();
    };
  }, []);

  // A hidden island cannot see the pointer leave.
  useEffect(() => {
    if (!state.visible) controller.resetPointer();
  }, [state.visible, controller]);

  // Files dragged from another app over the island (Tauri's drop events;
  // the files themselves are added to the shelf by the backend).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let live = true;
    try {
      getCurrentWebview()
        .onDragDropEvent(({ payload }) => {
          if (payload.type === "enter" && payload.paths.length > 0) controller.dragEnter();
          else if (payload.type === "leave") controller.dragLeave();
          else if (payload.type === "drop") controller.dragDrop();
        })
        .then((stop) => {
          if (live) unlisten = stop;
          else stop();
        })
        .catch(() => {});
    } catch {
      // Not running inside Tauri (plain browser preview).
    }
    return () => {
      live = false;
      unlisten?.();
    };
  }, [controller]);

  useMediaActivity(controller, dispatch);
  const media = useMedia();
  useEffect(() => startShelf(), []);
  const shelfItems = useShelf();

  const surface = surfaceOf(state);
  const lyrics = useLyrics(media.state);
  const hasMedia = Boolean(media.state);
  // The tab bar shows once the shelf has something, or while it is shown.
  const showTabs = surface === "expanded" && (shelfItems.length > 0 || state.tab === "shelf");
  let size = mediaSize(surface, media.state, lyricsKind(lyrics));
  if (surface === "expanded") {
    const [w, h, r] =
      state.tab === "shelf"
        ? [...shelfContentSize(shelfItems.length), 26]
        : hasMedia
          ? (size ?? CLOCK_PANEL_SIZE)
          : CLOCK_PANEL_SIZE;
    size = showTabs ? [Math.max(w, 300), h + TAB_BAR_HEIGHT, r] : [w, h, r];
  }
  const target = risen ? targetFor(surface, state.hovered, size) : RISEN;
  const viewSize = targetFor(surface, false, size);
  const tabOffset = showTabs ? TAB_BAR_HEIGHT : 0;

  const islandBox = targetBox(risen ? target : BIRTH, window.innerWidth);
  useIslandRegion(islandBox ? [islandBox, ...debugRects] : debugRects, REGION_HOLD_MS);

  const view = viewFor(surface, state.tab, hasMedia, state.dragging);
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
                shelfCount={shelfItems.length}
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

      {import.meta.env.DEV && (
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
      )}
    </div>
  );
}
