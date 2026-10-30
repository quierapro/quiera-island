import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Size } from "../../island/geometry";
import { getLauncherShortcut } from "../../ipc/launcher";
import { openLauncher } from "../../ipc/welcome";
import { updateSettings, useSettings } from "../../settings/store";
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
  const hover = useSettings().general.openOnHover;
  return (
    <div className="welcome-pill">
      <motion.span
        className="welcome-pill-dot"
        animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="welcome-pill-text">Bienvenue sur Quiera</span>
      <span className="welcome-pill-hint">{hover ? "survole-moi" : "clique-moi"}</span>
    </div>
  );
}

interface Step {
  title: string;
  text: ReactNode;
  icon: ReactNode;
  tint: string;
}

/** A first look at what the island does, then starting with Windows. */
export function WelcomeTour() {
  const [step, setStep] = useState(0);
  const [shortcut, setShortcut] = useState<string | null>(null);
  const startWithWindows = useSettings().general.startWithWindows;
  useEffect(() => {
    getLauncherShortcut()
      .then(setShortcut)
      .catch(() => {});
  }, []);

  const steps: Step[] = [
    {
      title: "Bienvenue sur Quiera",
      text: "Ton île vit en haut de l'écran : elle montre ce qui se passe sur ton PC, et s'ouvre quand tu la survoles.",
      icon: icon(<path d="M4 9.5c0-1.4 1.1-2.5 2.5-2.5h11C18.9 7 20 8.1 20 9.5v0c0 1.4-1.1 2.5-2.5 2.5h-11C5.1 12 4 10.9 4 9.5ZM8 16h8" />),
      tint: "#7136ff",
    },
    {
      title: "Ta musique, ici",
      text: "Lance Spotify, Deezer ou une vidéo : le titre s'affiche dans la pilule, avec les paroles mot à mot.",
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
      title: "Le lanceur",
      text: shortcut ? (
        <>
          <kbd>{shortcut}</kbd> : cherche une appli, un fichier, fais un calcul ou une recherche web.
        </>
      ) : (
        "Un raccourci ouvre une recherche d'applis, de fichiers et de calculs. Choisis-le dans les réglages."
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
      title: "Le Shelf",
      text: "Glisse un fichier sur l'île pour le garder sous la main, puis l'envoyer sur ton téléphone avec un QR code.",
      icon: icon(
        <>
          <path d="M3.5 13.5 6 5.8A2 2 0 0 1 7.9 4.5h8.2A2 2 0 0 1 18 5.8l2.5 7.7" />
          <path d="M3.5 13.5V17a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5v-3.5h-5l-1 2h-5l-1-2Z" />
        </>,
      ),
      tint: "#ff9f0a",
    },
    {
      title: "Au démarrage de Windows ?",
      text: "Quiera se lance avec ta session, sans fenêtre. Tu pourras changer d'avis dans les réglages.",
      icon: icon(<path d="M12 3v8M7.5 6.5a7 7 0 1 0 9 0" />),
      tint: "#32d74b",
    },
    {
      title: "C'est prêt",
      text: "Les réglages et « Quitter » sont dans l'icône Quiera, en bas à droite de la barre des tâches.",
      icon: icon(<path d="m5 12.5 4.5 4.5L19 7.5" />),
      tint: "#32d74b",
    },
  ];
  const last = steps.length - 1;
  const STARTUP = 4;
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
          </span>
        </motion.div>
      </AnimatePresence>
      <div className="welcome-foot">
        <span className="welcome-dots" aria-label={`Étape ${step + 1} sur ${steps.length}`}>
          {steps.map((_, i) => (
            <i key={i} className={i === step ? "welcome-dot--on" : ""} />
          ))}
        </span>
        <span className="welcome-actions">
          {step < STARTUP && (
            <button className="welcome-btn welcome-btn--quiet" onClick={endWelcome}>
              Passer
            </button>
          )}
          {step === 2 && shortcut && (
            <button className="welcome-btn" onClick={() => openLauncher().catch(() => {})}>
              Essayer
            </button>
          )}
          {step === STARTUP ? (
            <>
              <button className="welcome-btn" onClick={() => startup(false)}>
                Non
              </button>
              <button className="welcome-btn welcome-btn--main" onClick={() => startup(true)}>
                Oui
              </button>
            </>
          ) : step === last ? (
            <button className="welcome-btn welcome-btn--main" onClick={endWelcome}>
              Terminer
            </button>
          ) : (
            <button className="welcome-btn welcome-btn--main" onClick={next}>
              {step === 0 ? "Découvrir" : "Suivant"}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
