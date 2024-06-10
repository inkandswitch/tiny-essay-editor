// vite.config.ts
import react from "@vitejs/plugin-react";
import * as cheerio from "cheerio";
import fs from "fs";
import { globSync } from "glob";
import { fileURLToPath } from "node:url";
import path from "path";
import { ViteDevServer, defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

const SHARED_DEPENDENCIES = [
  "@automerge/automerge",
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
      name: "index transform",
      configureServer(server: ViteDevServer) {
        const originalTransformIndexHtml = server.transformIndexHtml;

        server.transformIndexHtml = async (url, html, originalUrl) => {
          const transformed = await originalTransformIndexHtml.call(
            server,
            url,
            html,
            originalUrl
          );

          const $ = cheerio.load(transformed);

          const metadata = JSON.parse(
            fs.readFileSync(
              path.join(__dirname, "node_modules/.vite/deps/_metadata.json"),
              "utf-8"
            )
          );

          const imports = {};
          for (const dep of SHARED_DEPENDENCIES) {
            const m = metadata.optimized[dep];

            if (!m) {
              console.log("can't find", dep);
              continue;
            }

            imports[
              dep
            ] = `./node_modules/.vite/deps/${m.file}?v=${m.fileHash}`;
          }

          $("head").append(
            `<script type="importmap">${JSON.stringify(
              { imports },
              null,
              2
            )}</script>`
          );

          return $.html();
        };
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
      external: SHARED_DEPENDENCIES,
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
