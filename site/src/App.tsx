import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SceneId } from "./demo/Demo";
import { DOWNLOAD, RELEASES, REPO, WINGET, WINGET_READY, faqs } from "./content";
import { LangContext, rootOf, useLang, useTr, type Lang, type Tr } from "./i18n";

type Theme = "dark" | "system" | "light";

// The demo is the page's heaviest part: it comes in its own file, and React keeps
// its prerendered HTML on screen until that file has arrived.
const Demo = lazy(() => import("./demo/Demo").then((m) => ({ default: m.Demo })));

/* ---------------------------------------------------------------- Bits */

function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="#7136ff">
        <circle cx="32.2" cy="26.9" r="16.6" />
        <circle cx="17.7" cy="36.5" r="13.7" />
        <circle cx="46.3" cy="36.5" r="13.7" />
        <ellipse cx="32" cy="42" rx="17" ry="13.3" />
      </g>
      <g fill="#fff">
        <rect x="21.9" y="26.8" width="7.8" height="14" rx="3.9" transform="rotate(-9 25.8 33.8)" />
        <rect x="34.6" y="23.7" width="7.8" height="14" rx="3.9" transform="rotate(-9 38.5 30.7)" />
      </g>
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M3 5.45 10.35 4v7.15H3V5.45Zm8.35-1.65L21 2v9.15h-9.65V3.8ZM3 12.15h7.35v7.4L3 17.85v-5.7Zm8.35 0H21V22l-9.65-2.22v-7.63Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m8 9 3 3-3 3M13 15h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function scrollToId(e: React.MouseEvent, href: string) {
  if (!href.startsWith("#")) return;
  e.preventDefault();
  const target = href === "#top" ? null : document.querySelector(href);
  const top = target ? target.getBoundingClientRect().top + window.scrollY - 96 : 0;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

/** Fades sections in as they come into view. */
function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-revealed");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/** The same page in the other language. */
function LangSwitch() {
  const lang = useLang();
  const other: Lang = lang === "fr" ? "en" : "fr";
  return (
    <a
      className="lang-switch"
      href={lang === "fr" ? "./en/" : "../"}
      hrefLang={other}
      lang={other}
      title={lang === "fr" ? "English version" : "Version française"}
    >
      {other.toUpperCase()}
    </a>
  );
}

/* ---------------------------------------------------------------- Nav */

const nav = (tr: Tr) => [
  { label: tr("Aperçu", "Preview"), href: "#demo" },
  { label: tr("Fonctionnalités", "Features"), href: "#features" },
  { label: "FAQ", href: "#faq" },
  { label: tr("Téléchargement", "Download"), href: "#download" },
];

function Nav() {
  const tr = useTr();
  const menu = useRef<HTMLDetailsElement>(null);
  const go = (e: React.MouseEvent, href: string) => {
    scrollToId(e, href);
    menu.current?.removeAttribute("open");
  };
  const links = nav(tr);
  return (
    <header className="nav">
      <div className="nav-row">
        <a className="brand" href="#top" onClick={(e) => go(e, "#top")} aria-label={tr("Quiera, accueil", "Quiera, home")}>
          <Logo />
          <span>quiera</span>
        </a>
        <nav className="nav-links" aria-label="Sections">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={(e) => go(e, l.href)}>
              {l.label}
            </a>
          ))}
        </nav>
        <LangSwitch />
        <a className="btn btn--light nav-cta" href={DOWNLOAD}>
          {tr("Télécharger", "Download")}
        </a>
        <details className="nav-menu" ref={menu}>
          <summary aria-label="Menu">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </summary>
          <div className="nav-menu-panel">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => go(e, l.href)}>
                {l.label}
              </a>
            ))}
            <a className="btn btn--light" href={DOWNLOAD}>
              {tr("Télécharger", "Download")}
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- Hero */

function DownloadMenu() {
  const tr = useTr();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.removeAttribute("open");
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details className="download" ref={ref}>
      <summary aria-label={tr("Télécharger pour Windows, ou choisir une autre plateforme", "Download for Windows, or pick another platform")}>
        <a className="download-main" href={DOWNLOAD} onClick={(e) => e.stopPropagation()}>
          <WindowsIcon />
          {tr("Télécharger pour Windows", "Download for Windows")}
        </a>
        <span className="download-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 9 5 5 5-5" />
          </svg>
        </span>
      </summary>
      <div className="download-panel">
        <div className="download-head">{tr("Choisissez votre plateforme", "Choose your platform")}</div>
        <a className="download-option" href={DOWNLOAD}>
          <span className="download-icon">
            <WindowsIcon />
          </span>
          <span>
            <strong>Windows 11</strong>
            <small>{tr("Installateur · téléchargement direct", "Installer · direct download")}</small>
          </span>
          <em>.exe</em>
        </a>
        <a
          className={`download-option ${WINGET_READY ? "" : "is-soon"}`}
          href="#download"
          onClick={(e) => {
            ref.current?.removeAttribute("open");
            scrollToId(e, "#download");
          }}
        >
          <span className="download-icon">
            <TerminalIcon />
          </span>
          <span>
            <strong>winget</strong>
            <small>{WINGET_READY ? tr("Une commande, sans SmartScreen", "One command, no SmartScreen") : tr("En validation chez Microsoft", "In review at Microsoft")}</small>
          </span>
          <em>{WINGET_READY ? tr("Terminal", "Terminal") : tr("Bientôt", "Soon")}</em>
        </a>
        <a className="download-option" href={REPO}>
          <span className="download-icon">
            <GitHubIcon />
          </span>
          <span>
            <strong>{tr("Code source", "Source code")}</strong>
            <small>{tr("GitHub · licence GPL-3.0", "GitHub · GPL-3.0 licence")}</small>
          </span>
          <em>Git</em>
        </a>
        <div className="download-option is-soon" aria-disabled="true">
          <span className="download-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <rect x="3" y="5" width="18" height="12" rx="2.5" />
              <path d="M8 20h8M12 17v3" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            <strong>{tr("Linux et macOS", "Linux and macOS")}</strong>
            <small>{tr("En préparation", "In the works")}</small>
          </span>
          <em>{tr("Bientôt", "Soon")}</em>
        </div>
      </div>
    </details>
  );
}

function Hero({ scene, onScene }: { scene: SceneId; onScene(id: SceneId): void }) {
  const tr = useTr();
  return (
    <section className="hero" id="top">
      <div className="shell">
        <div className="hero-copy">
          <h1>{tr("Dynamic Island native pour Windows", "The native Dynamic Island for Windows")}</h1>
          <p>
            {tr(
              "Quiera met votre musique et ses paroles synchronisées, vos réunions avec un bouton pour les rejoindre, un minuteur, un lanceur qui trouve applis et fichiers, vos notifications, le Wi-Fi et le son, un Shelf et un presse-papiers au sommet de votre écran.",
              "Quiera puts your music and its synced lyrics, your meetings with a button to join them, a timer, a launcher that finds apps and files, your notifications, Wi-Fi and sound, a Shelf and a clipboard at the top of your screen.",
            )}
            <br />
            <strong>{tr("Léger, open source et 100 % gratuit.", "Lightweight, open source and 100% free.")}</strong>
          </p>
          <div className="hero-actions">
            <DownloadMenu />
            <a className="btn btn--ghost btn--lg" href="#features" onClick={(e) => scrollToId(e, "#features")}>
              {tr("Explorer les fonctionnalités", "Explore the features")}
            </a>
          </div>
        </div>
        <div className="hero-demo" id="demo">
          {/* Its own boundary: hydrated after the text, so the page answers sooner. */}
          <Suspense>
            <Demo scene={scene} onScene={onScene} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Platforms */

const PLATFORMS = ["Spotify", "Deezer", "Apple Music", "YouTube", "SoundCloud", "Tidal", "Windows 11"];

function PlatformBand() {
  const tr = useTr();
  return (
    <section className="band" aria-label={tr("Compatibilité", "Compatibility")}>
      <p className="band-lead reveal">{tr("Fonctionne avec les applis qui annoncent leur lecture à Windows", "Works with the apps that tell Windows what they play")}</p>
      <div className="band-logos">
        {PLATFORMS.map((name, i) => (
          <span key={name} className="band-logo reveal" style={{ "--stagger": `${i * 45}ms` } as React.CSSProperties}>
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Features */

const icon = (d: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

function features(tr: Tr): { title: string; desc: string; icon: ReactNode; scene?: SceneId }[] {
  return [
    {
      title: tr("Lecteur universel", "Universal player"),
      desc: tr(
        "Spotify, Deezer, YouTube dans le navigateur… toute appli qui annonce sa lecture à Windows. Plusieurs sources ? Des points passent de l'une à l'autre.",
        "Spotify, Deezer, YouTube in the browser… any app that tells Windows what it plays. Several sources? Dots switch between them.",
      ),
      icon: icon(
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>,
      ),
      scene: "musique",
    },
    {
      title: tr("Paroles synchronisées", "Synced lyrics"),
      desc: tr(
        "Mot à mot dans la pilule, ligne par ligne dans le lecteur. Un clic sur une ligne pour y aller, un décalage réglable si elles arrivent en avance.",
        "Word by word in the pill, line by line in the player. Click a line to jump to it, and shift them if they arrive early.",
      ),
      icon: icon(
        <>
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
        </>,
      ),
      scene: "musique",
    },
    {
      title: tr("Agenda et bouton Rejoindre", "Calendar and Join button"),
      desc: tr(
        "Votre agenda Google, Outlook ou iCloud par son lien iCal. L'île annonce chaque réunion quelques minutes avant, et Rejoindre ouvre Teams, Meet ou Zoom.",
        "Your Google, Outlook or iCloud calendar through its iCal link. The island announces each meeting a few minutes before, and Join opens Teams, Meet or Zoom.",
      ),
      icon: icon(
        <>
          <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10.5h17M8 3.5v4M16 3.5v4" />
        </>,
      ),
      scene: "agenda",
    },
    {
      title: tr("Minuteur", "Timer"),
      desc: tr(
        "« 5 min » ou « pomodoro » dans le lanceur, ou des roues pour choisir. Le compte à rebours reste dans la pilule, et l'île sonne à la fin.",
        "“5 min” or “pomodoro” in the launcher, or wheels to pick the time. The countdown stays in the pill, and the island rings at the end.",
      ),
      icon: icon(
        <>
          <circle cx="12" cy="13.5" r="7.5" />
          <path d="M12 9.5v4l2.5 1.5M10 2.5h4" />
        </>,
      ),
      scene: "minuteur",
    },
    {
      title: tr("Lanceur façon Spotlight", "Spotlight-style launcher"),
      desc: tr(
        "Alt+Espace (modifiable) : applis, fichiers de tous vos disques, calculs, minuteurs et recherche web. « images », « vidéos » ou « musique » filtrent par type.",
        "Alt+Space (customisable): apps, files from all your drives, calculations, timers and web search. “images”, “videos” or “music” filter by type.",
      ),
      icon: icon(
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </>,
      ),
      scene: "lanceur",
    },
    {
      title: "Notifications",
      desc: tr(
        "Celles de Windows passent sur l'île quelques secondes, puis restent dans leur onglet. Un clic ouvre l'appli. Le mode Ne pas déranger est respecté.",
        "Windows' notifications pass over the island for a few seconds, then stay in their tab. A click opens the app. Do Not Disturb is respected.",
      ),
      icon: icon(
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>,
      ),
      scene: "notifications",
    },
    {
      title: tr("Contrôles rapides", "Quick controls"),
      desc: tr(
        "Wi-Fi, Bluetooth, volume général, sortie audio et volume de chaque application, sans ouvrir les Paramètres.",
        "Wi-Fi, Bluetooth, main volume, audio output and each app's volume, without opening Settings.",
      ),
      icon: icon(<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" />),
      scene: "controles",
    },
    {
      title: tr("Miroir", "Mirror"),
      desc: tr(
        "Un coup d'œil à votre webcam avant une visio, dans l'île. L'image reste sur votre PC : rien n'est enregistré ni envoyé.",
        "A quick look through your webcam before a video call, in the island. The picture stays on your PC: nothing is recorded or sent.",
      ),
      icon: icon(
        <>
          <rect x="3" y="6" width="13" height="12" rx="2.5" />
          <path d="m16 10.5 5-3v9l-5-3" />
        </>,
      ),
      scene: "agenda",
    },
    {
      title: tr("Shelf et envoi au téléphone", "Shelf and send to phone"),
      desc: tr(
        "Glissez des fichiers sur l'île pour les garder de côté, puis ailleurs. Un QR code les envoie sur votre téléphone, iPhone ou Android, sans appli ni Internet.",
        "Drag files onto the island to keep them aside, then drop them elsewhere. A QR code sends them to your phone, iPhone or Android, with no app and no Internet.",
      ),
      icon: icon(
        <>
          <path d="M3.5 13.5 6 5.8A2 2 0 0 1 7.9 4.5h8.2A2 2 0 0 1 18 5.8l2.5 7.7" />
          <path d="M3.5 13.5V17a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5v-3.5h-5l-1 2h-5l-1-2Z" />
        </>,
      ),
      scene: "shelf",
    },
    {
      title: tr("Presse-papiers", "Clipboard"),
      desc: tr(
        "Vos derniers textes, liens et images copiés ; un clic les recopie. Gardés en mémoire seulement, et les contenus marqués privés (mots de passe) sont ignorés.",
        "Your latest copied texts, links and images; one click copies them again. Kept in memory only, and content marked private (passwords) is skipped.",
      ),
      icon: icon(
        <>
          <rect x="5.5" y="5" width="13" height="15.5" rx="2.5" />
          <path d="M9 5V4.3A1.3 1.3 0 0 1 10.3 3h3.4A1.3 1.3 0 0 1 15 4.3V5M9 11h6M9 14.5h4" />
        </>,
      ),
      scene: "shelf",
    },
    {
      title: tr("Aperçus et batteries", "Peeks and batteries"),
      desc: tr(
        "Chargeur branché, casque, clavier ou souris Bluetooth avec leur batterie, Verr. Maj, volume : un aperçu discret, puis l'île se range. Une alerte sous 15 %.",
        "Charger plugged in, Bluetooth headphones, keyboard or mouse with their battery, Caps Lock, volume: a discreet peek, then the island tucks away. A warning below 15%.",
      ),
      icon: icon(
        <>
          <rect x="2" y="7" width="17" height="10" rx="2.5" />
          <path d="M22 11v2M6 10v4M9.5 10v4" />
        </>,
      ),
      scene: "veille",
    },
    {
      title: tr("Discrète, même en jeu", "Out of the way, even in games"),
      desc: tr(
        "Se cache en plein écran ; votre raccourci l'affiche par-dessus un jeu. Fermée, elle laisse passer les clics. Presque aucun processeur au repos.",
        "Hides in fullscreen; your shortcut shows it over a game. Closed, it lets clicks through. Almost no CPU at rest.",
      ),
      icon: icon(
        <>
          <path d="M6 9h12a4 4 0 0 1 3.9 4.9l-.8 3.4a2.4 2.4 0 0 1-4.1 1.1L15 16H9l-2 2.4a2.4 2.4 0 0 1-4.1-1.1l-.8-3.4A4 4 0 0 1 6 9Z" />
          <path d="M8 11.5v3M6.5 13h3M15.5 12.5h.01M17.5 14h.01" />
        </>,
      ),
      scene: "jeux",
    },
  ];
}

function Features({ onScene }: { onScene(id: SceneId): void }) {
  const tr = useTr();
  return (
    <section className="features" id="features" aria-labelledby="features-title">
      <div className="section-head reveal">
        <h2 id="features-title">{tr("Fonctionnalités pensées pour votre bureau", "Features made for your desktop")}</h2>
        <p>
          {tr(
            "Tout ce que Quiera ajoute à Windows, sans fenêtre de plus : l'île s'ouvre quand vous en avez besoin, et se fait oublier le reste du temps.",
            "Everything Quiera adds to Windows, with no extra window: the island opens when you need it, and stays out of the way the rest of the time.",
          )}
        </p>
      </div>
      <div className="features-grid">
        {features(tr).map((f, i) => {
          const body = (
            <>
              <span className="feat-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              {f.scene && <span className="feat-try">{tr("Voir dans l'aperçu →", "See it in the preview →")}</span>}
            </>
          );
          const style = { "--stagger": `${(i % 3) * 70}ms` } as React.CSSProperties;
          return f.scene ? (
            <a
              key={f.title}
              className="feat reveal"
              href="#demo"
              style={style}
              onClick={(e) => {
                onScene(f.scene!);
                scrollToId(e, "#demo");
              }}
            >
              {body}
            </a>
          ) : (
            <div key={f.title} className="feat reveal" style={style}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Numbers */

const numbers = (tr: Tr) => [
  { value: tr("7 Mo", "7 MB"), label: tr("pour l'appli", "for the app") },
  { value: "~2 s", label: tr("pour démarrer", "to start") },
  { value: "0", label: tr("compte, pub ou télémétrie", "account, ads or telemetry") },
  { value: "GPL-3.0", label: tr("code ouvert à tous", "code open to all") },
];

function Numbers() {
  const tr = useTr();
  return (
    <section className="numbers" aria-label={tr("En chiffres", "In numbers")}>
      {numbers(tr).map((n, i) => (
        <div key={n.label} className="number reveal" style={{ "--stagger": `${i * 60}ms` } as React.CSSProperties}>
          <strong>{n.value}</strong>
          <span>{n.label}</span>
        </div>
      ))}
    </section>
  );
}

/* ---------------------------------------------------------------- FAQ */

function Faq() {
  const lang = useLang();
  const tr = useTr();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="faq reveal" id="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">{tr("Questions fréquentes", "Frequently asked questions")}</h2>
      <div className="faq-list">
        {faqs(lang).map((f, i) => (
          <div key={f.q} className={`faq-item ${open === i ? "is-open" : ""}`}>
            <button type="button" className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span>{f.q}</span>
              <span className="faq-plus" aria-hidden="true" />
            </button>
            <div className="faq-a">
              <div>
                <p>{f.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- CTA, footer */

/** The winget command, to copy; shown as coming soon until Microsoft accepts Quiera. */
function Winget() {
  const tr = useTr();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(WINGET)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };
  return (
    <div className={`winget ${WINGET_READY ? "" : "is-soon"}`}>
      <div className="winget-head">
        <TerminalIcon />
        <span>{tr("Ou en une commande, avec winget", "Or in one command, with winget")}</span>
        {!WINGET_READY && <em>{tr("Bientôt", "Soon")}</em>}
      </div>
      <div className="winget-cmd">
        <code>{WINGET}</code>
        <button type="button" onClick={copy} disabled={!WINGET_READY} aria-live="polite">
          {copied ? tr("Copié", "Copied") : tr("Copier", "Copy")}
        </button>
      </div>
      <p className="winget-note">
        {WINGET_READY
          ? tr(
              "Dans un terminal Windows. Sans l'écran bleu de SmartScreen, et « winget upgrade » le met à jour.",
              "In a Windows terminal. No blue SmartScreen screen, and “winget upgrade” keeps it up to date.",
            )
          : tr(
              "En validation chez Microsoft : la commande marchera dès que Quiera sera accepté dans winget, sans l'écran bleu de SmartScreen.",
              "In review at Microsoft: the command will work as soon as Quiera is accepted into winget, without the blue SmartScreen screen.",
            )}
      </p>
    </div>
  );
}

function Cta() {
  const tr = useTr();
  return (
    <section className="cta-wrap" id="download">
      <div className="shell">
        <div className="cta reveal">
          <div className="cta-badge">{tr("Natif, léger et gratuit", "Native, light and free")}</div>
          <h2>{tr("Prêt à installer Quiera ?", "Ready to install Quiera?")}</h2>
          <p>
            {tr(
              "Un installateur pour Windows 11, sans inscription. L'île apparaît en haut de l'écran dès le premier lancement.",
              "One installer for Windows 11, no sign-up. The island appears at the top of the screen from the first launch.",
            )}
          </p>
          <div className="cta-actions">
            <a className="btn btn--light btn--lg" href={DOWNLOAD}>
              <WindowsIcon />
              {tr("Télécharger pour Windows", "Download for Windows")}
            </a>
            <a className="btn btn--ghost btn--lg" href={REPO}>
              <GitHubIcon />
              {tr("Voir le code sur GitHub", "View the code on GitHub")}
            </a>
          </div>
          <Winget />
        </div>
      </div>
    </section>
  );
}

function ThemeSwitch({ theme, onTheme }: { theme: Theme; onTheme(t: Theme): void }) {
  const tr = useTr();
  const options: { id: Theme; label: string; icon: ReactNode }[] = [
    { id: "dark", label: tr("Thème sombre", "Dark theme"), icon: <path d="M20.2 14.4A8.5 8.5 0 0 1 9.6 3.8a8.5 8.5 0 1 0 10.6 10.6Z" /> },
    {
      id: "system",
      label: tr("Thème du système", "System theme"),
      icon: (
        <>
          <rect height="11.5" rx="2.2" width="16.5" x="3.75" y="4.5" />
          <path d="M9 19.5h6M12 16v3.5" />
        </>
      ),
    },
    {
      id: "light",
      label: tr("Thème clair", "Light theme"),
      icon: (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.75V5.1M12 18.9v2.35M21.25 12H18.9M5.1 12H2.75M18.54 5.46l-1.66 1.66M7.12 16.88l-1.66 1.66M18.54 18.54l-1.66-1.66M7.12 7.12 5.46 5.46" />
        </>
      ),
    },
  ];
  return (
    <div className="theme-switch" role="radiogroup" aria-label={tr("Thème", "Theme")}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={theme === o.id} aria-label={o.label} title={o.label} onClick={() => onTheme(o.id)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {o.icon}
          </svg>
        </button>
      ))}
    </div>
  );
}

function Footer({ theme, onTheme, onScene }: { theme: Theme; onTheme(t: Theme): void; onScene(id: SceneId): void }) {
  const lang = useLang();
  const tr = useTr();
  const root = rootOf(lang);
  const show = (e: React.MouseEvent, id: SceneId) => {
    onScene(id);
    scrollToId(e, "#demo");
  };
  const product: [SceneId, string][] = [
    ["musique", tr("Musique et paroles", "Music and lyrics")],
    ["agenda", tr("Agenda et miroir", "Calendar and mirror")],
    ["minuteur", tr("Minuteur", "Timer")],
    ["lanceur", tr("Lanceur", "Launcher")],
    ["notifications", "Notifications"],
    ["controles", tr("Contrôles rapides", "Quick controls")],
    ["shelf", tr("Shelf et presse-papiers", "Shelf and clipboard")],
    ["jeux", tr("Raccourci pour les jeux", "Shortcut for games")],
  ];
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-grid">
          <a className="brand brand--big" href="#top" onClick={(e) => scrollToId(e, "#top")} aria-label={tr("Quiera, accueil", "Quiera, home")}>
            <Logo size={38} />
            <span>quiera</span>
          </a>
          <div>
            <h3>{tr("Produit", "Product")}</h3>
            <nav className="footer-links" aria-label={tr("Produit", "Product")}>
              {product.map(([id, label]) => (
                <a key={id} href="#demo" onClick={(e) => show(e, id)}>
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div>
            <h3>{tr("Téléchargement", "Download")}</h3>
            <nav className="footer-links" aria-label={tr("Téléchargement", "Download")}>
              <a href={DOWNLOAD}>Windows 11 (.exe)</a>
              <a href="#download" onClick={(e) => scrollToId(e, "#download")}>
                winget
              </a>
              <a href={RELEASES}>{tr("Toutes les versions", "All releases")}</a>
              <a href={REPO}>{tr("Code source", "Source code")}</a>
            </nav>
          </div>
          <div>
            <h3>{tr("Projet", "Project")}</h3>
            <nav className="footer-links" aria-label={tr("Projet", "Project")}>
              <a href={REPO}>GitHub</a>
              <a href={`${REPO}/issues`}>{tr("Signaler un problème", "Report a problem")}</a>
              <a href={`${REPO}/blob/main/LICENSE`}>{tr("Licence GPL-3.0", "GPL-3.0 licence")}</a>
              <a href={`${root}confidentialite/${lang === "en" ? "#english" : ""}`}>{tr("Confidentialité", "Privacy")}</a>
              <a href={`${root}code-signing/`}>{tr("Compilation des versions", "How releases are built")}</a>
              <a href="#faq" onClick={(e) => scrollToId(e, "#faq")}>
                {tr("Questions fréquentes", "FAQ")}
              </a>
            </nav>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{tr("© 2026 Quiera · logiciel libre sous licence GPL-3.0", "© 2026 Quiera · free software under the GPL-3.0 licence")}</span>
          <div className="footer-tools">
            <LangSwitch />
            <ThemeSwitch theme={theme} onTheme={onTheme} />
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------- App */

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("quiera-theme");
    if (t === "dark" || t === "light") return t;
  } catch {
    /* storage blocked: follow the system */
  }
  return "system";
}

export default function App({ lang }: { lang: Lang }) {
  // The page is prerendered without a stored choice: read it once hydrated.
  const [theme, setTheme] = useState<Theme>("system");
  const themeRead = useRef(false);
  const [scene, setScene] = useState<SceneId>("veille");
  const onScene = useCallback((id: SceneId) => setScene(id), []);
  useReveal();

  useEffect(() => setTheme(readTheme()), []);

  useEffect(() => {
    // The first pass would undo the theme the page's head script applied.
    if (!themeRead.current) {
      themeRead.current = true;
      return;
    }
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      if (theme === "system") localStorage.removeItem("quiera-theme");
      else localStorage.setItem("quiera-theme", theme);
    } catch {
      /* storage blocked: the choice lasts for this visit */
    }
  }, [theme]);

  return (
    <LangContext.Provider value={lang}>
      <Nav />
      <main>
        <Hero scene={scene} onScene={onScene} />
        <Suspense>
          <PlatformBand />
          <Features onScene={onScene} />
          <Numbers />
        </Suspense>
        <Suspense>
          <Faq />
          <Cta />
        </Suspense>
      </main>
      <Suspense>
        <Footer theme={theme} onTheme={setTheme} onScene={onScene} />
      </Suspense>
    </LangContext.Provider>
  );
}
