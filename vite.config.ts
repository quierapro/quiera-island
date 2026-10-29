import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
import { resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  // Keep Rust errors visible in the terminal during `tauri dev`.
  clearScreen: false,
  server: {
    // Tauri expects this exact port (see devUrl in tauri.conf.json).
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    // Two pages: the island, and the settings window (built only when opened).
    rollupOptions: {
      input: {
        island: resolve(import.meta.dirname, "index.html"),
        settings: resolve(import.meta.dirname, "settings.html"),
      },
    },
  },
});
