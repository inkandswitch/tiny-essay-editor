// vite.config.ts
import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    topLevelAwait(),
    wasm(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "Tiny Essay Editor",
        short_name: "TEE",
        start_url: "/",
        display: "standalone",
        background_color: "#fff",
        description: "A simple editor for Ink & Switch essays",
        icons: [
          {
            src: "logos/logo-favicon-16x16.png",
            sizes: "16x16",
            type: "image/png",
          },
          {
            src: "logos/logo-favicon-32x32.png",
            sizes: "32x32",
            type: "image/png",
          },
          {
            src: "logos/logo-favicon-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "logos/logo-favicon-96x96.png",
            sizes: "96x96",
            type: "image/png",
          },
          {
            src: "logos/logo-favicon-128x128.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "logos/logo-favicon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "logos/logo-favicon-196x196.png",
            sizes: "196x196",
            type: "image/png",
          },
          {
            src: "logos/logo-favicon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: "es",
    plugins: [wasm()],
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
});
