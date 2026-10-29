/** Renders the page to HTML at build time, for search engines and link previews. */
import { renderToString } from "react-dom/server";
import { prerender } from "react-dom/static";
import App from "./App";

export { DOWNLOAD, FAQS, REPO } from "./content";

/**
 * The whole page, the lazy demo included, as plain HTML. A first pass loads
 * the demo; the second renders everything in place, without the hidden blocks
 * and inline scripts a streamed render would leave.
 */
export async function render(): Promise<string> {
  await prerender(<App />);
  return renderToString(<App />);
}
