// Writes the rendered page into dist/index.html, with its structured data,
// so search engines and link previews read it without running JavaScript.
//
// The site's address (SITE_URL overrides it, e.g. for a preview) gives the
// canonical link, og:url and og:image, sitemap.xml and its line in robots.txt.
import { readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const server = join(root, "dist-ssr", "entry-server.js");
const { render, FAQS, REPO, DOWNLOAD } = await import(pathToFileURL(server).href);

const site = (process.env.SITE_URL || "https://quiera.eu/").replace(/\/?$/, "/");
const version = JSON.parse(readFileSync(join(root, "..", "src-tauri", "tauri.conf.json"), "utf8")).version;

const description =
  "Quiera ajoute une Dynamic Island en haut de l'écran de Windows : musique et paroles synchronisées, lanceur d'applis et de fichiers, notifications, contrôles rapides, Shelf et presse-papiers. Gratuit et open source.";

const app = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Quiera",
  alternateName: ["Quiera Island", "Quiera Dynamic Island"],
  description,
  applicationCategory: "UtilitiesApplication",
  applicationSubCategory: "Dynamic Island",
  operatingSystem: "Windows 11",
  softwareVersion: version,
  inLanguage: "fr",
  isAccessibleForFree: true,
  license: "https://www.gnu.org/licenses/gpl-3.0.html",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  downloadUrl: DOWNLOAD,
  sameAs: [REPO],
  featureList: [
    "Lecteur de musique universel (Spotify, Deezer, YouTube…)",
    "Paroles synchronisées mot à mot",
    "Lanceur d'applis et de fichiers façon Spotlight (Alt+Espace)",
    "Notifications de Windows dans l'île",
    "Contrôles rapides : Wi-Fi, Bluetooth, volume par application, sortie audio",
    "Shelf pour garder des fichiers sous la main",
    "Historique du presse-papiers",
    "Aperçus système : chargeur, casque, Verr. Maj, volume",
  ],
  url: site,
  image: `${site}og-image.png`,
  screenshot: `${site}og-image.png`,
};

const faq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Quiera",
  url: site,
  inLanguage: "fr",
};

// "<" escaped so no text can close the script element.
const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

// The two fonts the first screen uses, fetched with the page instead of after its CSS.
const fonts = readdirSync(join(dist, "assets")).filter((f) => /^(inter|urbanist)-latin-wght-normal-.*\.woff2$/.test(f));
if (fonts.length !== 2) throw new Error(`expected 2 fonts to preload, found ${fonts.length}`);

const head = [
  ...fonts.map((f) => `<link rel="preload" href="./assets/${f}" as="font" type="font/woff2" crossorigin />`),
  `<link rel="canonical" href="${site}" />`,
  `<link rel="alternate" hreflang="fr" href="${site}" />`,
  `<link rel="alternate" hreflang="x-default" href="${site}" />`,
  `<meta property="og:url" content="${site}" />`,
  `<meta property="og:image" content="${site}og-image.png" />`,
  `<meta name="twitter:image" content="${site}og-image.png" />`,
  ld(app),
  ld(faq),
  ld(website),
].join("\n    ");

const page = join(dist, "index.html");
let html = readFileSync(page, "utf8");
if (!html.includes('<div id="root"></div>')) throw new Error("dist/index.html: root element not found");
html = html.replace('<div id="root"></div>', `<div id="root">${await render()}</div>`).replace("</head>", `    ${head}\n  </head>`);
writeFileSync(page, html);

// Served on unknown paths by Vercel, GitHub Pages, Netlify…
writeFileSync(
  join(dist, "404.html"),
  `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Page introuvable · Quiera</title>
    <link rel="icon" href="${site}favicon.svg" type="image/svg+xml" />
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #212121; color: #f3f3f3; font-family: "Segoe UI", system-ui, sans-serif; text-align: center; }
      a { display: inline-block; margin-top: 24px; padding: 12px 22px; border-radius: 999px; background: #fff; color: #111; font-weight: 600; text-decoration: none; }
      p { color: #b4b4b8; }
    </style>
  </head>
  <body>
    <main>
      <h1>Page introuvable</h1>
      <p>Cette page n'existe pas, ou plus.</p>
      <a href="${site}">Revenir à Quiera</a>
    </main>
  </body>
</html>
`,
);

const robots = ["User-agent: *", "Allow: /", "", `Sitemap: ${site}sitemap.xml`].join("\n") + "\n";
writeFileSync(join(dist, "robots.txt"), robots);
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["", "confidentialite/", "code-signing/"]
    .map((page) => `  <url>\n    <loc>${site}${page}</loc>\n    <lastmod>${today}</lastmod>\n  </url>\n`)
    .join("")}</urlset>\n`,
);

rmSync(join(root, "dist-ssr"), { recursive: true, force: true });
console.log(`prerendered ${Math.round(html.length / 1024)} kB for ${site}`);
