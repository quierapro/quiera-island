import { existsSync, readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { guidePages } from "./scripts/guide-pages.mjs";

/**
 * The guides are static pages written at build time (scripts/prerender.mjs).
 * In development, the same pages are made on each request, so their links
 * work in `pnpm dev` too; so do the plain pages of public/ (legal notice,
 * privacy…), which Vite would otherwise answer with the home page.
 */
function guidesInDevelopment(): Plugin {
  return {
    name: "quiera-guides",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0].replace(/^\/+/, "");
        const plain = new URL(`./public/${path}index.html`, import.meta.url);
        if (path.endsWith("/") && !path.includes("..") && existsSync(plain)) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(readFileSync(plain));
          return;
        }
        if (!/^(en\/)?guides(\/|$)/.test(path)) return next();
        try {
          const { GUIDES, GUIDES_INDEX, GUIDE_CATEGORIES, FEATURED_GUIDES } = await server.ssrLoadModule("/src/guides.ts");
          const { DOWNLOAD, REPO } = await server.ssrLoadModule("/src/content.ts");
          const wanted = path.endsWith("/") ? path : `${path}/`;
          const page = guidePages({ GUIDES, GUIDES_INDEX, GUIDE_CATEGORIES, FEATURED_GUIDES, site: "http://localhost/", DOWNLOAD, REPO }).find(
            (p: { path: string }) => p.path === wanted,
          );
          if (!page) return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(page.html);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

// Relative paths, so the built site works on GitHub Pages under /quiera-island/
// as well as on its own domain.
export default defineConfig({
  plugins: [react(), guidesInDevelopment()],
  base: "./",
});
