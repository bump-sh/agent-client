// Runs inside the preview iframe — the widget's "host site". The parent page
// calls `renderWidget(state)` on every configuration change. Keeping the
// widget in its own document confines the top-layer dialogs and the fixed
// launcher to the canvas, so the playground controls stay usable.
import { Widget, type WidgetOptions } from "@bump-sh/agent-widget"
import { toOptions } from "./options.js"
import type { State } from "./state.js"

declare global {
  interface Window {
    renderWidget: (state: State) => void
  }
}

let widget: Widget | undefined
let widgetOptions: WidgetOptions | undefined
let lastMode: string | undefined

window.renderWidget = (state, forceRemount = false) => {
  const mode = String(state.mode)
  const { startMessage } = state
  // Entering modal/sidebar starts closed so the launcher (or the
  // stand-in trigger) is what you see first; option tweaks keep the
  // panel as it was except if there's a “startMessage” option.
  const open =
    mode === lastMode &&
    !startMessage &&
    (widget?.element.hasAttribute("open") ?? false)
  document.querySelector("#refresh").classList.remove("visible")
  widget?.destroy()
  lastMode = mode
  syncStage(state)
  // Save state for later remount (refresh)
  widgetOptions = toOptions(state) as WidgetOptions

  // Don't remount Widget if there's a start message in “inline” mode
  // to avoid creating a conversation with the agent each time there's
  // a state change.
  if (mode === "inline" && startMessage && !forceRemount) {
    document.querySelector("#refresh").classList.add("visible")
  } else {
    widget = new Widget({
      ...widgetOptions,
      target: mode === "inline" ? "#inline-stage" : undefined,
      open,
    })
  }
}

document.querySelector("#trigger")?.addEventListener("click", () => widget?.open())
document.querySelector("#refresh")?.addEventListener("click", () => {
  window.renderWidget(widgetOptions || {}, true)
})

function syncStage(state: State): void {
  document.body.dataset.mode = String(state.mode)
  document.body.dataset.launcher = state.launcher === false ? "off" : "on"
}
