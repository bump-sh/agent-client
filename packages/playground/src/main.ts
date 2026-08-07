import "./styles.css"
import { createCodePanel } from "./codepanel.js"
import { renderForm } from "./form.js"
import { type State, hasChanges, load, resetAll, save } from "./state.js"

type FrameWindow = Window & { renderWidget?: (state: State) => void }

const state = load()
const frame = document.querySelector("#frame") as HTMLIFrameElement
const codePanel = createCodePanel(document.querySelector("#code") as HTMLElement)
const resetAllButton = document.querySelector("#reset-all") as HTMLButtonElement

const form = document.querySelector("#form") as HTMLFormElement
form.addEventListener("submit", (event) => event.preventDefault())
resetAllButton.addEventListener("click", () => {
  resetAll(state)
  onReset()
})
renderForm(form, state, onChange, onReset)
frame.addEventListener("load", renderPreview)
codePanel.render(state)
resetAllButton.hidden = !hasChanges(state)

let timer: number | undefined
function onChange(): void {
  save(state)
  codePanel.render(state)
  resetAllButton.hidden = !hasChanges(state)
  clearTimeout(timer)
  timer = window.setTimeout(renderPreview, 200)
}

/** A reset changes values outside their controls — rebuild the form to reflect it. */
function onReset(): void {
  rerenderForm()
  onChange()
}

function rerenderForm(): void {
  const open = openSections()
  renderForm(form, state, onChange, onReset)
  for (const details of form.querySelectorAll("details")) {
    const title = details.querySelector("summary")?.textContent ?? ""
    if (open.includes(title)) details.setAttribute("open", "")
  }
}

function openSections(): string[] {
  return [...form.querySelectorAll("details[open] summary")].map(
    (summary) => summary.textContent ?? "",
  )
}

/** Remount the widget in the frame; hand focus back to the field being edited. */
function renderPreview(): void {
  const focused = document.activeElement as HTMLElement | null
  ;(frame.contentWindow as FrameWindow | null)?.renderWidget?.(state)
  focused?.focus()
}
