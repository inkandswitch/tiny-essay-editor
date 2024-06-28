import { build } from "esbuild"

await build({
  absWorkingDir: import.meta.dirname,
  entryPoints: ["service-worker.js"],
  outfile: "dist/service-worker.js",
  bundle: true,
  format: "iife",
})
