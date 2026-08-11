import { describe, expect, it } from "vitest"
import { toOptions } from "../src/options.js"
import { defaults } from "../src/state.js"

// The playground starts on inline while the widget defaults to modal, so the
// baseline state carries one deliberate difference. Neutralize it when a test
// is about other options.
const widgetDefaults = () => ({ ...defaults(), mode: "modal" })

describe("toOptions", () => {
  it("emits nothing when everything matches the widget defaults", () => {
    expect(toOptions(widgetDefaults())).toEqual({})
  })

  it("emits the playground's initial mode — inline is not the widget default", () => {
    expect(toOptions(defaults())).toEqual({ mode: "inline" })
  })

  it("emits only the values that differ from the widget defaults", () => {
    const state = { ...widgetDefaults(), endpoint: "https://x/agent", title: "Support" }
    expect(toOptions(state)).toEqual({ endpoint: "https://x/agent", title: "Support" })
  })

  it("nests dotted keys under their group", () => {
    const state = {
      ...widgetDefaults(),
      "theme.accent": "#e11d48",
      "labels.send": "Envoyer",
    }
    expect(toOptions(state)).toEqual({
      theme: { accent: "#e11d48" },
      labels: { send: "Envoyer" },
    })
  })

  it("turns list options into arrays, dropping blank lines and trimming", () => {
    const state = {
      ...widgetDefaults(),
      suggestions: " What can you do? \n\nPricing\n",
    }
    expect(toOptions(state)).toEqual({ suggestions: ["What can you do?", "Pricing"] })
  })

  it("emits nothing for a list option holding only whitespace", () => {
    const state = { ...widgetDefaults(), suggestions: " \n \n" }
    expect(toOptions(state)).toEqual({})
  })

  it("keeps meaningful falsy values, like launcher: false and a cleared disclaimer", () => {
    const state = { ...widgetDefaults(), launcher: false, disclaimer: "" }
    expect(toOptions(state)).toEqual({ launcher: false, disclaimer: "" })
  })
})
