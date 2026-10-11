import type { FrontendTool } from "@bump-sh/agent-conversation"
import { type AgentWidget, defineAgentWidget } from "./element.js"
import type { ConversationLike, WidgetOptions } from "./types.js"

function resolveTarget(options: WidgetOptions): HTMLElement {
  // Modal/sidebar float over the page → always attach to <body>.
  if (options.mode && options.mode !== "inline") return document.body
  if (typeof options.target === "string") {
    const el = document.querySelector(options.target)
    if (!el) throw new Error(`Widget: target "${options.target}" not found.`)
    return el as HTMLElement
  }
  return options.target ?? document.body
}

/**
 * Create and mount a chat widget in one line:
 *
 * ```ts
 * new Widget({ endpoint: "https://host/agent" })
 * ```
 *
 * The instance is the handle: `open()`, `close()`, `toggle()`, `addFrontendTool()`,
 * `removeFrontendTool()`, `destroy()`, `conversation`.
 */
export class Widget {
  #element: AgentWidget

  constructor(options: WidgetOptions = {}) {
    defineAgentWidget()
    const element = document.createElement("agent-widget") as AgentWidget
    element.configure(options)
    resolveTarget(options).appendChild(element)
    this.#element = element
    if (options.open) element.open()
  }

  get element(): AgentWidget {
    return this.#element
  }
  get conversation(): ConversationLike {
    return this.#element.conversation
  }

  async sendMessage(content: string): Promise<void> {
    if (this.#element.hasAttribute("open")) {
      return this.#element.sendMessage(content)
    }

    return Promise.resolve()
  }

  /** Let the agent call a tool of the page. */
  addFrontendTool(tool: FrontendTool): void {
    this.#element.addFrontendTool(tool)
  }

  /** Stop the agent calling a tool of the page. */
  removeFrontendTool(name: string): void {
    this.#element.removeFrontendTool(name)
  }

  open(): void {
    this.#element.open()
  }
  close(): void {
    this.#element.close()
  }
  toggle(): void {
    this.#element.toggle()
  }
  destroy(): void {
    this.#element.remove()
  }
}
