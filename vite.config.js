import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve("frontend/src") },
  },
  build: {
    outDir: "public/generated",
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
