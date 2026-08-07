import { describe, expect, it } from "vitest"
import { toOptions } from "../src/options.js"
import { defaults } from "../src/state.js"

describe("toOptions", () => {
  it("emits nothing when everything is at its default", () => {
    expect(toOptions(defaults())).toEqual({})
  })

  it("emits only the values that differ from the defaults", () => {
    const state = { ...defaults(), endpoint: "https://x/agent", title: "Support" }
    expect(toOptions(state)).toEqual({ endpoint: "https://x/agent", title: "Support" })
  })

  it("nests dotted keys under their group", () => {
    const state = { ...defaults(), "theme.accent": "#e11d48", "labels.send": "Envoyer" }
    expect(toOptions(state)).toEqual({
      theme: { accent: "#e11d48" },
      labels: { send: "Envoyer" },
    })
  })

  it("keeps meaningful falsy values, like launcher: false and a cleared disclaimer", () => {
    const state = { ...defaults(), launcher: false, disclaimer: "" }
    expect(toOptions(state)).toEqual({ launcher: false, disclaimer: "" })
  })
})
