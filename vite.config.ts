// vite.config.ts
import react from "@vitejs/plugin-react";
import { globSync } from "glob";
import { fileURLToPath } from "node:url";
import path from "path";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

const IMPORT_MAP = {
  "@automerge/automerge":
    "https://ga.jspm.io/npm:@automerge/automerge@2.2.2/dist/mjs/index.js",
  "@automerge/automerge-repo":
    "https://ga.jspm.io/npm:@automerge/automerge-repo@1.1.12/dist/index.js",
  "@automerge/automerge-repo-network-broadcastchannel":
    "https://ga.jspm.io/npm:@automerge/automerge-repo-network-broadcastchannel@1.1.12/dist/index.js",
  "@automerge/automerge-repo-network-messagechannel":
    "https://ga.jspm.io/npm:@automerge/automerge-repo-network-messagechannel@1.1.12/dist/index.js",
  "@automerge/automerge-repo-network-websocket":
    "https://ga.jspm.io/npm:@automerge/automerge-repo-network-websocket@1.1.12/dist/index.js",
  "@automerge/automerge-repo-react-hooks":
    "https://ga.jspm.io/npm:@automerge/automerge-repo-react-hooks@1.1.12/dist/index.js",
  "@automerge/automerge-repo-storage-indexeddb":
    "https://ga.jspm.io/npm:@automerge/automerge-repo-storage-indexeddb@1.1.12/dist/index.js",
  "@automerge/automerge-wasm":
    "https://ga.jspm.io/npm:@automerge/automerge-wasm@0.17.0/bundler/automerge_wasm.js",
  "@automerge/automerge/next":
    "https://ga.jspm.io/npm:@automerge/automerge@2.2.2/dist/mjs/next.js",
  react: "https://ga.jspm.io/npm:react@18.3.1/dev.index.js",
  "react-dom": "https://ga.jspm.io/npm:react-dom@18.3.1/dev.index.js",
  "react-dom/client": "https://ga.jspm.io/npm:react-dom@18.3.1/dev.client.js",
  "react/jsx-dev-runtime":
    "https://ga.jspm.io/npm:react@18.3.1/dev.jsx-dev-runtime.js",
  "react/jsx-runtime": "https://ga.jspm.io/npm:react@18.3.1/dev.jsx-runtime.js",
};

const EXTERNALS = Object.keys(IMPORT_MAP);

export default defineConfig({
  base: "./",
  plugins: [
    topLevelAwait(),
    react(),
    // replace dependencies in import map with url
    {
      name: "resolve-external-deps",
      enforce: "pre",
      resolveId(source) {
        if (IMPORT_MAP[source]) {
          return IMPORT_MAP[source];
        }
        return null;
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  optimizeDeps: {
    // This is necessary because otherwise `vite dev` includes two separate
    // versions of the JS wrapper. This causes problems because the JS
    // wrapper has a module level variable to track JS side heap
    // allocations, and initializing this twice causes horrible breakage
    exclude: [
      "@automerge/automerge-wasm",
      "@automerge/automerge-wasm/bundler/bindgen_bg.wasm",
      "@syntect/wasm",
    ],
  },

  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  build: {
    rollupOptions: {
      external: EXTERNALS,
      input: {
        main: path.resolve(__dirname, "index.html"),
        "service-worker": path.resolve(__dirname, "service-worker.js"),
        ...Object.fromEntries(
          globSync(
            path.resolve(__dirname, "src/datatypes/*/module.@(ts|js|tsx|jsx)")
          ).map((path) => {
            const datatypeId = path.split("/").slice(-2)[0];

            return [
              `dataType-${datatypeId}`,
              fileURLToPath(new URL(path, import.meta.url)),
            ];
          })
        ),
        ...Object.fromEntries(
          globSync(
            path.resolve(__dirname, "src/tools/*/module.@(ts|js|tsx|jsx)")
          ).map((path) => {
            const toolId = path.split("/").slice(-2)[0];

            return [
              `tool-${toolId}`,
              fileURLToPath(new URL(path, import.meta.url)),
            ];
          })
        ),
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

          // output tools under "/tools"
          if (chunkInfo.name.startsWith("tool-")) {
            const typeId = chunkInfo.name.split("-")[1];
            return `tools/${typeId}.js`;
          }

          // output datatypes under "/dataTypes"
          if (chunkInfo.name.startsWith("dataType-")) {
            const typeId = chunkInfo.name.split("-")[1];
            return `dataTypes/${typeId}.js`;
          }

          return "assets/[name]-[hash].js"; // Default behavior for other entries
        },
        exports: "named",
      },
      preserveEntrySignatures: "allow-extension",
    },
  },

  define: {
    "process.env": {
      NODE_ENV: "production",
    },
  },
});
