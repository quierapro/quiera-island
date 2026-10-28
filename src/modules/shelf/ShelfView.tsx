import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import * as shelf from "../../ipc/shelf";
import type { ShelfItem } from "../../ipc/shelf";
import { formatSize } from "./format";
import { CloseIcon, TrayIcon } from "./icons";
import { useShelf } from "./store";
import "./shelf.css";

const ignore = () => {};

/** Moving this far with the button down starts dragging the item out. */
const DRAG_THRESHOLD = 5;

function Tile({ item }: { item: ShelfItem }) {
  const icon = useRef<Promise<string> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const [failed, setFailed] = useState(false);

  // Prepared on hover so the drag starts without waiting. Without a
  // thumbnail, the file itself stands in (works for images).
  const prepareIcon = () => {
    icon.current ??= shelf.dragIcon(item.id).catch(() => item.path);
  };

  return (
    <motion.div
      layout
      className="shelf-tile"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      title={item.path}
      onPointerEnter={prepareIcon}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY };
        dragged.current = false;
      }}
      onPointerMove={(e) => {
        const from = start.current;
        if (!from || dragged.current) return;
        if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_THRESHOLD) return;
        dragged.current = true;
        start.current = null;
        prepareIcon();
        // Copy, never move: dropping on a folder must not take the file away.
        icon
          .current!.then((iconPath) => startDrag({ item: [item.path], icon: iconPath, mode: "copy" }))
          .catch(ignore);
      }}
      onPointerUp={() => {
        if (start.current && !dragged.current) shelf.openItem(item.id).catch(ignore);
        start.current = null;
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        shelf.revealItem(item.id).catch(ignore);
      }}
    >
      <div className={`shelf-thumb shelf-thumb--${item.kind}`}>
        {!failed && <img src={item.thumbnail} alt="" draggable={false} onError={() => setFailed(true)} />}
        <button
          className="shelf-remove"
          aria-label="Retirer du Shelf"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            shelf.removeItem(item.id).catch(ignore);
          }}
        >
          <CloseIcon size={10} />
        </button>
      </div>
      <span className="shelf-name">{item.name}</span>
      {item.size !== null && <span className="shelf-size">{formatSize(item.size)}</span>}
    </motion.div>
  );
}

/** The Shelf tab: the files kept here, or where to drop them. */
export function ShelfView({ dragging }: { dragging: boolean }) {
  const items = useShelf();
  const row = useRef<HTMLDivElement>(null);

  if (items.length === 0) {
    return (
      <div className={`shelf-empty ${dragging ? "shelf-empty--target" : ""}`}>
        <TrayIcon size={22} />
        <span>{dragging ? "Dépose tes fichiers ici" : "Glisse des fichiers sur l'île pour les garder ici"}</span>
      </div>
    );
  }

  return (
    <div className={`shelf ${dragging ? "shelf--target" : ""}`}>
      <div className="shelf-head">
        <span className="shelf-count">
          {items.length} {items.length > 1 ? "éléments" : "élément"}
        </span>
        <button
          className="shelf-clear"
          onClick={(e) => {
            e.stopPropagation();
            shelf.clearShelf().catch(ignore);
          }}
        >
          Vider
        </button>
      </div>
      <div
        ref={row}
        className="shelf-row"
        // A mouse wheel scrolls the row sideways.
        onWheel={(e) => {
          if (row.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) row.current.scrollLeft += e.deltaY;
        }}
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <Tile key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
