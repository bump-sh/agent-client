import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { environment: "happy-dom" },
  resolve: {
    alias: {
      // Run tests against the sibling package's source — no prior build needed.
      "@bump-sh/agent-client": fileURLToPath(
        new URL("../agent-client/src/index.ts", import.meta.url),
      ),
    },
  },
})
