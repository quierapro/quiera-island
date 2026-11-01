import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Size } from "../../island/geometry";
import { getLauncherShortcut } from "../../ipc/launcher";
import { openLauncher } from "../../ipc/welcome";
import { updateSettings, useSettings } from "../../settings/store";
import { useT } from "../../i18n";
import { endWelcome } from "./store";
import "./welcome.css";

/** The compact pill while the welcome waits to be opened. */
export const WELCOME_PILL_SIZE: Size = [270, 34, 17];
/** The tour's panel, under the tab bar. */
export const WELCOME_SIZE: Size = [470, 150, 26];

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

/** "Bienvenue sur Quiera · survole-moi". */
export function WelcomePill() {
  const t = useT().welcome;
  const hover = useSettings().general.openOnHover;
  return (
    <div className="welcome-pill">
      <motion.span
        className="welcome-pill-dot"
        animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="welcome-pill-text">{t.pill}</span>
      <span className="welcome-pill-hint">{hover ? t.hover : t.click}</span>
    </div>
  );
}

interface Step {
  title: string;
  text: ReactNode;
  icon: ReactNode;
  tint: string;
  /** Under the text: the privacy step's switches. */
  extra?: ReactNode;
}

/** A setting as a small switch-like chip, for the privacy step. */
function Chip({ on, label, onToggle }: { on: boolean; label: string; onToggle(): void }) {
  return (
    <button className={`welcome-chip ${on ? "welcome-chip--on" : ""}`} role="switch" aria-checked={on} onClick={onToggle}>
      <span className="welcome-chip-dot" />
      {label}
    </button>
  );
}

/** A first look at what the island does, then starting with Windows. */
export function WelcomeTour() {
  const messages = useT();
  const t = messages.welcome;
  const s = t.steps;
  const [step, setStep] = useState(0);
  const [shortcut, setShortcut] = useState<string | null>(null);
  const settings = useSettings();
  const startWithWindows = settings.general.startWithWindows;
  useEffect(() => {
    getLauncherShortcut()
      .then(setShortcut)
      .catch(() => {});
  }, []);

  const steps: Step[] = [
    {
      title: s.hello.title,
      text: s.hello.text,
      icon: icon(<path d="M4 9.5c0-1.4 1.1-2.5 2.5-2.5h11C18.9 7 20 8.1 20 9.5v0c0 1.4-1.1 2.5-2.5 2.5h-11C5.1 12 4 10.9 4 9.5ZM8 16h8" />),
      tint: "#7136ff",
    },
    {
      title: s.music.title,
      text: s.music.text,
      icon: icon(
        <>
          <path d="M9 18V6l11-2v12" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
        </>,
      ),
      tint: "#ff375f",
    },
    {
      title: s.launcher.title,
      text: shortcut ? (
        <>
          <kbd>{messages.shortcut(shortcut)}</kbd>
          {s.launcher.withShortcut}
        </>
      ) : (
        s.launcher.noShortcut
      ),
      icon: icon(
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </>,
      ),
      tint: "#0a84ff",
    },
    {
      title: s.shelf.title,
      text: s.shelf.text,
      icon: icon(
        <>
          <path d="M3.5 13.5 6 5.8A2 2 0 0 1 7.9 4.5h8.2A2 2 0 0 1 18 5.8l2.5 7.7" />
          <path d="M3.5 13.5V17a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5v-3.5h-5l-1 2h-5l-1-2Z" />
        </>,
      ),
      tint: "#ff9f0a",
    },
    {
      title: s.privacy.title,
      text: s.privacy.text,
      icon: icon(<path d="M12 3 5 6v5c0 4.5 3 8.3 7 9.5 4-1.2 7-5 7-9.5V6l-7-3Z" />),
      tint: "#5e5ce6",
      extra: (
        <span className="welcome-chips">
          <Chip
            label={s.privacy.lyrics}
            on={settings.media.lyrics}
            onToggle={() => updateSettings((s) => ({ ...s, media: { ...s.media, lyrics: !s.media.lyrics } })).catch(() => {})}
          />
          <Chip
            label={s.privacy.updates}
            on={settings.general.checkUpdates}
            onToggle={() =>
              updateSettings((s) => ({ ...s, general: { ...s.general, checkUpdates: !s.general.checkUpdates } })).catch(() => {})
            }
          />
        </span>
      ),
    },
    {
      title: s.startup.title,
      text: s.startup.text,
      icon: icon(<path d="M12 3v8M7.5 6.5a7 7 0 1 0 9 0" />),
      tint: "#32d74b",
    },
    {
      title: s.done.title,
      text: s.done.text,
      icon: icon(<path d="m5 12.5 4.5 4.5L19 7.5" />),
      tint: "#32d74b",
    },
  ];
  const last = steps.length - 1;
  const STARTUP = 5;
  const current = steps[step];
  const next = () => setStep((s) => Math.min(last, s + 1));
  const startup = (on: boolean) => {
    if (on !== startWithWindows) updateSettings((s) => ({ ...s, general: { ...s.general, startWithWindows: on } })).catch(() => {});
    next();
  };

  return (
    <div className="welcome" onPointerDown={(e) => e.stopPropagation()}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="welcome-body"
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.18, ease: [0.33, 1, 0.68, 1] }}
        >
          <span className="welcome-icon" style={{ background: current.tint }}>
            {current.icon}
          </span>
          <span className="welcome-text">
            <span className="welcome-title">{current.title}</span>
            <span className="welcome-desc">{current.text}</span>
            {current.extra}
          </span>
        </motion.div>
      </AnimatePresence>
      <div className="welcome-foot">
        <span className="welcome-dots" aria-label={t.stepOf(step + 1, steps.length)}>
          {steps.map((_, i) => (
            <i key={i} className={i === step ? "welcome-dot--on" : ""} />
          ))}
        </span>
        <span className="welcome-actions">
          {step < STARTUP && (
            <button className="welcome-btn welcome-btn--quiet" onClick={endWelcome}>
              {t.skip}
            </button>
          )}
          {step === 2 && shortcut && (
            <button className="welcome-btn" onClick={() => openLauncher().catch(() => {})}>
              {t.try}
            </button>
          )}
          {step === STARTUP ? (
            <>
              <button className="welcome-btn" onClick={() => startup(false)}>
                {t.no}
              </button>
              <button className="welcome-btn welcome-btn--main" onClick={() => startup(true)}>
                {t.yes}
              </button>
            </>
          ) : step === last ? (
            <button className="welcome-btn welcome-btn--main" onClick={endWelcome}>
              {t.finish}
            </button>
          ) : (
            <button className="welcome-btn welcome-btn--main" onClick={next}>
              {step === 0 ? t.discover : t.next}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
