// vite.config.ts
import { Plugin, defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { build } from "esbuild"

const SERVICE_WORKER_MODULE_ID = "/service-worker.js"
const SERVICE_WORKER_PATH = path.join(import.meta.dirname, "service-worker.js")

/**
  * This plugin builds the service worker in service-worker.js using esbuild
  *
  * The reason this is necessary is that Firefox does not support ES modules in
  * service workers so we need to build an IIFE script, but we don't want to
  * use IIFE everywhere else.
  */
function swPlugin(): Plugin {
  return {
    name: "service-worker-dev",
    enforce: "pre",
    apply: "serve",
    handleHotUpdate(ctx) {
      if (ctx.file === SERVICE_WORKER_PATH) {
        ctx.server.hot.send({
          type: "full-reload", 
        });
        const module = ctx.server.moduleGraph.getModuleById(SERVICE_WORKER_MODULE_ID)
        if (module != null) {
          ctx.server.moduleGraph.invalidateModule(module)
        }
        return []
      }
    },
    async resolveId(id) {
      if (id === SERVICE_WORKER_MODULE_ID) {
        return SERVICE_WORKER_MODULE_ID;
      }
      if (id === SERVICE_WORKER_PATH) {
        return SERVICE_WORKER_PATH
      }
      return null;
    },
    async load(id) {
      if (id === SERVICE_WORKER_MODULE_ID || id === SERVICE_WORKER_PATH) {
        const result = await build({
          absWorkingDir: import.meta.dirname,
          entryPoints: ["service-worker.js"],
          bundle: true,
          format: "iife",
          write: false,
        })
        return result.outputFiles[0].text
      }
      return null;
    }
  }
}

export default defineConfig({
  base: "./",
  plugins: [swPlugin(), topLevelAwait(), react(), wasm()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  optimizeDeps: {
    exclude: [
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
      input: {
        main: path.resolve(__dirname, "index.html"),
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
      },
    },
  },

  define: {
    "process.env": {
      NODE_ENV: "production",
    },
  },
});
