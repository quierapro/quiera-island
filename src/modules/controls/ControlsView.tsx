import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as ctl from "../../ipc/controls";
import type { Controls, RadioKind } from "../../ipc/controls";
import { levelAt, shownLevel } from "./format";
import { BluetoothIcon, HeadphonesIcon, SpeakerIcon, WifiIcon } from "./icons";
import { refreshControls, setOutputsOpen, useControls, useOutputsOpen } from "./store";
import "./controls.css";

const ignore = () => {};
/** Volume changes sent while dragging, at most this often. */
const SEND_MS = 50;
const spring = { type: "spring", stiffness: 520, damping: 38 } as const;

const RADIOS: Record<RadioKind, { label: string; icon: ReactNode }> = {
  wifi: { label: "Wi-Fi", icon: <WifiIcon size={17} /> },
  bluetooth: { label: "Bluetooth", icon: <BluetoothIcon size={17} /> },
};

function Toggle({ kind, on }: { kind: RadioKind; on: boolean }) {
  const [pending, setPending] = useState<boolean | null>(null);
  const shown = pending ?? on;
  return (
    <motion.button
      className={`ctl-toggle ${shown ? "ctl-toggle--on" : ""}`}
      aria-pressed={shown}
      whileTap={{ scale: 0.96 }}
      transition={spring}
      onClick={(e) => {
        e.stopPropagation();
        setPending(!shown);
        ctl
          .setRadio(kind, !shown)
          .catch(ignore)
          .finally(() => {
            refreshControls();
            // The radio takes a moment to report its new state.
            setTimeout(() => setPending(null), 1500);
          });
      }}
    >
      <span className="ctl-toggle-icon">{RADIOS[kind].icon}</span>
      <span className="ctl-toggle-text">
        <span className="ctl-toggle-label">{RADIOS[kind].label}</span>
        <span className="ctl-toggle-state">{shown ? "Activé" : "Désactivé"}</span>
      </span>
    </motion.button>
  );
}

/**
 * A volume as a pill to drag anywhere on, filled to its level, with its
 * label inside. Sends while dragging (without flooding) and on release.
 */
function PillSlider({
  level,
  muted,
  label,
  big = false,
  onLevel,
  children,
}: {
  level: number;
  muted: boolean;
  label: string;
  big?: boolean;
  onLevel(level: number): void;
  children: ReactNode;
}) {
  const [local, setLocal] = useState<{ level: number; at: number }>();
  const [dragging, setDragging] = useState(false);
  const last = useRef(0);
  const value = muted ? 0 : shownLevel(level, local, Date.now());

  const set = (e: React.PointerEvent<HTMLDivElement>, force: boolean) => {
    const box = e.currentTarget.getBoundingClientRect();
    const next = levelAt(e.clientX, box.left, box.width);
    setLocal({ level: next, at: Date.now() });
    if (force || Date.now() - last.current >= SEND_MS) {
      last.current = Date.now();
      onLevel(next);
    }
  };

  return (
    <div
      className={`ctl-pill ${big ? "ctl-pill--big" : ""} ${muted ? "ctl-pill--muted" : ""} ${dragging ? "ctl-pill--drag" : ""}`}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      tabIndex={0}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        set(e, false);
      }}
      onPointerMove={(e) => dragging && set(e, false)}
      onPointerUp={(e) => {
        if (!dragging) return;
        setDragging(false);
        set(e, true);
      }}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 5 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -5 : 0;
        if (!step) return;
        e.preventDefault();
        const next = Math.min(Math.max(value + step, 0), 100);
        setLocal({ level: next, at: Date.now() });
        onLevel(next);
      }}
    >
      <span className="ctl-pill-fill" style={{ width: `${value}%` }} />
      <span className="ctl-pill-content">
        {children}
        <span className="ctl-pill-value">{muted ? "Coupé" : value}</span>
      </span>
    </div>
  );
}

function OutputIcon({ form, size = 15 }: { form: string; size?: number }) {
  return form === "headphones" || form === "headset" ? <HeadphonesIcon size={size} /> : <SpeakerIcon size={size} />;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <motion.svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" animate={{ rotate: open ? 180 : 0 }} transition={spring} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </motion.svg>
  );
}

function AppIcon({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="ctl-app-icon ctl-app-icon--letter">{name.slice(0, 1).toUpperCase()}</span>
  ) : (
    <img className="ctl-app-icon" src={src} alt="" draggable={false} onError={() => setFailed(true)} />
  );
}

function OutputList({ outputs }: { outputs: Controls["outputs"] }) {
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <div className="ctl-list">
      {outputs.map((o) => {
        const active = chosen ? chosen === o.id : o.default;
        return (
          <motion.button
            key={o.id}
            layout="position"
            className={`ctl-output ${active ? "ctl-output--on" : ""}`}
            title={o.name}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation();
              setChosen(o.id);
              ctl
                .setOutput(o.id)
                .catch(ignore)
                .finally(() => {
                  refreshControls();
                  setTimeout(() => {
                    setChosen(null);
                    setOutputsOpen(false);
                  }, 350);
                });
            }}
          >
            <OutputIcon form={o.form} />
            <span className="ctl-output-name">{o.name}</span>
            {active && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function AppList({ apps }: { apps: Controls["apps"] }) {
  return (
    <div className="ctl-list">
      <AnimatePresence initial={false}>
        {apps.map((a) => (
          <motion.div
            key={a.key}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring}
          >
            <PillSlider level={a.level} muted={a.muted} label={`Volume de ${a.name}`} onLevel={(l) => ctl.setAppVolume(a.key, l).catch(ignore)}>
              <button
                className="ctl-pill-icon"
                title={a.muted ? `Réactiver ${a.name}` : `Couper ${a.name}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  ctl.setAppMute(a.key, !a.muted).catch(ignore).finally(refreshControls);
                }}
              >
                <AppIcon src={a.icon} name={a.name} />
              </button>
              <span className="ctl-pill-label">{a.name}</span>
            </PillSlider>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** The Controls tab: radios, audio output, master and app volumes. */
export function ControlsView() {
  const controls = useControls();
  const outputsOpen = useOutputsOpen();
  if (!controls) return <div className="ctl" />;
  const { radios, outputs, volume, apps } = controls;
  const current = outputs.find((o) => o.default);

  return (
    <div className="ctl">
      <div className="ctl-toggles">
        {radios.map((r) => (
          <Toggle key={r.kind} kind={r.kind} on={r.on} />
        ))}
      </div>

      {outputs.length > 0 && (
        <motion.button
          className={`ctl-current ${outputsOpen ? "ctl-current--open" : ""}`}
          whileTap={{ scale: 0.98 }}
          transition={spring}
          onClick={(e) => {
            e.stopPropagation();
            setOutputsOpen(!outputsOpen);
          }}
        >
          {current && <OutputIcon form={current.form} />}
          <span className="ctl-current-label">Sortie</span>
          <span className="ctl-current-name">{current?.name ?? "Aucune"}</span>
          <Chevron open={outputsOpen} />
        </motion.button>
      )}

      {volume && (
        <PillSlider big level={volume.level} muted={volume.muted} label="Volume" onLevel={(l) => ctl.setVolume(l).catch(ignore)}>
          <button
            className="ctl-pill-icon"
            aria-label={volume.muted ? "Réactiver le son" : "Couper le son"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              ctl.setMute(!volume.muted).catch(ignore).finally(refreshControls);
            }}
          >
            <SpeakerIcon size={17} muted={volume.muted} />
          </button>
          <span className="ctl-pill-label">Volume</span>
        </PillSlider>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {outputsOpen ? (
          <motion.div key="outputs" className="ctl-section" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
            <div className="ctl-caption">Sorties audio</div>
            <OutputList outputs={outputs} />
          </motion.div>
        ) : (
          apps.length > 0 && (
            <motion.div key="apps" className="ctl-section" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.16 }}>
              <div className="ctl-caption">Applications</div>
              <AppList apps={apps} />
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
