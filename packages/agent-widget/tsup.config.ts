import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // @bump-sh/agent-conversation stays external in the published build (a dependency);
  // the Bump.sh vendor script bundles everything separately with esbuild --bundle.
})
