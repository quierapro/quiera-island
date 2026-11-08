// The guides' static pages (src/guides.ts): /guides/<slug>/ in French,
// /en/guides/<slug>/ in English, and each language's index. Used by
// scripts/prerender.mjs for the build, and by vite.config.ts in development.

/** A guide's address, from the site's root: "guides/<slug>/" or "en/guides/<slug>/". */
export const guidePath = (lang, slug) => `${lang === "fr" ? "" : "en/"}guides/${slug ? `${slug}/` : ""}`;

/** A guide's address in a language: its own slug there (French ones are in French), or the guide's. */
export const pathOf = (lang, guide) => guidePath(lang, guide[lang].slug ?? guide.slug);

/**
 * Every guide page: `{ path, html, alternates: { fr, en }, lastmod }`. `site` is the site's address (for the
 * canonical links), `englishImage` whether og-image-en.png exists.
 */
export function guidePages({ GUIDES, GUIDES_INDEX, GUIDE_CATEGORIES, FEATURED_GUIDES, site, DOWNLOAD, REPO, englishImage = false }) {
  const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

  const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  /** A guide's text: escaped, then `code`, **bold** and [links](url). */
  const inline = (text) =>
    esc(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`);
  /** The words of a guide's text, without its marks. */
  const plain = (text) => text.replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1").replace(/[`*]/g, "");
  /** "Ce qu'il faut vérifier" → "ce-qu-il-faut-verifier", for a heading's anchor. */
  const anchor = (text) =>
    plain(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const category = (id) => GUIDE_CATEGORIES.find((c) => c.id === id);
  const icon = (id, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${category(id).icon}"/></svg>`;

  const GUIDE_WORDS = {
    fr: {
      home: "/",
      guides: "Guides",
      download: "Télécharger",
      updated: (date) => `Mis à jour le ${new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
      ctaTitle: "Quiera, la Dynamic Island de Windows",
      ctaText: "Ta musique, tes fichiers, ton agenda et tes agents IA en haut de l'écran. Gratuit et open source.",
      ctaButton: "Télécharger pour Windows",
      related: "À lire aussi",
      toc: "Sur cette page",
      featured: "Les plus lus",
      search: "Chercher un guide : paroles, iPhone, minuteur, Claude…",
      count: (n) => `${n} guides`,
      empty: "Aucun guide ne correspond. Essaie un autre mot, ou",
      ask: "pose ta question sur GitHub",
      other: "English",
      legal: ["/mentions-legales/", "Mentions légales"],
      terms: ["/conditions-utilisation/", "Conditions d'utilisation"],
      privacy: ["/confidentialite/", "Confidentialité"],
    },
    en: {
      home: "/en/",
      guides: "Guides",
      download: "Download",
      updated: (date) => `Updated ${new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
      ctaTitle: "Quiera, the Dynamic Island for Windows",
      ctaText: "Your music, your files, your calendar and your AI agents at the top of the screen. Free and open source.",
      ctaButton: "Download for Windows",
      related: "Read next",
      toc: "On this page",
      featured: "Most read",
      search: "Search a guide: lyrics, iPhone, timer, Claude…",
      count: (n) => `${n} guides`,
      empty: "No guide matches. Try another word, or",
      ask: "ask your question on GitHub",
      other: "Français",
      legal: ["/en/legal-notice/", "Legal notice"],
      terms: ["/en/terms/", "Terms of use"],
      privacy: ["/en/privacy/", "Privacy"],
    },
  };

  const LOGO = `<svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true"><g fill="#7136ff"><circle cx="32.2" cy="26.9" r="16.6"/><circle cx="17.7" cy="36.5" r="13.7"/><circle cx="46.3" cy="36.5" r="13.7"/><ellipse cx="32" cy="42" rx="17" ry="13.3"/></g><g fill="#fff"><rect x="21.9" y="26.8" width="7.8" height="14" rx="3.9" transform="rotate(-9 25.8 33.8)"/><rect x="34.6" y="23.7" width="7.8" height="14" rx="3.9" transform="rotate(-9 38.5 30.7)"/></g></svg>`;
  const SEARCH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`;

  /** A guides page: its head, the site's top bar, the content, the footer. */
  function guideShell(lang, { paths, article, title, description, body, data }) {
    const w = GUIDE_WORDS[lang];
    const other = lang === "fr" ? "en" : "fr";
    const url = `${site}${paths[lang]}`;
    return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)} · Quiera</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <link rel="alternate" hreflang="fr" href="${site}${paths.fr}" />
    <link rel="alternate" hreflang="en" href="${site}${paths.en}" />
    <link rel="alternate" hreflang="x-default" href="${site}${paths.fr}" />
    <meta property="og:type" content="${article ? "article" : "website"}" />
    <meta property="og:locale" content="${lang === "fr" ? "fr_FR" : "en_GB"}" />${article ? `
    <meta property="article:modified_time" content="${article}" />` : ""}
    <meta property="og:site_name" content="Quiera" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${site}og-image${lang === "en" && englishImage ? "-en" : ""}.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/guides.css" />
    <script defer src="/_vercel/insights/script.js"></script>
    ${data()}
  </head>
  <body>
    <header class="top">
      <a class="brand" href="${w.home}">${LOGO}<span>quiera</span></a>
      <nav>
        <a href="/${guidePath(lang, "")}">${w.guides}</a>
        <a href="/${paths[other]}" hreflang="${other}" lang="${other}">${w.other}</a>
        <a class="top-download" href="${DOWNLOAD}">${w.download}</a>
      </nav>
    </header>
    <main>
${body}
    </main>
    <footer>
      <nav>
        <a href="/${guidePath(lang, "")}">${w.guides}</a>
        <a href="${w.legal[0]}">${w.legal[1]}</a>
        <a href="${w.terms[0]}">${w.terms[1]}</a>
        <a href="${w.privacy[0]}">${w.privacy[1]}</a>
        <a href="${REPO}">GitHub</a>
      </nav>
      <span>© 2026 Quiera · <a href="${w.home}">quiera.eu</a></span>
    </footer>
  </body>
</html>
`;
  }

  /** A guide as a card: its family, title and description. */
  function card(lang, guide, { big = false } = {}) {
    const g = guide[lang];
    const c = category(guide.category);
    const words = `${g.title} ${g.description} ${c[lang].name}`;
    return `        <li data-search="${esc(words)}"><a class="card${big ? " card--big" : ""}" href="/${pathOf(lang, guide)}">
          <span class="card-kind">${icon(guide.category, 15)}${esc(c[lang].name)}</span>
          <span class="card-title">${esc(g.title)}</span>
          <span class="card-text">${esc(g.description)}</span>
        </a></li>`;
  }

  function cta(lang) {
    const w = GUIDE_WORDS[lang];
    return `      <aside class="cta">
        <div>
          <h3>${w.ctaTitle}</h3>
          <p>${w.ctaText}</p>
        </div>
        <a class="button" href="${DOWNLOAD}">${w.ctaButton}</a>
      </aside>`;
  }

  function guideBody(lang, guide) {
    const w = GUIDE_WORDS[lang];
    const g = guide[lang];
    const c = category(guide.category);
    const blocks = g.blocks
      .map((b) => {
        let html = `        <h2 id="${anchor(b.h2)}">${inline(b.h2)}</h2>\n`;
        for (const p of b.p ?? []) html += `        <p>${inline(p)}</p>\n`;
        if (b.list) html += `        <ul>\n${b.list.map((li) => `          <li>${inline(li)}</li>`).join("\n")}\n        </ul>\n`;
        if (b.steps) html += `        <ol class="steps">\n${b.steps.map((li) => `          <li>${inline(li)}</li>`).join("\n")}\n        </ol>\n`;
        if (b.code) html += `        <pre><code>${esc(b.code)}</code></pre>\n`;
        return html;
      })
      .join("");
    const toc = g.blocks.map((b) => `<li><a href="#${anchor(b.h2)}">${esc(plain(b.h2))}</a></li>`).join("");
    const related = guide.related
      .map((slug) => GUIDES.find((x) => x.slug === slug))
      .filter(Boolean)
      .map((x) => card(lang, x))
      .join("\n");
    const categoryLink = `/${guidePath(lang, "")}#${c.id}`;
    return `      <div class="guide">
        <article>
          <div class="crumbs"><a href="${w.home}">Quiera</a><span>›</span><a href="/${guidePath(lang, "")}">${w.guides}</a><span>›</span><a href="${categoryLink}">${esc(c[lang].name)}</a></div>
          <a class="chip" href="${categoryLink}">${icon(c.id, 15)}${esc(c[lang].name)}</a>
          <h1>${esc(g.title)}</h1>
          <p class="lead">${inline(g.intro)}</p>
          <p class="meta">${w.updated(guide.updated)}</p>
          ${g.blocks.length > 1 ? `<details class="toc-inline"><summary>${w.toc}</summary><ol>${toc}</ol></details>` : ""}
          <div class="prose">
${blocks}        </div>
${cta(lang)}
        </article>
        ${g.blocks.length > 1 ? `<nav class="toc" aria-label="${w.toc}"><p>${w.toc}</p><ol>${toc}</ol></nav>` : ""}
      </div>
      <section class="related">
        <h2 class="section-title">${w.related}</h2>
        <ul class="cards">
${related}
        </ul>
      </section>`;
  }

  /** The index's search: hides the cards that don't hold every typed word. */
  const FILTER = `<script>
      (() => {
        const fold = (s) => s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
        const input = document.getElementById("q");
        const cards = [...document.querySelectorAll("[data-search]")].map((li) => [li, fold(li.dataset.search)]);
        const run = () => {
          const words = fold(input.value).split(/\\s+/).filter(Boolean);
          for (const [li, text] of cards) li.hidden = !words.every((w) => text.includes(w));
          document.querySelector(".featured").hidden = words.length > 0;
          let any = false;
          for (const s of document.querySelectorAll("section.family")) {
            const shown = s.querySelectorAll("li:not([hidden])").length;
            s.hidden = shown === 0;
            any ||= shown > 0;
          }
          document.querySelector(".empty").hidden = any;
        };
        input.addEventListener("input", run);
        if (input.value) run();
      })();
    </script>`;

  function indexBody(lang) {
    const w = GUIDE_WORDS[lang];
    const index = GUIDES_INDEX[lang];
    const families = GUIDE_CATEGORIES.map((c) => ({ c, guides: GUIDES.filter((x) => x.category === c.id) })).filter((f) => f.guides.length);
    const chips = families
      .map(({ c, guides }) => `<a class="chip" href="#${c.id}">${icon(c.id, 15)}${esc(c[lang].name)}<b>${guides.length}</b></a>`)
      .join("\n          ");
    const featured = FEATURED_GUIDES.map((slug) => GUIDES.find((x) => x.slug === slug))
      .filter(Boolean)
      .map((x) => card(lang, x, { big: true }))
      .join("\n");
    const sections = families
      .map(
        ({ c, guides }) => `      <section class="family" id="${c.id}">
        <header class="family-head">
          <span class="family-icon">${icon(c.id, 22)}</span>
          <div>
            <h2>${esc(c[lang].name)}</h2>
            <p>${esc(c[lang].text)}</p>
          </div>
        </header>
        <ul class="cards">
${guides.map((x) => card(lang, x)).join("\n")}
        </ul>
      </section>`,
      )
      .join("\n");
    return `      <section class="hero">
        <div class="crumbs"><a href="${w.home}">Quiera</a><span>›</span>${w.guides}</div>
        <h1>${esc(index.title)}</h1>
        <p class="lead">${esc(index.intro)} <span class="count">${w.count(GUIDES.length)}</span></p>
        <label class="search">${SEARCH}<input id="q" type="search" placeholder="${esc(w.search)}" aria-label="${esc(w.search)}" autocomplete="off" /></label>
        <nav class="chips" aria-label="${w.guides}">
          ${chips}
        </nav>
      </section>
      <section class="featured">
        <h2 class="section-title">${w.featured}</h2>
        <ul class="cards cards--big">
${featured}
        </ul>
      </section>
${sections}
      <p class="empty" hidden>${w.empty} <a href="${REPO}/issues">${w.ask}</a>.</p>
${cta(lang)}
    ${FILTER}`;
  }

  const pages = [];
  for (const lang of ["fr", "en"]) {
    const w = GUIDE_WORDS[lang];
    for (const guide of GUIDES) {
      const g = guide[lang];
      const paths = { fr: pathOf("fr", guide), en: pathOf("en", guide) };
      const url = `${site}${paths[lang]}`;
      const article = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: g.title,
        description: g.description,
        inLanguage: lang,
        datePublished: guide.updated,
        dateModified: guide.updated,
        image: `${site}og-image${lang === "en" && englishImage ? "-en" : ""}.png`,
        author: { "@type": "Organization", name: "Quiera", url: site },
        mainEntityOfPage: url,
        publisher: { "@type": "Organization", name: "Quiera", url: site },
      };
      const crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Quiera", item: `${site}${lang === "fr" ? "" : "en/"}` },
          { "@type": "ListItem", position: 2, name: w.guides, item: `${site}${guidePath(lang, "")}` },
          { "@type": "ListItem", position: 3, name: g.title, item: url },
        ],
      };
      pages.push({
        path: paths[lang],
        alternates: paths,
        lastmod: guide.updated,
        html: guideShell(lang, {
          paths,
          article: guide.updated,
          title: g.title,
          description: g.description,
          body: guideBody(lang, guide),
          data: () => [article, crumbs].map((d) => ld(d)).join("\n    "),
        }),
      });
    }
    const index = GUIDES_INDEX[lang];
    const list = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: GUIDES.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: `${site}${pathOf(lang, x)}`, name: x[lang].title })),
    };
    const paths = { fr: guidePath("fr", ""), en: guidePath("en", "") };
    pages.push({
      path: paths[lang],
      alternates: paths,
      lastmod: GUIDES.map((x) => x.updated).sort().at(-1),
      html: guideShell(lang, { paths, title: index.title, description: index.description, body: indexBody(lang), data: () => ld(list) }),
    });
  }

  return pages;
}
