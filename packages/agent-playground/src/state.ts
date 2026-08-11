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

/**
 * Parse options from a query string ("?mode=sidebar&theme.accent=%23e11d48"):
 * one parameter per schema key. The token is deliberately ignored — secrets
 * do not belong in URLs.
 */
export function fromQuery(search: string): State {
  const params = new URLSearchParams(search)
  const overrides: State = {}
  for (const option of OPTIONS) {
    if (option.key === "token") continue
    const value = params.get(option.key)
    // "<" is refused everywhere: launcherIcon/avatar are raw-HTML sinks, and a
    // crafted link must not run script in the (same-origin) preview frame.
    if (value === null || value.includes("<")) continue
    overrides[option.key] =
      typeof option.default === "boolean" ? value === "true" : value
  }
  return overrides
}

/** Serialize for the address bar: only non-default values, never the token. */
export function toQuery(state: State): string {
  const params = new URLSearchParams()
  for (const option of OPTIONS) {
    if (option.key === "token") continue
    const value = state[option.key]
    if (value !== option.default) params.set(option.key, String(value))
  }
  return params.toString()
}

/** Merge URL overrides in. A link aiming at its own endpoint loses the stored token. */
export function applyShared(state: State, shared: State): void {
  if (shared.endpoint && shared.endpoint !== state.endpoint) state.token = ""
  Object.assign(state, shared)
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
