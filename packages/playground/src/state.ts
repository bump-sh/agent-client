import { OPTIONS, type OptionDef, SECTIONS, type Value } from "./schema.js"

export type State = Record<string, Value>

const STORAGE_KEY = "agent-playground.state"

export function defaults(): State {
  return Object.fromEntries(OPTIONS.map((option) => [option.key, option.default]))
}

/** Defaults overlaid with whatever survived in localStorage (unknown keys dropped). */
export function load(): State {
  const state = defaults()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
    for (const key of Object.keys(state)) {
      if (typeof saved[key] === typeof state[key]) state[key] = saved[key]
    }
  } catch {
    // corrupt storage → start from defaults
  }
  return state
}

export function save(state: State): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** Restore every widget option to its default; connection details survive. */
export function resetAll(state: State): void {
  for (const option of resettableOptions()) state[option.key] = option.default
}

/** True when any resettable option differs from its default. */
export function hasChanges(state: State): boolean {
  return resettableOptions().some((option) => state[option.key] !== option.default)
}

function resettableOptions(): OptionDef[] {
  return SECTIONS.filter((section) => !section.keepOnReset).flatMap(
    (section) => section.options,
  )
}
