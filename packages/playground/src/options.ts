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
    if (value !== option.default) setPath(options, option.key, value)
  }
  return options
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
