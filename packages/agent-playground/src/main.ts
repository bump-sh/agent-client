import "./styles.css"
import { createCodePanel } from "./codepanel.js"
import { checkEndpoint } from "./endpoint-check.js"
import { renderForm } from "./form.js"
import {
  type State,
  applyShared,
  fromQuery,
  hasChanges,
  load,
  resetAll,
  save,
  toQuery,
} from "./state.js"

type FrameWindow = Window & { renderWidget?: (state: State) => void }

const state = load()
const shared = fromQuery(location.search)
if (Object.keys(shared).length > 0) {
  applyShared(state, shared)
  save(state)
}
syncUrl()
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
scheduleEndpointCheck()

let timer: number | undefined
function onChange(): void {
  save(state)
  codePanel.render(state)
  resetAllButton.hidden = !hasChanges(state)
  scheduleEndpointCheck()
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    renderPreview()
    syncUrl()
  }, 200)
}

/**
 * Keep the address bar shareable: it always mirrors the non-default options.
 * Debounced with the preview — Safari rate-limits replaceState.
 */
function syncUrl(): void {
  const query = toQuery(state)
  history.replaceState(null, "", query ? `?${query}` : location.pathname)
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
  setEndpointNote(lastNote.text, lastNote.kind)
}

// ---- endpoint validation ----
let probeTimer: number | undefined
let probeController: AbortController | undefined
let lastProbed: string | undefined
let lastNote = { text: "", kind: "" }

/** Probe the endpoint (debounced) whenever the endpoint or token changed. */
function scheduleEndpointCheck(): void {
  const signature = `${state.endpoint}|${state.token}`
  if (signature === lastProbed) return
  lastProbed = signature
  probeController?.abort()
  clearTimeout(probeTimer)
  setEndpointNote("", "")
  if (state.endpoint) probeTimer = window.setTimeout(runEndpointCheck, 600)
}

async function runEndpointCheck(): Promise<void> {
  probeController = new AbortController()
  setEndpointNote("Checking the endpoint…", "checking")
  try {
    const error = await checkEndpoint(
      String(state.endpoint),
      String(state.token),
      probeController.signal,
    )
    if (error) setEndpointNote(error, "error")
    else setEndpointNote("✓ Agent endpoint verified", "ok")
  } catch {
    // aborted — a newer probe owns the field
  }
}

function setEndpointNote(text: string, kind: string): void {
  lastNote = { text, kind }
  const field = form.querySelector('[data-key="endpoint"]') as HTMLElement
  let note = field.querySelector(".field-note") as HTMLElement | null
  if (!note) {
    note = document.createElement("span")
    note.className = "field-note"
    field.append(note)
  }
  note.textContent = text
  note.dataset.kind = kind
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
