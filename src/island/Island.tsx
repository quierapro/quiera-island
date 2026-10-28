import { useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createIslandController } from "../machine/controller";
import { initialState, reduce, surfaceOf, type Surface } from "../machine/island-machine";
import { benchRequested, runBench } from "../dev/bench";
import { DebugPanel } from "../dev/DebugPanel";
import type { RegionRect } from "../ipc/island";
import { getFullscreen, onFullscreen } from "../ipc/system";
import { BIRTH, targetBox, targetFor, type ShellTarget } from "./geometry";
import { IslandShell } from "./IslandShell";
import { ActivityPlaceholder, ExpandedPlaceholder, PeekPlaceholder } from "./placeholders";
import { useIslandRegion } from "./region";
import { BIRTH_IMPACT_MS, DURATIONS, REGION_HOLD_MS } from "./springs";
import "./island.css";

/** The bubble at the end of its rise, just before it meets the edge. */
const RISEN: ShellTarget = { ...BIRTH, y: 0 };
/** The bubble as it appears: below the edge, not yet painted. */
const UNBORN: ShellTarget = { ...BIRTH, fill: 0 };

const VIEWS: Record<Surface, (() => ReactNode) | null> = {
  hidden: null,
  idle: null,
  activity: ActivityPlaceholder,
  peek: PeekPlaceholder,
  expanded: ExpandedPlaceholder,
};

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

  const surface = surfaceOf(state);
  const target = risen ? targetFor(surface, state.hovered) : RISEN;
  const viewSize = targetFor(surface, false);

  const islandBox = targetBox(risen ? target : BIRTH, window.innerWidth);
  useIslandRegion(islandBox ? [islandBox, ...debugRects] : debugRects, REGION_HOLD_MS);

  const View = risen ? VIEWS[surface] : null;
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
          {View && (
            <motion.div
              key={surface}
              className="island-view"
              style={{ width: viewSize.width, height: viewSize.height, x: "-50%" }}
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
              <View />
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
