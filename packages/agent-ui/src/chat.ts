import { type AgentChat, defineAgentChat } from "./element.js"
import type { AgentLike, ChatOptions } from "./types.js"

function resolveTarget(options: ChatOptions): HTMLElement {
  // Modal/sidebar float over the page → always attach to <body>.
  if (options.mode && options.mode !== "inline") return document.body
  if (typeof options.target === "string") {
    const el = document.querySelector(options.target)
    if (!el) throw new Error(`Chat: target "${options.target}" not found.`)
    return el as HTMLElement
  }
  return options.target ?? document.body
}

/**
 * Create and mount a chat widget in one line:
 *
 * ```ts
 * new Chat({ endpoint: "https://host/agent/chat" })
 * ```
 *
 * The instance is the handle: `open()`, `close()`, `toggle()`, `destroy()`, `agent`.
 */
export class Chat {
  #element: AgentChat

  constructor(options: ChatOptions = {}) {
    defineAgentChat()
    const element = document.createElement("agent-chat") as AgentChat
    element.configure(options)
    resolveTarget(options).appendChild(element)
    this.#element = element
    if (options.open) element.open()
  }

  get element(): AgentChat {
    return this.#element
  }
  get agent(): AgentLike {
    return this.#element.agent
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
