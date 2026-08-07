import { describe, expect, it } from "vitest"
import { defaults, hasChanges, resetAll } from "../src/state.js"

describe("resetAll", () => {
  it("restores widget options but keeps the connection details", () => {
    const state = {
      ...defaults(),
      endpoint: "https://x/agent",
      token: "s3cret",
      title: "Support",
      "theme.accent": "#e11d48",
    }
    resetAll(state)
    expect(state.endpoint).toBe("https://x/agent")
    expect(state.token).toBe("s3cret")
    expect(state.title).toBe("Assistant")
    expect(state["theme.accent"]).toBe("#0a0a0a")
  })
})

describe("hasChanges", () => {
  it("ignores connection details and reports real widget changes", () => {
    expect(hasChanges(defaults())).toBe(false)
    expect(hasChanges({ ...defaults(), endpoint: "https://x/agent" })).toBe(false)
    expect(hasChanges({ ...defaults(), launcher: false })).toBe(true)
  })
})
