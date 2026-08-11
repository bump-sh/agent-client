import { describe, expect, it } from "vitest"
import {
  applyShared,
  defaults,
  fromQuery,
  hasChanges,
  resetAll,
  toQuery,
} from "../src/state.js"

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

describe("fromQuery", () => {
  it("maps schema keys, nested ones and booleans included", () => {
    const overrides = fromQuery(
      "?endpoint=https://x/agent&mode=sidebar&launcher=false&theme.accent=%23e11d48",
    )
    expect(overrides).toEqual({
      endpoint: "https://x/agent",
      mode: "sidebar",
      launcher: false,
      "theme.accent": "#e11d48",
    })
  })

  it("ignores the token and unknown parameters", () => {
    expect(fromQuery("?token=s3cret&utm_source=bump")).toEqual({})
  })

  it("refuses values carrying HTML, which could run script via the icon options", () => {
    expect(fromQuery("?launcherIcon=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E")).toEqual(
      {},
    )
    expect(fromQuery("?title=%3Cscript%3E")).toEqual({})
  })
})

describe("toQuery", () => {
  it("serializes only non-default values and never the token", () => {
    expect(toQuery(defaults())).toBe("")
    const state = {
      ...defaults(),
      endpoint: "https://x/agent",
      token: "s3cret",
      launcher: false,
      "theme.accent": "#e11d48",
    }
    const query = toQuery(state)
    expect(query).toContain("endpoint=")
    expect(query).toContain("launcher=false")
    expect(query).not.toContain("s3cret")
  })

  it("round-trips through fromQuery", () => {
    const state = {
      ...defaults(),
      endpoint: "https://x/agent",
      title: "Weather bot",
      launcher: false,
      "theme.accent": "#e11d48",
    }
    expect(fromQuery(`?${toQuery(state)}`)).toEqual({
      endpoint: "https://x/agent",
      title: "Weather bot",
      launcher: false,
      "theme.accent": "#e11d48",
    })
  })
})

describe("applyShared", () => {
  it("drops the stored token when the link points at another endpoint", () => {
    const state = { ...defaults(), endpoint: "https://mine/agent", token: "s3cret" }
    applyShared(state, { endpoint: "https://evil.com/agent" })
    expect(state.token).toBe("")
    expect(state.endpoint).toBe("https://evil.com/agent")
  })

  it("keeps the token when the endpoint is unchanged or not in the link", () => {
    const same = { ...defaults(), endpoint: "https://mine/agent", token: "s3cret" }
    applyShared(same, { endpoint: "https://mine/agent", title: "Support" })
    expect(same.token).toBe("s3cret")

    const noEndpoint = {
      ...defaults(),
      endpoint: "https://mine/agent",
      token: "s3cret",
    }
    applyShared(noEndpoint, { title: "Support" })
    expect(noEndpoint.token).toBe("s3cret")
  })
})

describe("hasChanges", () => {
  it("ignores connection details and reports real widget changes", () => {
    expect(hasChanges(defaults())).toBe(false)
    expect(hasChanges({ ...defaults(), endpoint: "https://x/agent" })).toBe(false)
    expect(hasChanges({ ...defaults(), launcher: false })).toBe(true)
  })
})
