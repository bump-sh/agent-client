import { type Options, toOptions } from "./options.js"
import { OPTIONS, type OptionDef } from "./schema.js"
import type { State } from "./state.js"

const FALLBACK_ENDPOINT = "https://your-host/demo/weather/agent"

/** The exact JS a user writes to get the configured widget. */
export function jsSnippet(state: State): string {
  const options = withEndpoint(toOptions(state))
  const lines = Object.entries(options).map(
    ([key, value]) => `  ${key}: ${literal(value)},`,
  )
  return [
    'import { Widget } from "@bump-sh/agent-widget"',
    "",
    "new Widget({",
    ...lines,
    "})",
  ].join("\n")
}

/** The declarative equivalent: element attributes + CSS tokens, JS-only options flagged. */
export function htmlSnippet(state: State): string {
  const parts = [
    '<script type="module" src="https://unpkg.com/@bump-sh/agent-widget"></script>',
    "",
    elementTag(state),
  ]
  const css = cssBlock(state)
  if (css) parts.push("", css)
  const note = jsOnlyNote(state)
  if (note) parts.push("", note)
  return parts.join("\n")
}

/** `endpoint` is required, so the snippet always shows one — a fill-in when unset. */
function withEndpoint(options: Options): Options {
  return { endpoint: FALLBACK_ENDPOINT, ...options }
}

function literal(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`
  if (typeof value !== "object" || value === null) return JSON.stringify(value)
  const entries = Object.entries(value).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
  return `{ ${entries.join(", ")} }`
}

function changed(state: State): OptionDef[] {
  return OPTIONS.filter((option) => state[option.key] !== option.default)
}

function elementTag(state: State): string {
  const attrs = [
    `endpoint="${escapeAttr(String(state.endpoint || FALLBACK_ENDPOINT))}"`,
  ]
  for (const option of changed(state)) {
    if (!option.attribute || option.key === "endpoint") continue
    attrs.push(`${option.attribute}="${escapeAttr(String(state[option.key]))}"`)
  }
  return `<agent-widget ${attrs.join(" ")}></agent-widget>`
}

function cssBlock(state: State): string {
  const vars = changed(state)
    .filter((option) => option.cssVar)
    .map((option) => `    ${option.cssVar}: ${state[option.key]};`)
  if (vars.length === 0) return ""
  return ["<style>", "  agent-widget {", ...vars, "  }", "</style>"].join("\n")
}

function jsOnlyNote(state: State): string {
  const names = new Set(
    changed(state)
      .filter((option) => !option.attribute && !option.cssVar)
      .map((option) => option.key.split(".")[0]),
  )
  if (names.size === 0) return ""
  const verb = names.size > 1 ? "need" : "needs"
  return `<!-- ${[...names].join(", ")} ${verb} the JS API — see the JavaScript tab. -->`
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
