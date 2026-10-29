import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { getVersion } from "@tauri-apps/api/app";
import { openLink } from "../ipc/notifications";
import { getHeldShortcut, getMonitors, SHORTCUTS, type Monitor, type Settings, type Shortcut } from "../ipc/settings";
import { updateSettings, useSettings } from "./store";

const ignore = () => {};
const REPO = "https://github.com/quierapro/quiera-island";

type Section = "general" | "launcher" | "media" | "notifications" | "clipboard" | "peeks" | "about";

const SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: "general", label: "Général", icon: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4" /> },
  { id: "launcher", label: "Lanceur", icon: <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4.5 4.5" /> },
  { id: "media", label: "Musique", icon: <Icon d="M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /> },
  { id: "notifications", label: "Notifications", icon: <Icon d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2ZM10 20.5a2.2 2.2 0 0 0 4 0" /> },
  { id: "clipboard", label: "Presse-papiers et Shelf", icon: <Icon d="M8.5 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5M9 4h6v3H9V4Z" /> },
  { id: "peeks", label: "Aperçus", icon: <Icon d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /> },
  { id: "about", label: "À propos", icon: <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5m0-3h.01" /> },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** One setting: its name, what it does, and its control. */
function Row({
  title,
  description,
  children,
  disabled = false,
  stacked = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  /** The control goes under the text (wide controls). */
  stacked?: boolean;
}) {
  return (
    <div className={`row ${disabled ? "row--off" : ""} ${stacked ? "row--stacked" : ""}`}>
      <div className="row-text">
        <div className="row-title">{title}</div>
        {description && <div className="row-desc">{description}</div>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label, disabled = false }: { on: boolean; onChange(on: boolean): void; label: string; disabled?: boolean }) {
  return (
    <button className={`toggle ${on ? "toggle--on" : ""}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}>
      <motion.span className="toggle-knob" layout transition={{ type: "spring", stiffness: 700, damping: 40 }} />
    </button>
  );
}

function Choice<T extends string>({ value, options, onChange, disabled = false }: { value: T; options: { value: T; label: string }[]; onChange(value: T): void; disabled?: boolean }) {
  return (
    <div className="choice" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={`choice-item ${value === o.value ? "choice-item--on" : ""}`} disabled={disabled} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`choice-${options.map((x) => x.value).join()}`} className="choice-pill" transition={{ type: "spring", stiffness: 600, damping: 42 }} />}
          <span className="choice-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="group">
      {title && <h2 className="group-title">{title}</h2>}
      <div className="group-body">{children}</div>
    </section>
  );
}

/** Applies one change to the settings; a save that fails shows a message. */
function useSave() {
  const [error, setError] = useState<string | null>(null);
  const save = (change: (s: Settings) => Settings) => {
    setError(null);
    updateSettings(change).catch((e) => setError(String(e)));
  };
  return { save, error };
}

function General({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  useEffect(() => {
    getMonitors().then(setMonitors).catch(ignore);
  }, []);
  const g = settings.general;
  const set = (patch: Partial<Settings["general"]>) => save((s) => ({ ...s, general: { ...s.general, ...patch } }));
  return (
    <>
      <Group>
        <Row title="Lancer Quiera au démarrage de Windows" description="L'île est là dès l'ouverture de ta session.">
          <Toggle label="Lancer au démarrage" on={g.startWithWindows} onChange={(on) => set({ startWithWindows: on })} />
        </Row>
        <Row title="Écran" description="Où l'île se place. Si cet écran est débranché, elle va sur l'écran principal.">
          <select className="select" value={g.screen ?? ""} onChange={(e) => set({ screen: e.target.value || null })}>
            <option value="">Écran principal</option>
            {monitors.map((m) => (
              <option key={m.name} value={m.name}>
                {m.primary ? "Principal · " : ""}
                {m.width} × {m.height} ({m.name.replace(/^\\\\\.\\/, "")})
              </option>
            ))}
          </select>
        </Row>
      </Group>
      <Group title="Comportement">
        <Row title="Ouvrir au survol" description="Sinon, l'île s'ouvre au clic et le survol la fait juste grossir un peu.">
          <Toggle label="Ouvrir au survol" on={g.openOnHover} onChange={(on) => set({ openOnHover: on })} />
        </Row>
        <Row title="Se cacher en plein écran" description="Pendant un jeu, une vidéo ou une présentation en plein écran.">
          <Toggle label="Se cacher en plein écran" on={g.hideInFullscreen} onChange={(on) => set({ hideInFullscreen: on })} />
        </Row>
        <Row title="Animations" description="« Système » suit le réglage « Effets d'animation » de Windows.">
          <Choice
            value={g.motion}
            onChange={(motion) => set({ motion })}
            options={[
              { value: "system", label: "Système" },
              { value: "reduced", label: "Réduites" },
              { value: "full", label: "Complètes" },
            ]}
          />
        </Row>
      </Group>
    </>
  );
}

function Launcher({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const l = settings.launcher;
  const [held, setHeld] = useState<Shortcut | null>(null);
  useEffect(() => {
    // The backend applies a new shortcut first: read what it holds after.
    const timer = setTimeout(() => getHeldShortcut().then(setHeld).catch(ignore), 250);
    return () => clearTimeout(timer);
  }, [l.enabled, l.shortcut]);
  const set = (patch: Partial<Settings["launcher"]>) => save((s) => ({ ...s, launcher: { ...s.launcher, ...patch } }));
  const taken = l.enabled && held !== l.shortcut;
  return (
    <>
      <Group>
        <Row title="Lanceur" description="Un raccourci ouvre une barre de recherche dans l'île : applis, fichiers, calculs, web.">
          <Toggle label="Lanceur" on={l.enabled} onChange={(on) => set({ enabled: on })} />
        </Row>
        <Row
          title="Raccourci"
          stacked
          disabled={!l.enabled}
          description={
            taken ? (
              <span className="warn">
                {l.shortcut} est déjà pris par une autre appli
                {held ? ` : Quiera utilise ${held} à la place.` : ", et aucun autre n'est libre."}
              </span>
            ) : (
              "Appuie dessus n'importe où pour ouvrir le lanceur."
            )
          }
        >
          <Choice value={l.shortcut} disabled={!l.enabled} onChange={(shortcut) => set({ shortcut })} options={SHORTCUTS.map((s) => ({ value: s, label: s }))} />
        </Row>
      </Group>
      <Group title="Fichiers">
        <Row
          title="Rechercher dans les fichiers"
          disabled={!l.enabled}
          description="Quiera garde en mémoire la liste des fichiers de tes disques (environ 35 Mo), refaite en arrière-plan. Les dossiers système, caches et moteurs de jeu sont laissés de côté."
        >
          <Toggle label="Rechercher dans les fichiers" on={l.indexFiles} disabled={!l.enabled} onChange={(on) => set({ indexFiles: on })} />
        </Row>
      </Group>
    </>
  );
}

function Media({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const m = settings.media;
  const set = (patch: Partial<Settings["media"]>) => save((s) => ({ ...s, media: { ...s.media, ...patch } }));
  const seconds = (m.lyricsOffsetMs / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });
  return (
    <Group>
      <Row title="Paroles synchronisées" description="Les paroles défilent avec la musique, dans la pilule et le lecteur. Seuls le titre, l'artiste, l'album et la durée sont envoyés pour les trouver.">
        <Toggle label="Paroles synchronisées" on={m.lyrics} onChange={(on) => set({ lyrics: on })} />
      </Row>
      <Row
        title="Paroles mot à mot (NetEase)"
        disabled={!m.lyrics}
        description="Le vrai timing de chaque mot, pour beaucoup de chansons. Passe par une API non officielle de NetEase Cloud Music ; sans elle, LRCLIB (ouvert) donne des paroles ligne par ligne."
      >
        <Toggle label="Paroles mot à mot" on={m.netease} disabled={!m.lyrics} onChange={(on) => set({ netease: on })} />
      </Row>
      <Row title="Décalage des paroles" disabled={!m.lyrics} description="Si les paroles sont en avance ou en retard sur la musique.">
        <div className="offset">
          <input
            className="range"
            type="range"
            min={-2000}
            max={2000}
            step={100}
            value={m.lyricsOffsetMs}
            disabled={!m.lyrics}
            style={{ "--fill": `${((m.lyricsOffsetMs + 2000) / 4000) * 100}%` } as React.CSSProperties}
            onChange={(e) => set({ lyricsOffsetMs: Number(e.target.value) })}
          />
          <span className="offset-value">{m.lyricsOffsetMs === 0 ? "0 s" : `${seconds} s`}</span>
          {m.lyricsOffsetMs !== 0 && (
            <button className="link" onClick={() => set({ lyricsOffsetMs: 0 })}>
              Réinitialiser
            </button>
          )}
        </div>
      </Row>
    </Group>
  );
}

function Notifications({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const n = settings.notifications;
  const set = (patch: Partial<Settings["notifications"]>) => save((s) => ({ ...s, notifications: { ...s.notifications, ...patch } }));
  return (
    <Group>
      <Row title="Notifications dans l'île" description="Les notifications de Windows arrivent dans l'onglet 🔔. Rien n'est enregistré ni envoyé.">
        <Toggle label="Notifications dans l'île" on={n.enabled} onChange={(on) => set({ enabled: on })} />
      </Row>
      <Row title="Les annoncer sur l'île" disabled={!n.enabled} description="Un aperçu de 5 s à chaque notification. Jamais en mode « Ne pas déranger ».">
        <Toggle label="Annoncer les notifications" on={n.peek} disabled={!n.enabled} onChange={(on) => set({ peek: on })} />
      </Row>
    </Group>
  );
}

function Clipboard({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  return (
    <>
      <Group title="Presse-papiers">
        <Row title="Historique du presse-papiers" description="Ce que tu copies pendant la session, dans un onglet. Jamais écrit sur le disque ; les mots de passe des gestionnaires sont ignorés.">
          <Toggle label="Historique du presse-papiers" on={settings.clipboard.enabled} onChange={(on) => save((s) => ({ ...s, clipboard: { enabled: on } }))} />
        </Row>
      </Group>
      <Group title="Shelf">
        <Row title="Garder le Shelf entre deux sessions" description="Les fichiers déposés sur l'île restent après avoir fermé Quiera (seuls leurs chemins sont gardés, jamais copiés).">
          <Toggle label="Garder le Shelf" on={settings.shelf.keep} onChange={(on) => save((s) => ({ ...s, shelf: { keep: on } }))} />
        </Row>
      </Group>
    </>
  );
}

function Peeks({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const p = settings.peeks;
  const set = (patch: Partial<Settings["peeks"]>) => save((s) => ({ ...s, peeks: { ...s.peeks, ...patch } }));
  return (
    <Group>
      <Row title="Chargeur" description="Quand tu branches ou débranches le chargeur.">
        <Toggle label="Aperçu du chargeur" on={p.power} onChange={(on) => set({ power: on })} />
      </Row>
      <Row title="Casque et sortie audio" description="Quand un casque se connecte, avec sa batterie si Windows la connaît.">
        <Toggle label="Aperçu du casque" on={p.audioDevice} onChange={(on) => set({ audioDevice: on })} />
      </Row>
      <Row title="Verr. Maj" description="Quand tu actives ou coupes Verr. Maj.">
        <Toggle label="Aperçu de Verr. Maj" on={p.capsLock} onChange={(on) => set({ capsLock: on })} />
      </Row>
      <Row title="Volume" description="Quand le volume change.">
        <Toggle label="Aperçu du volume" on={p.volume} onChange={(on) => set({ volume: on })} />
      </Row>
    </Group>
  );
}

function About() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    getVersion().then(setVersion).catch(ignore);
  }, []);
  return (
    <div className="about">
      <div className="about-mark">Q</div>
      <div className="about-name">Quiera</div>
      <div className="about-version">Version {version}</div>
      <p className="about-text">Une île en haut de ton écran pour la musique, tes fichiers et tes raccourcis. Logiciel libre sous licence GPL-3.0.</p>
      <div className="about-links">
        <button className="button" onClick={() => openLink(REPO).catch(ignore)}>
          Code source
        </button>
        <button className="button" onClick={() => openLink(`${REPO}/issues`).catch(ignore)}>
          Signaler un problème
        </button>
      </div>
    </div>
  );
}

export function SettingsApp() {
  const settings = useSettings();
  const { save, error } = useSave();
  const [section, setSection] = useState<Section>("general");
  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-title">Réglages</div>
        {SECTIONS.map((s) => (
          <button key={s.id} className={`nav-item ${s.id === section ? "nav-item--on" : ""}`} onClick={() => setSection(s.id)}>
            {s.id === section && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: "spring", stiffness: 550, damping: 42 }} />}
            <span className="nav-icon">{s.icon}</span>
            <span className="nav-label">{s.label}</span>
          </button>
        ))}
      </nav>
      <main className="main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={section} className="page" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {section !== "about" && <h1 className="page-title">{current.label}</h1>}
            {section === "general" && <General settings={settings} save={save} />}
            {section === "launcher" && <Launcher settings={settings} save={save} />}
            {section === "media" && <Media settings={settings} save={save} />}
            {section === "notifications" && <Notifications settings={settings} save={save} />}
            {section === "clipboard" && <Clipboard settings={settings} save={save} />}
            {section === "peeks" && <Peeks settings={settings} save={save} />}
            {section === "about" && <About />}
          </motion.div>
        </AnimatePresence>
        {error && <div className="error">Le réglage n'a pas pu être enregistré : {error}</div>}
      </main>
    </div>
  );
}
