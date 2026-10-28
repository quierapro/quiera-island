import { useEffect } from "react";
import { Island } from "./island/Island";

export default function App() {
  // The WebView's own context menu (reload, inspect…) has no place on the
  // island; it stays available in development.
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const block = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", block);
    return () => window.removeEventListener("contextmenu", block);
  }, []);

  return <Island />;
}
