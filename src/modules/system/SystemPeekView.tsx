import { motion } from "motion/react";
import type { SystemPeek } from "../../ipc/peeks";
import type { Size } from "../../island/geometry";
import { CheckIcon, LinkIcon } from "../clipboard/icons";
import { useSystemPeek } from "./store";
import "./system.css";

/** Each peek's size: as small as its content allows. */
export function systemPeekSize(peek: SystemPeek | null): Size {
  switch (peek?.kind) {
    case "power":
      return [290, 40, 20];
    case "audioDevice":
      return [330, 50, 25];
    case "capsLock":
      return [220, 38, 19];
    case "volume":
      return [290, 38, 19];
    case "copied":
      return [300, 40, 20];
    default:
      return [240, 38, 19];
  }
}

const spring = { type: "spring", stiffness: 380, damping: 30 } as const;

function BatteryGlyph({ percent, charging }: { percent: number | null; charging: boolean }) {
  const fill = Math.max(0.06, (percent ?? 100) / 100);
  return (
    <span className={`peek-battery ${charging ? "peek-battery--charging" : ""}`} aria-hidden="true">
      <span className="peek-battery-body">
        <motion.span
          className="peek-battery-fill"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: fill }}
          transition={{ ...spring, delay: 0.1 }}
        />
      </span>
      <span className="peek-battery-tip" />
      {charging && (
        <motion.svg
          className="peek-bolt"
          viewBox="0 0 24 24"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.18 }}
        >
          <path d="M13.5 2 5 13.2h6L9.8 22 19 10.5h-6.2L13.5 2Z" />
        </motion.svg>
      )}
    </span>
  );
}

function Power({ plugged, percent }: { plugged: boolean; percent: number | null }) {
  return (
    <div className="peek-row">
      <BatteryGlyph percent={percent} charging={plugged} />
      <span className="peek-title">{plugged ? "En charge" : "Sur batterie"}</span>
      {percent !== null && <span className={`peek-value ${plugged ? "peek-value--good" : ""}`}>{percent} %</span>}
    </div>
  );
}

function DeviceGlyph({ form }: { form: string }) {
  const headphones = form === "headphones" || form === "headset";
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {headphones ? (
        <path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2v-3Zm16 0a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2v-3Z" />
      ) : (
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5ZM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
      )}
    </svg>
  );
}

/** Battery as a ring, filled to the level, like a watch complication. */
function BatteryRing({ percent }: { percent: number }) {
  const r = 12;
  const length = 2 * Math.PI * r;
  const low = percent <= 20;
  return (
    <span className="peek-ring" aria-label={`Batterie ${percent} %`}>
      <svg viewBox="0 0 30 30" width="30" height="30">
        <circle cx="15" cy="15" r={r} className="peek-ring-track" />
        <motion.circle
          cx="15"
          cy="15"
          r={r}
          className={`peek-ring-fill ${low ? "peek-ring-fill--low" : ""}`}
          strokeDasharray={length}
          initial={{ strokeDashoffset: length }}
          animate={{ strokeDashoffset: length * (1 - percent / 100) }}
          transition={{ ...spring, delay: 0.12 }}
        />
      </svg>
      <span className="peek-ring-text">{percent}</span>
    </span>
  );
}

function AudioDevice({ name, form, battery }: { name: string; form: string; battery: number | null }) {
  return (
    <div className="peek-row">
      <span className="peek-icon">
        <DeviceGlyph form={form} />
      </span>
      <span className="peek-text">
        <span className="peek-caption">Connecté</span>
        <span className="peek-title peek-title--ellipsis">{name}</span>
      </span>
      {battery !== null && <BatteryRing percent={battery} />}
    </div>
  );
}

function CapsLock({ on }: { on: boolean }) {
  return (
    <div className="peek-row">
      <span className="peek-key" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M12 4 4.5 12H9v5h6v-5h4.5L12 4ZM9 20h6" />
        </svg>
      </span>
      <span className="peek-title">Verr. Maj</span>
      <motion.span
        className={`peek-dot ${on ? "peek-dot--on" : ""}`}
        initial={{ scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 20 }}
      />
    </div>
  );
}

function Volume({ level, muted }: { level: number; muted: boolean }) {
  const shown = muted ? 0 : level;
  return (
    <div className="peek-row">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
        {muted ? (
          <path d="m16 9.5 5 5m0-5-5 5" />
        ) : (
          <>
            {shown > 0 && <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />}
            {shown > 50 && <path d="M18 7a7 7 0 0 1 0 10" />}
          </>
        )}
      </svg>
      <span className="peek-bar">
        <motion.span className="peek-bar-fill" animate={{ scaleX: shown / 100 }} transition={spring} />
      </span>
      <span className="peek-value">{shown}</span>
    </div>
  );
}

/** Something was copied: a check, then what. */
function Copied({ content, preview, thumbnail }: { content: string; preview: string; thumbnail: string | null }) {
  return (
    <div className="peek-row">
      <motion.span
        className="peek-copied"
        initial={{ scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 20 }}
      >
        <CheckIcon size={13} />
      </motion.span>
      <span className="peek-text">
        <span className="peek-caption">Copié</span>
        <span className="peek-snippet">
          {content === "link" && <LinkIcon size={11} />}
          <span className="peek-snippet-text">{preview}</span>
        </span>
      </span>
      {thumbnail && <img className="peek-thumb" src={thumbnail} alt="" draggable={false} />}
    </div>
  );
}

/** The peek for whatever the system just announced. */
export function SystemPeekView() {
  const peek = useSystemPeek();
  if (!peek) return null;
  switch (peek.kind) {
    case "power":
      return <Power plugged={peek.plugged} percent={peek.percent} />;
    case "audioDevice":
      return <AudioDevice name={peek.name} form={peek.form} battery={peek.battery} />;
    case "capsLock":
      return <CapsLock on={peek.on} />;
    case "volume":
      return <Volume level={peek.level} muted={peek.muted} />;
    case "copied":
      return <Copied content={peek.content} preview={peek.preview} thumbnail={peek.thumbnail} />;
  }
}
