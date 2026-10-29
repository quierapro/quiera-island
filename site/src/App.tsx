import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SceneId } from "./demo/Demo";
import { DOWNLOAD, FAQS, RELEASES, REPO } from "./content";

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

/* ---------------------------------------------------------------- Nav */

const NAV = [
  { label: "Aperçu", href: "#demo" },
  { label: "Fonctionnalités", href: "#features" },
  { label: "FAQ", href: "#faq" },
  { label: "Téléchargement", href: "#download" },
];

function Nav() {
  const menu = useRef<HTMLDetailsElement>(null);
  const go = (e: React.MouseEvent, href: string) => {
    scrollToId(e, href);
    menu.current?.removeAttribute("open");
  };
  return (
    <header className="nav">
      <div className="nav-row">
        <a className="brand" href="#top" onClick={(e) => go(e, "#top")} aria-label="Quiera, accueil">
          <Logo />
          <span>quiera</span>
        </a>
        <nav className="nav-links" aria-label="Sections">
          {NAV.map((l) => (
            <a key={l.href} href={l.href} onClick={(e) => go(e, l.href)}>
              {l.label}
            </a>
          ))}
        </nav>
        <a className="btn btn--light nav-cta" href={DOWNLOAD}>
          Télécharger
        </a>
        <details className="nav-menu" ref={menu}>
          <summary aria-label="Menu">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </summary>
          <div className="nav-menu-panel">
            {NAV.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => go(e, l.href)}>
                {l.label}
              </a>
            ))}
            <a className="btn btn--light" href={DOWNLOAD}>
              Télécharger
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- Hero */

function DownloadMenu() {
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
      <summary aria-label="Télécharger pour Windows, ou choisir une autre plateforme">
        <a className="download-main" href={DOWNLOAD} onClick={(e) => e.stopPropagation()}>
          <WindowsIcon />
          Télécharger pour Windows
        </a>
        <span className="download-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 9 5 5 5-5" />
          </svg>
        </span>
      </summary>
      <div className="download-panel">
        <div className="download-head">Choisissez votre plateforme</div>
        <a className="download-option" href={DOWNLOAD}>
          <span className="download-icon">
            <WindowsIcon />
          </span>
          <span>
            <strong>Windows 11</strong>
            <small>Installateur · téléchargement direct</small>
          </span>
          <em>.exe</em>
        </a>
        <a className="download-option" href={REPO}>
          <span className="download-icon">
            <GitHubIcon />
          </span>
          <span>
            <strong>Code source</strong>
            <small>GitHub · licence GPL-3.0</small>
          </span>
          <em>Git</em>
        </a>
        <div className="download-option is-soon" aria-disabled="true">
          <span className="download-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="m8 9 3 3-3 3M13 15h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <strong>Linux et macOS</strong>
            <small>En préparation</small>
          </span>
          <em>Bientôt</em>
        </div>
      </div>
    </details>
  );
}

function Hero({ scene, onScene }: { scene: SceneId; onScene(id: SceneId): void }) {
  return (
    <section className="hero" id="top">
      <div className="shell">
        <div className="hero-copy">
          <h1>Dynamic Island native pour Windows</h1>
          <p>
            Quiera met votre musique et ses paroles synchronisées, un lanceur qui trouve applis et fichiers, vos notifications, le Wi-Fi et
            le son, un Shelf et un presse-papiers au sommet de votre écran.
            <br />
            <strong>Léger, open source et 100 % gratuit.</strong>
          </p>
          <div className="hero-actions">
            <DownloadMenu />
            <a className="btn btn--ghost btn--lg" href="#features" onClick={(e) => scrollToId(e, "#features")}>
              Explorer les fonctionnalités
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
  return (
    <section className="band" aria-label="Compatibilité">
      <p className="band-lead reveal">Fonctionne avec les applis qui annoncent leur lecture à Windows</p>
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

const FEATURES: { title: string; desc: string; icon: ReactNode; scene?: SceneId }[] = [
  {
    title: "Lecteur universel",
    desc: "Spotify, Deezer, YouTube dans le navigateur… toute appli qui annonce sa lecture à Windows. Pochette, progression, aléatoire et répétition.",
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
    title: "Paroles synchronisées",
    desc: "Mot à mot dans la pilule, ligne par ligne dans le lecteur. Un clic sur une ligne pour y aller, un décalage réglable si elles arrivent en avance.",
    icon: icon(
      <>
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
      </>,
    ),
    scene: "musique",
  },
  {
    title: "Lanceur façon Spotlight",
    desc: "Alt+Espace (modifiable) : applis, fichiers de tous vos disques, calculs et recherche web. « images », « vidéos » ou « musique » filtrent par type.",
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
    desc: "Celles de Windows passent sur l'île quelques secondes, puis restent dans leur onglet. Un clic ouvre l'appli. Le mode Ne pas déranger est respecté.",
    icon: icon(
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>,
    ),
    scene: "notifications",
  },
  {
    title: "Contrôles rapides",
    desc: "Wi-Fi, Bluetooth, volume général, sortie audio et volume de chaque application, sans ouvrir les Paramètres.",
    icon: icon(<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" />),
    scene: "controles",
  },
  {
    title: "Shelf",
    desc: "Glissez des fichiers sur l'île pour les garder de côté le temps d'une tâche, puis faites-les glisser là où il faut.",
    icon: icon(
      <>
        <path d="M3.5 13.5 6 5.8A2 2 0 0 1 7.9 4.5h8.2A2 2 0 0 1 18 5.8l2.5 7.7" />
        <path d="M3.5 13.5V17a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5v-3.5h-5l-1 2h-5l-1-2Z" />
      </>,
    ),
    scene: "shelf",
  },
  {
    title: "Presse-papiers",
    desc: "Vos derniers textes, liens et images copiés ; un clic les recopie. Gardés en mémoire seulement, et les contenus marqués privés (mots de passe) sont ignorés.",
    icon: icon(
      <>
        <rect x="5.5" y="5" width="13" height="15.5" rx="2.5" />
        <path d="M9 5V4.3A1.3 1.3 0 0 1 10.3 3h3.4A1.3 1.3 0 0 1 15 4.3V5M9 11h6M9 14.5h4" />
      </>,
    ),
    scene: "shelf",
  },
  {
    title: "Aperçus système",
    desc: "Chargeur branché, casque connecté avec sa batterie, Verr. Maj, volume : un aperçu discret, puis l'île se range. Chacun se coupe dans les réglages.",
    icon: icon(
      <>
        <rect x="2" y="7" width="17" height="10" rx="2.5" />
        <path d="M22 11v2M6 10v4M9.5 10v4" />
      </>,
    ),
    scene: "veille",
  },
  {
    title: "Discrète et légère",
    desc: "Se cache pendant les jeux et les vidéos en plein écran, presque aucun processeur au repos, et un démarrage avec Windows au choix.",
    icon: icon(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  },
];

function Features({ onScene }: { onScene(id: SceneId): void }) {
  return (
    <section className="features" id="features" aria-labelledby="features-title">
      <div className="section-head reveal">
        <h2 id="features-title">Fonctionnalités pensées pour votre bureau</h2>
        <p>Tout ce que Quiera ajoute à Windows, sans fenêtre de plus : l'île s'ouvre quand vous en avez besoin, et se fait oublier le reste du temps.</p>
      </div>
      <div className="features-grid">
        {FEATURES.map((f, i) => {
          const body = (
            <>
              <span className="feat-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              {f.scene && <span className="feat-try">Voir dans l'aperçu →</span>}
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

const NUMBERS = [
  { value: "7 Mo", label: "pour l'appli" },
  { value: "~2 s", label: "pour démarrer" },
  { value: "0", label: "compte, pub ou télémétrie" },
  { value: "GPL-3.0", label: "code ouvert à tous" },
];

function Numbers() {
  return (
    <section className="numbers" aria-label="En chiffres">
      {NUMBERS.map((n, i) => (
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
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="faq reveal" id="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Questions fréquentes</h2>
      <div className="faq-list">
        {FAQS.map((f, i) => (
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

function Cta() {
  return (
    <section className="cta-wrap" id="download">
      <div className="shell">
        <div className="cta reveal">
          <div className="cta-badge">Natif, léger et gratuit</div>
          <h2>Prêt à installer Quiera ?</h2>
          <p>Un installateur pour Windows 11, sans inscription. L'île apparaît en haut de l'écran dès le premier lancement.</p>
          <div className="cta-actions">
            <a className="btn btn--light btn--lg" href={DOWNLOAD}>
              <WindowsIcon />
              Télécharger pour Windows
            </a>
            <a className="btn btn--ghost btn--lg" href={REPO}>
              <GitHubIcon />
              Voir le code sur GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function ThemeSwitch({ theme, onTheme }: { theme: Theme; onTheme(t: Theme): void }) {
  const options: { id: Theme; label: string; icon: ReactNode }[] = [
    { id: "dark", label: "Thème sombre", icon: <path d="M20.2 14.4A8.5 8.5 0 0 1 9.6 3.8a8.5 8.5 0 1 0 10.6 10.6Z" /> },
    {
      id: "system",
      label: "Thème du système",
      icon: (
        <>
          <rect height="11.5" rx="2.2" width="16.5" x="3.75" y="4.5" />
          <path d="M9 19.5h6M12 16v3.5" />
        </>
      ),
    },
    {
      id: "light",
      label: "Thème clair",
      icon: (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.75V5.1M12 18.9v2.35M21.25 12H18.9M5.1 12H2.75M18.54 5.46l-1.66 1.66M7.12 16.88l-1.66 1.66M18.54 18.54l-1.66-1.66M7.12 7.12 5.46 5.46" />
        </>
      ),
    },
  ];
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Thème">
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
  const show = (e: React.MouseEvent, id: SceneId) => {
    onScene(id);
    scrollToId(e, "#demo");
  };
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-grid">
          <a className="brand brand--big" href="#top" onClick={(e) => scrollToId(e, "#top")} aria-label="Quiera, accueil">
            <Logo size={38} />
            <span>quiera</span>
          </a>
          <div>
            <h3>Produit</h3>
            <nav className="footer-links" aria-label="Produit">
              <a href="#demo" onClick={(e) => show(e, "musique")}>
                Musique et paroles
              </a>
              <a href="#demo" onClick={(e) => show(e, "lanceur")}>
                Lanceur
              </a>
              <a href="#demo" onClick={(e) => show(e, "notifications")}>
                Notifications
              </a>
              <a href="#demo" onClick={(e) => show(e, "controles")}>
                Contrôles rapides
              </a>
              <a href="#demo" onClick={(e) => show(e, "shelf")}>
                Shelf et presse-papiers
              </a>
            </nav>
          </div>
          <div>
            <h3>Téléchargement</h3>
            <nav className="footer-links" aria-label="Téléchargement">
              <a href={DOWNLOAD}>Windows 11 (.exe)</a>
              <a href={RELEASES}>Toutes les versions</a>
              <a href={REPO}>Code source</a>
            </nav>
          </div>
          <div>
            <h3>Projet</h3>
            <nav className="footer-links" aria-label="Projet">
              <a href={REPO}>GitHub</a>
              <a href={`${REPO}/issues`}>Signaler un problème</a>
              <a href={`${REPO}/blob/main/LICENSE`}>Licence GPL-3.0</a>
              <a href="#faq" onClick={(e) => scrollToId(e, "#faq")}>
                Questions fréquentes
              </a>
            </nav>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Quiera · logiciel libre sous licence GPL-3.0</span>
          <ThemeSwitch theme={theme} onTheme={onTheme} />
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

export default function App() {
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
    <>
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
    </>
  );
}
