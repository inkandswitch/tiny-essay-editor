// This is a separate config file just for the service worker.
// It's needed because we configure rollup to treat some dependencies as external
// for the main code, but we don't want that for the service worker.

import { defineConfig } from "vite";
import path from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  base: "./",
  plugins: [topLevelAwait(), wasm()],
  build: {
    emptyOutDir: false, // because we run this after building the main code, we don't want to clear dist
    rollupOptions: {
      input: {
        "service-worker": path.resolve(__dirname, "service-worker.js"),
      },
      output: {
        entryFileNames: "[name].js", // Ensure service-worker.js is placed directly under dist
      },
    },
  },
  define: {
    "process.env": {
      NODE_ENV: "production",
    },
  },
});
