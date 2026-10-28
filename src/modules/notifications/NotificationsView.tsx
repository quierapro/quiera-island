import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as notif from "../../ipc/notifications";
import type { NotificationItem } from "../../ipc/notifications";
import { CloseIcon } from "../shelf/icons";
import { BellIcon } from "./icons";
import { arrivedLabel, splitLinks } from "./format";
import { useNotifications } from "./store";
import "./notifications.css";

const ignore = () => {};

/** Text with its web links clickable (opened in the browser). */
export function Linked({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.url ? (
          <a
            key={i}
            className="notif-link"
            href={part.url}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              notif.openLink(part.url!).catch(ignore);
            }}
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** The app's icon, or its initial when it has none. */
export function AppIcon({ item, size }: { item: Pick<NotificationItem, "app" | "icon">; size: number }) {
  const [failed, setFailed] = useState(false);
  return item.icon && !failed ? (
    <img className="notif-icon" src={item.icon} alt="" width={size} height={size} draggable={false} onError={() => setFailed(true)} />
  ) : (
    <span className="notif-icon notif-icon--letter" style={{ width: size, height: size }}>
      {item.app.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Row({ item, now }: { item: NotificationItem; now: number }) {
  return (
    <motion.div
      layout
      className="notif-row"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      title={`Ouvrir ${item.app}`}
      onClick={(e) => {
        e.stopPropagation();
        notif.openNotification(item.id).catch(ignore);
      }}
    >
      <AppIcon item={item} size={32} />
      <div className="notif-content">
        <div className="notif-meta">
          <span className="notif-app">{item.app}</span>
          <span className="notif-time">{arrivedLabel(item.arrivedAt, now)}</span>
        </div>
        {item.title && <div className="notif-title">{item.title}</div>}
        {item.body && (
          <div className="notif-body">
            <Linked text={item.body} />
          </div>
        )}
      </div>
      <button
        className="notif-dismiss"
        aria-label="Fermer la notification"
        onClick={(e) => {
          e.stopPropagation();
          notif.dismissNotification(item.id).catch(ignore);
        }}
      >
        <CloseIcon size={9} />
      </button>
    </motion.div>
  );
}

/** The Notifications tab: what arrived during this session. */
export function NotificationsView() {
  const items = useNotifications();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (items.length === 0) {
    return (
      <div className="notif-empty">
        <BellIcon size={22} />
        <span>Aucune notification</span>
      </div>
    );
  }

  return (
    <div className="notif">
      <div className="notif-head">
        <span className="notif-count">
          {items.length} {items.length > 1 ? "notifications" : "notification"}
        </span>
        <button
          className="notif-clear"
          onClick={(e) => {
            e.stopPropagation();
            notif.clearNotifications().catch(ignore);
          }}
        >
          Tout effacer
        </button>
      </div>
      <div className="notif-list">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <Row key={item.id} item={item} now={now} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
