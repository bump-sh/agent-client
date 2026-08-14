import { defineConfig } from "tsup"

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    // @bump-sh/agent-conversation stays external here (a regular dependency).
  },
  {
    // Self-contained browser bundle for CDNs — what the `unpkg`/`jsdelivr`
    // fields point to, so `<script type="module" src="https://unpkg.com/…">`
    // works without an import map.
    entry: { browser: "src/index.ts" },
    format: ["esm"],
    noExternal: [/^@bump-sh\//],
    minify: true,
    sourcemap: true,
    target: "es2022",
  },
])
