// vite.config.ts
import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  base: "./",
  plugins: [topLevelAwait(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  optimizeDeps: {
    esbuildOptions: {
      alias: {
        "@automerge/automerge": "file:./vendor/tarballs/automerge.tgz",
      },
    },
  },

  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        "service-worker": path.resolve(__dirname, "service-worker.js"),
      },
      output: {
        // We put index.css in dist instead of dist/assets so that we can link to fonts
        // using relative URLs like "./assets/font.woff2", which is the correct form
        // for deployment to trailrunner.
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "index.css") {
            return "[name][extname]";
          }
          // For all other assets, keep the default behavior
          return "assets/[name]-[hash][extname]";
        },
        entryFileNames: (chunkInfo) => {
          // Specify output location for service-worker.js
          if (chunkInfo.name === "service-worker") {
            return "[name].js"; // This will place service-worker.js directly under dist
          }
          return "assets/[name]-[hash].js"; // Default behavior for other entries
        },
      },
    },
  },

  define: {
    "process.env": {
      NODE_ENV: "production",
    },
  },
});
