import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { environment: "happy-dom" },
  resolve: {
    alias: {
      // Run tests against the sibling package's source — no prior build needed.
      "@bump-sh/agent-conversation": fileURLToPath(
        new URL("../agent-conversation/src/index.ts", import.meta.url),
      ),
    },
  },
})
