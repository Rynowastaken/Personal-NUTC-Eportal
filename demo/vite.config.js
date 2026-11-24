import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: "./",
  build: {
    outDir: path.resolve(root, "../demo-dist"),
    emptyOutDir: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: path.resolve(root, "index.html"),
        ais: path.resolve(root, "ais.html"),
        tronclass: path.resolve(root, "tronclass.html"),
        library: path.resolve(root, "library.html"),
      },
    },
  },
});
