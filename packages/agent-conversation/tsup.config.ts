import { defineConfig } from "tsup"
import pkg from "./package.json"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  banner: { js: `/*! ${pkg.name} v${pkg.version} — ${pkg.license} */` },
})
