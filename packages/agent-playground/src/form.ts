import { type OptionDef, SECTIONS, type Section } from "./schema.js"
import type { State } from "./state.js"

/** Callbacks the form reports through: a value edit, or a reset needing a re-render. */
interface Hooks {
  onChange: () => void
  onReset: () => void
}

/** Render every schema section as form controls bound to `state`. Re-render safe. */
export function renderForm(
  root: HTMLElement,
  state: State,
  onChange: () => void,
  onReset: () => void,
): void {
  root.innerHTML = ""
  for (const section of SECTIONS) {
    root.append(renderSection(section, state, { onChange, onReset }))
  }
}

function renderSection(section: Section, state: State, hooks: Hooks): HTMLElement {
  const container = el(section.advanced ? "details" : "section", "section")
  const heading = el(section.advanced ? "summary" : "h2", "section-title")
  heading.textContent = section.title
  container.append(heading)
  for (const option of section.options) {
    container.append(renderField(option, state, hooks, !section.keepOnReset))
  }
  return container
}

function renderField(
  option: OptionDef,
  state: State,
  hooks: Hooks,
  resettable: boolean,
): HTMLElement {
  if (option.input === "toggle") return toggleField(option, state, hooks)
  const field = el("label", "field")
  field.dataset.key = option.key
  const head = el("span", "field-head")
  head.append(caption(option))
  // One-click controls reset trivially by hand — only free inputs get a button.
  if (resettable && option.input !== "segmented")
    head.append(resetButton(option, state, hooks))
  const notify = () => {
    syncModified(field, option, state)
    hooks.onChange()
  }
  field.append(head, control(option, state, notify))
  syncModified(field, option, state)
  return field
}

function control(option: OptionDef, state: State, onChange: () => void): HTMLElement {
  if (option.input === "segmented") return segmentedControl(option, state, onChange)
  if (option.input === "color") return colorControl(option, state, onChange)
  return textControl(option, state, onChange)
}

function textControl(
  option: OptionDef,
  state: State,
  onChange: () => void,
): HTMLElement {
  const input = el("input", "text-input") as HTMLInputElement
  input.type = "text"
  input.value = String(state[option.key])
  input.placeholder = option.placeholder ?? ""
  input.addEventListener("input", () => {
    state[option.key] = input.value
    onChange()
  })
  return input
}

function colorControl(
  option: OptionDef,
  state: State,
  onChange: () => void,
): HTMLElement {
  const wrap = el("span", "color-control")
  const swatch = el("input", "color-swatch") as HTMLInputElement
  swatch.type = "color"
  const hex = textControl(option, state, onChange) as HTMLInputElement
  const sync = () => syncSwatch(swatch, hex.value || option.fallback || "")
  sync()
  swatch.addEventListener("input", () => {
    hex.value = swatch.value
    hex.dispatchEvent(new Event("input"))
  })
  hex.addEventListener("input", sync)
  wrap.append(swatch, hex)
  return wrap
}

function syncSwatch(swatch: HTMLInputElement, value: string): void {
  if (/^#[0-9a-f]{6}$/i.test(value)) swatch.value = value
}

function segmentedControl(
  option: OptionDef,
  state: State,
  onChange: () => void,
): HTMLElement {
  const group = el("div", "segmented")
  for (const choice of option.choices ?? []) {
    const button = el("button", "segment") as HTMLButtonElement
    button.type = "button"
    button.textContent = choice
    button.setAttribute("aria-pressed", String(state[option.key] === choice))
    button.addEventListener("click", () => {
      state[option.key] = choice
      for (const sibling of group.children)
        sibling.setAttribute("aria-pressed", "false")
      button.setAttribute("aria-pressed", "true")
      onChange()
    })
    group.append(button)
  }
  return group
}

function toggleField(option: OptionDef, state: State, hooks: Hooks): HTMLElement {
  const field = el("label", "field field-row")
  field.dataset.key = option.key
  field.append(caption(option))
  const input = el("input", "toggle-input") as HTMLInputElement
  input.type = "checkbox"
  input.checked = state[option.key] === true
  input.addEventListener("change", () => {
    state[option.key] = input.checked
    syncModified(field, option, state)
    hooks.onChange()
  })
  field.append(input, el("span", "toggle-track"))
  syncModified(field, option, state)
  return field
}

function caption(option: OptionDef): HTMLElement {
  const label = el("span", "field-label")
  label.textContent = option.label
  return label
}

function resetButton(option: OptionDef, state: State, hooks: Hooks): HTMLElement {
  const button = el("button", "field-reset") as HTMLButtonElement
  button.type = "button"
  button.textContent = "Reset"
  button.setAttribute("aria-label", `Reset ${option.label}`)
  button.addEventListener("click", (event) => {
    event.preventDefault() // do not activate the wrapping <label>
    state[option.key] = option.default
    hooks.onReset()
  })
  return button
}

function syncModified(field: HTMLElement, option: OptionDef, state: State): void {
  field.classList.toggle("modified", state[option.key] !== option.default)
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}
