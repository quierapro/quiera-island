import { useRef, useState } from "react";
import * as ctl from "../../ipc/controls";
import type { Controls, RadioKind } from "../../ipc/controls";
import { shownLevel } from "./format";
import { BluetoothIcon, HeadphonesIcon, SpeakerIcon, WifiIcon } from "./icons";
import { refreshControls, useControls } from "./store";
import "./controls.css";

const ignore = () => {};
/** Volume changes sent while dragging, at most this often. */
const SEND_MS = 50;

const RADIOS: Record<RadioKind, { label: string; icon: React.ReactNode }> = {
  wifi: { label: "Wi-Fi", icon: <WifiIcon size={17} /> },
  bluetooth: { label: "Bluetooth", icon: <BluetoothIcon size={17} /> },
};

function Toggle({ kind, on }: { kind: RadioKind; on: boolean }) {
  const [pending, setPending] = useState<boolean | null>(null);
  const shown = pending ?? on;
  return (
    <button
      className={`ctl-toggle ${shown ? "ctl-toggle--on" : ""}`}
      aria-pressed={shown}
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
    </button>
  );
}

/** A volume slider that sends its value while dragged, without flooding. */
function Slider({ level, label, onLevel }: { level: number; label: string; onLevel(level: number): void }) {
  const [local, setLocal] = useState<{ level: number; at: number }>();
  const last = useRef(0);
  const value = shownLevel(level, local, Date.now());
  const send = (next: number, force: boolean) => {
    setLocal({ level: next, at: Date.now() });
    if (force || Date.now() - last.current >= SEND_MS) {
      last.current = Date.now();
      onLevel(next);
    }
  };
  return (
    <input
      className="ctl-slider"
      type="range"
      min={0}
      max={100}
      value={value}
      aria-label={label}
      style={{ "--fill": `${value}%` } as React.CSSProperties}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => send(Number(e.target.value), false)}
      onPointerUp={(e) => send(Number((e.target as HTMLInputElement).value), true)}
      onKeyUp={(e) => send(Number((e.target as HTMLInputElement).value), true)}
    />
  );
}

function Outputs({ outputs }: { outputs: Controls["outputs"] }) {
  const [chosen, setChosen] = useState<string | null>(null);
  if (outputs.length === 0) return null;
  return (
    <div className="ctl-outputs">
      {outputs.map((o) => {
        const active = chosen ? chosen === o.id : o.default;
        return (
          <button
            key={o.id}
            className={`ctl-output ${active ? "ctl-output--on" : ""}`}
            title={o.name}
            onClick={(e) => {
              e.stopPropagation();
              setChosen(o.id);
              ctl
                .setOutput(o.id)
                .catch(ignore)
                .finally(() => {
                  refreshControls();
                  setTimeout(() => setChosen(null), 1200);
                });
            }}
          >
            {o.form === "headphones" || o.form === "headset" ? <HeadphonesIcon size={14} /> : <SpeakerIcon size={14} />}
            <span>{o.name}</span>
          </button>
        );
      })}
    </div>
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

/** The Controls tab: radios, audio output, master and app volumes. */
export function ControlsView() {
  const controls = useControls();
  if (!controls) return <div className="ctl" />;
  const { radios, outputs, volume, apps } = controls;

  return (
    <div className="ctl">
      <div className="ctl-toggles">
        {radios.map((r) => (
          <Toggle key={r.kind} kind={r.kind} on={r.on} />
        ))}
      </div>

      <Outputs outputs={outputs} />

      {volume && (
        <div className="ctl-row">
          <button
            className={`ctl-mute ${volume.muted ? "ctl-mute--on" : ""}`}
            aria-label={volume.muted ? "Réactiver le son" : "Couper le son"}
            onClick={(e) => {
              e.stopPropagation();
              ctl.setMute(!volume.muted).catch(ignore).finally(refreshControls);
            }}
          >
            <SpeakerIcon size={16} muted={volume.muted} />
          </button>
          <Slider level={volume.level} label="Volume" onLevel={(l) => ctl.setVolume(l).catch(ignore)} />
          <span className="ctl-value">{volume.level}</span>
        </div>
      )}

      {apps.length > 0 && (
        <>
          <div className="ctl-caption">Applications</div>
          <div className="ctl-apps">
            {apps.map((a) => (
              <div key={a.key} className={`ctl-row ${a.muted ? "ctl-row--muted" : ""}`}>
                <button
                  className="ctl-app"
                  title={a.muted ? `Réactiver ${a.name}` : `Couper ${a.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    ctl.setAppMute(a.key, !a.muted).catch(ignore).finally(refreshControls);
                  }}
                >
                  <AppIcon src={a.icon} name={a.name} />
                </button>
                <span className="ctl-app-name">{a.name}</span>
                <Slider level={a.level} label={`Volume de ${a.name}`} onLevel={(l) => ctl.setAppVolume(a.key, l).catch(ignore)} />
                <span className="ctl-value">{a.muted ? "—" : a.level}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
