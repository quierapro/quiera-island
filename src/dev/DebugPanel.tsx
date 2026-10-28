/**
 * Development-only controls for the island's states and motion. Rendered at
 * the bottom of the island window; its own rectangle is added to the window
 * region so it can be clicked. Never shipped: `import.meta.env.DEV` only.
 */
import { useEffect, useRef, useState, type Dispatch } from "react";
import type { IslandController } from "../machine/controller";
import type { IslandEvent, IslandState, Surface } from "../machine/island-machine";
import type { RegionRect } from "../ipc/island";
import type { Box } from "../island/geometry";
import "./debug.css";

interface DebugPanelProps {
  state: IslandState;
  surface: Surface;
  controller: IslandController;
  dispatch: Dispatch<IslandEvent>;
  timeScale: number;
  onTimeScale(scale: number): void;
  onRebirth(): void;
  islandBox: Box | null;
  onRects(rects: RegionRect[]): void;
}

const MEDIA = { id: "media", priority: 10 };

export function DebugPanel(p: DebugPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const peeks = useRef(0);
  const [outline, setOutline] = useState(false);
  const { onRects } = p;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      onRects([{ x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) }]);
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    window.addEventListener("resize", report);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", report);
    };
  }, [onRects]);

  const hasMedia = p.state.activities.some((a) => a.id === MEDIA.id);

  return (
    <>
      {outline && p.islandBox && (
        <div
          className="debug-outline"
          style={{ left: p.islandBox.x, top: p.islandBox.y, width: p.islandBox.width, height: p.islandBox.height }}
        />
      )}
      <div ref={ref} className="debug-panel">
        <div className="debug-state">
          <b>{p.surface}</b>
          {p.state.hovered && <span>survol</span>}
          {p.state.peek?.expired && <span>aperçu expiré</span>}
          {p.timeScale !== 1 && <span>×{p.timeScale}</span>}
        </div>
        <div className="debug-buttons">
          <button onClick={() => p.controller.showPeek(`peek-${++peeks.current}`)}>Aperçu</button>
          <button
            onClick={() =>
              p.dispatch(hasMedia ? { type: "activity.clear", id: MEDIA.id } : { type: "activity.set", activity: MEDIA })
            }
          >
            {hasMedia ? "Arrêter musique" : "Musique"}
          </button>
          <button onClick={() => p.dispatch({ type: "press" })}>Ouvrir</button>
          <button onClick={() => p.dispatch({ type: "close" })}>Fermer</button>
          <button onClick={() => p.dispatch({ type: "visibility", visible: !p.state.visible })}>
            {p.state.visible ? "Masquer" : "Afficher"}
          </button>
          <button onClick={() => p.onTimeScale(p.timeScale === 1 ? 4 : 1)}>Ralenti</button>
          <button onClick={() => setOutline((o) => !o)}>Région</button>
          <button onClick={p.onRebirth}>Naissance</button>
        </div>
      </div>
    </>
  );
}
