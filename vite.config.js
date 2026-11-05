import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Library mode leaves React's process.env checks in the browser bundle.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: {
    alias: { "@": path.resolve("frontend/src") },
  },
  build: {
    outDir: process.env.NUTC_BUILD_OUT_DIR || "public/generated",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve("frontend/src/main.jsx"),
      name: "NutcPortalUI",
      formats: ["es"],
      fileName: () => "ui.js",
      cssFileName: "site",
    },
    rollupOptions: {
      output: {
        entryFileNames: "ui.js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
