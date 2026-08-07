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
let lastMode: string | undefined

window.renderWidget = (state) => {
  const mode = String(state.mode)
  // Entering modal/sidebar starts closed so the launcher (or the stand-in
  // trigger) is what you see first; option tweaks keep the panel as it was.
  const open = mode === lastMode && (widget?.element.hasAttribute("open") ?? false)
  widget?.destroy()
  lastMode = mode
  syncStage(state)
  widget = new Widget({
    ...(toOptions(state) as WidgetOptions),
    target: mode === "inline" ? "#inline-stage" : undefined,
    open,
  })
}

document.querySelector("#trigger")?.addEventListener("click", () => widget?.open())

function syncStage(state: State): void {
  document.body.dataset.mode = String(state.mode)
  document.body.dataset.launcher = state.launcher === false ? "off" : "on"
}
