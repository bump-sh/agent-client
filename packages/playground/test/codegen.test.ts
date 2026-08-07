import { describe, expect, it } from "vitest"
import { htmlSnippet, jsSnippet } from "../src/codegen.js"
import { defaults } from "../src/state.js"

describe("jsSnippet", () => {
  it("shows a fill-in endpoint and nothing else at the defaults", () => {
    expect(jsSnippet(defaults())).toBe(
      [
        'import { Widget } from "@bump-sh/agent-widget"',
        "",
        "new Widget({",
        '  endpoint: "https://your-host/demo/weather/agent",',
        "})",
      ].join("\n"),
    )
  })

  it("emits changed options, nesting theme and labels inline", () => {
    const state = {
      ...defaults(),
      endpoint: "https://x/agent",
      launcher: false,
      "theme.accent": "#e11d48",
      "labels.send": "Envoyer",
    }
    const snippet = jsSnippet(state)
    expect(snippet).toContain('  endpoint: "https://x/agent",')
    expect(snippet).toContain("  launcher: false,")
    expect(snippet).toContain('  theme: { accent: "#e11d48" },')
    expect(snippet).toContain('  labels: { send: "Envoyer" },')
  })

  it("quotes values safely", () => {
    const state = { ...defaults(), title: 'Say "hi"' }
    expect(jsSnippet(state)).toContain('  title: "Say \\"hi\\"",')
  })
})

describe("htmlSnippet", () => {
  it("renders the element with only the changed attributes", () => {
    const state = { ...defaults(), endpoint: "https://x/agent", mode: "sidebar" }
    expect(htmlSnippet(state)).toContain(
      '<agent-widget endpoint="https://x/agent" mode="sidebar"></agent-widget>',
    )
  })

  it("emits changed theme tokens as CSS custom properties", () => {
    const state = { ...defaults(), "theme.accent": "#e11d48" }
    expect(htmlSnippet(state)).toContain("    --agent-accent: #e11d48;")
    expect(htmlSnippet(defaults())).not.toContain("<style>")
  })

  it("flags JS-only options and escapes attribute values", () => {
    const state = { ...defaults(), launcher: false, greeting: "Hi", title: 'a"b' }
    const snippet = htmlSnippet(state)
    expect(snippet).toContain(
      "<!-- launcher, greeting need the JS API — see the JavaScript tab. -->",
    )
    expect(snippet).toContain('title="a&quot;b"')
    expect(htmlSnippet({ ...defaults(), greeting: "Hi" })).toContain(
      "<!-- greeting needs the JS API",
    )
  })
})
