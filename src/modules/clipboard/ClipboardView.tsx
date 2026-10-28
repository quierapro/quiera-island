import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as clip from "../../ipc/clipboard";
import type { ClipItem } from "../../ipc/clipboard";
import { CloseIcon } from "../shelf/icons";
import { ordered, timeAgo } from "./format";
import { CheckIcon, ClipboardIcon, LinkIcon, PinIcon } from "./icons";
import { useClipboard } from "./store";
import "./clipboard.css";

const ignore = () => {};

/** How long a card says "Copié" after a click. */
const COPIED_MS = 1100;

/** The time, refreshed every half minute for "il y a 2 min". */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function Body({ item }: { item: ClipItem }) {
  if (item.kind === "image" && item.thumbnail) {
    return <img className="clip-image" src={item.thumbnail} alt={item.preview} draggable={false} />;
  }
  if (item.kind === "link") {
    return (
      <div className="clip-link">
        <span className="clip-host">
          <LinkIcon size={12} />
          {item.host}
        </span>
        <span className="clip-url">{item.preview}</span>
      </div>
    );
  }
  return <p className="clip-text">{item.preview}</p>;
}

function Card({ item, now }: { item: ClipItem; now: number }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <motion.div
      layout
      className={`clip-card ${item.pinned ? "clip-card--pinned" : ""}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      title={item.kind === "image" ? item.preview : undefined}
      onClick={(e) => {
        e.stopPropagation();
        clip
          .copyItem(item.id)
          .then(() => {
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), COPIED_MS);
          })
          .catch(ignore);
      }}
    >
      <div className="clip-body">
        <Body item={item} />
      </div>
      <div className="clip-foot">
        {item.pinned && <PinIcon size={10} filled />}
        <span>{item.kind === "image" ? item.preview : timeAgo(item.copiedAt, now)}</span>
      </div>
      <div className="clip-actions">
        <button
          aria-label={item.pinned ? "Désépingler" : "Épingler"}
          className={item.pinned ? "clip-action--on" : ""}
          onPointerDown={stop}
          onClick={(e) => {
            stop(e);
            clip.pinItem(item.id, !item.pinned).catch(ignore);
          }}
        >
          <PinIcon size={11} filled={item.pinned} />
        </button>
        <button
          aria-label="Retirer de l'historique"
          onPointerDown={stop}
          onClick={(e) => {
            stop(e);
            clip.removeClip(item.id).catch(ignore);
          }}
        >
          <CloseIcon size={9} />
        </button>
      </div>
      <AnimatePresence>
        {copied && (
          <motion.div
            className="clip-copied"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <CheckIcon size={16} />
            Copié
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** The Clipboard tab: what was copied during this session. */
export function ClipboardView() {
  const items = ordered(useClipboard());
  const now = useNow();
  const row = useRef<HTMLDivElement>(null);

  if (items.length === 0) {
    return (
      <div className="clip-empty">
        <ClipboardIcon size={22} />
        <span>Ce que tu copies apparaîtra ici</span>
      </div>
    );
  }

  const unpinned = items.some((i) => !i.pinned);
  return (
    <div className="clip">
      <div className="clip-head">
        <span className="clip-count">
          {items.length} {items.length > 1 ? "éléments" : "élément"}
        </span>
        {unpinned && (
          <button
            className="clip-clear"
            title="Les éléments épinglés restent"
            onClick={(e) => {
              e.stopPropagation();
              clip.clearClipboard().catch(ignore);
            }}
          >
            Vider
          </button>
        )}
      </div>
      <div
        ref={row}
        className="clip-row"
        // A mouse wheel scrolls the row sideways.
        onWheel={(e) => {
          if (row.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) row.current.scrollLeft += e.deltaY;
        }}
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <Card key={item.id} item={item} now={now} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
