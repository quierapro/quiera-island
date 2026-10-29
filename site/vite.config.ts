import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative paths, so the built site works on GitHub Pages under /quiera-island/
// as well as on its own domain.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
