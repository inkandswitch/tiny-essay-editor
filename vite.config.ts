// vite.config.ts
import {
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  defineConfig,
} from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { globSync } from "glob";
import { fileURLToPath } from "node:url";
import fs from "fs";

const SHARED_DEPENDENCIES = [
  "@automerge/automerge-repo",
  "@automerge/automerge-repo-react-hooks",
  "react",
];

export default defineConfig({
  base: "./",

  plugins: [
    topLevelAwait(),
    react(),
    {
      name: "shared-deps-import-map",
      async transformIndexHtml(html, { server }) {
        if (server) {
          const hash = JSON.parse(
            fs.readFileSync(
              path.join(__dirname, "node_modules/.vite/deps/_metadata.json"),
              "utf-8"
            )
          ).browserHash;

          const importMap = { imports: {} };

          for (const dep of SHARED_DEPENDENCIES) {
            importMap.imports[dep] = `/node_modules/.vite/deps/${dep.replace(
              /\//g,
              "_"
            )}.js?v=${hash}`;
          }

          const tags: HtmlTagDescriptor[] = [
            {
              tag: "script",
              attrs: {
                type: "importmap",
              },
              children: JSON.stringify(importMap, null, 2),
              injectTo: "head-prepend",
            },
          ];

          return { html, tags };
        }
        return html;
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
    minify: false,

    rollupOptions: {
      external: [
        "@automerge/automerge",
        "@automerge/automerge-repo-react-hooks",
        "react",
      ],
      input: {
        main: path.resolve(__dirname, "index.html"),
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
