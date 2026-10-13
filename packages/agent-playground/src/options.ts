import { OPTIONS } from "./schema.js"
import type { State } from "./state.js"

export type Options = Record<string, unknown>

/**
 * Build the options object a user would actually write: only the values that
 * differ from the widget's defaults, with dotted keys nested ("theme.accent"
 * → { theme: { accent } }). Drives both the live preview and the code panel.
 */
export function toOptions(state: State): Options {
  const options: Options = {}
  for (const option of OPTIONS) {
    const value = state[option.key]
    if (value === option.default) continue
    if (option.input === "list") setList(options, option.key, String(value))
    else if (option.input === "record") setRecord(options, option.key, String(value))
    else setPath(options, option.key, value)
  }
  return options
}

/** A list option holds one item per line in the form; emit it as a clean array. */
function setList(target: Options, key: string, value: string): void {
  const items = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  if (items.length > 0) setPath(target, key, items)
}

/** A record option holds one key:value pair per line in the form; emit it as a clean object. */
function setRecord(target: Options, key: string, value: string): void {
  const items = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(": ", 2))
  if (items.length > 0) setPath(target, key, Object.fromEntries(items))
}

function setPath(target: Options, key: string, value: unknown): void {
  const dot = key.indexOf(".")
  if (dot < 0) {
    target[key] = value
    return
  }
  const head = key.slice(0, dot)
  const tail = key.slice(dot + 1)
  target[head] ??= {}
  ;(target[head] as Options)[tail] = value
}
