/** Renders the page to HTML at build time, for search engines and link previews. */
import { renderToString } from "react-dom/server";
import { prerender } from "react-dom/static";
import App from "./App";
import type { Lang } from "./i18n";

export { DOWNLOAD, REPO, faqs } from "./content";
export { GUIDES, GUIDES_INDEX, GUIDE_CATEGORIES, FEATURED_GUIDES } from "./guides";

/**
 * The whole page, the lazy demo included, as plain HTML. A first pass loads
 * the demo; the second renders everything in place, without the hidden blocks
 * and inline scripts a streamed render would leave.
 */
export async function render(lang: Lang): Promise<string> {
  await prerender(<App lang={lang} />);
  return renderToString(<App lang={lang} />);
}
