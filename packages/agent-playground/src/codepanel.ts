import { htmlSnippet, jsSnippet } from "./codegen.js"
import type { State } from "./state.js"

const TABS = [
  { label: "JavaScript", generate: jsSnippet },
  { label: "HTML", generate: htmlSnippet },
]

/** The bottom panel: tabbed snippets regenerated on every change, one-click copy. */
export function createCodePanel(root: HTMLElement): { render: (s: State) => void } {
  root.innerHTML = `
    <header class="code-bar">
      <div class="tabs" role="tablist"></div>
      <button class="copy" type="button">Copy</button>
    </header>
    <pre><code></code></pre>`
  const code = root.querySelector("code") as HTMLElement
  let active = 0
  let current: State | undefined
  const refresh = (): void => {
    const tab = TABS[active]
    if (current && tab) code.textContent = tab.generate(current)
  }
  renderTabs(root, (index) => {
    active = index
    refresh()
  })
  wireCopy(root, code)
  return {
    render(state: State) {
      current = state
      refresh()
    },
  }
}

function renderTabs(root: HTMLElement, onSelect: (index: number) => void): void {
  const tabs = root.querySelector(".tabs") as HTMLElement
  TABS.forEach((tab, index) => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "tab"
    button.textContent = tab.label
    button.setAttribute("aria-pressed", String(index === 0))
    button.addEventListener("click", () => {
      for (const sibling of tabs.children) sibling.setAttribute("aria-pressed", "false")
      button.setAttribute("aria-pressed", "true")
      onSelect(index)
    })
    tabs.append(button)
  })
}

function wireCopy(root: HTMLElement, code: HTMLElement): void {
  const copy = root.querySelector(".copy") as HTMLButtonElement
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(code.textContent ?? "")
    copy.textContent = "Copied"
    setTimeout(() => {
      copy.textContent = "Copy"
    }, 1200)
  })
}
