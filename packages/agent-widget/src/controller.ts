import type { ConversationLike } from "./types.js"

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const SPINNER = '<span class="loader"><span></span><span></span><span></span></span>'
const TOOL_ICON = `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1 2.5-2.5z"/></svg>`

export interface ControllerOptions {
  render: (text: string) => string
  avatar: string
  todayLabel: string
}

/** Drives one thread element: appends turns and streams assistant replies into it. */
export class Controller {
  #thread: HTMLElement
  #conversation: () => ConversationLike
  #options: ControllerOptions

  constructor(
    thread: HTMLElement,
    conversation: () => ConversationLike,
    options: ControllerOptions,
  ) {
    this.#thread = thread
    this.#conversation = conversation
    this.#options = options
  }

  /** Add an assistant turn without streaming (used for the greeting). */
  greet(text: string): void {
    this.#assistantTurn().body.innerHTML = this.#options.render(text)
  }

  /** Send a user turn and stream the assistant reply into a new turn. */
  async send(content: string): Promise<void> {
    this.#userTurn(content)
    const { body, aside } = this.#assistantTurn()

    let acc = ""
    let liveTool = ""
    let done = false
    let errorMessage: string | null = null

    const paint = () => {
      body.innerHTML = this.#options.render(acc)
      aside.innerHTML = done ? "" : this.#liveStatus(liveTool)
      this.#scroll()
    }
    paint()

    try {
      for await (const event of this.#conversation().send(content)) {
        if (event.type === "text") {
          liveTool = ""
          acc += event.delta
          paint()
        } else if (event.type === "tool") {
          if (acc && !acc.endsWith("\n\n")) acc += "\n\n"
          liveTool = escapeHtml(event.names.join(", ").replace(/_/g, " "))
          paint()
        } else if (event.type === "error") {
          errorMessage = "Something went wrong."
        }
      }
    } catch {
      errorMessage = "Connection lost."
    } finally {
      done = true
      if (errorMessage) {
        body.textContent = errorMessage
        aside.innerHTML = ""
      } else {
        paint()
      }
    }
  }

  #liveStatus(tool: string): string {
    const label = tool
      ? `${TOOL_ICON}<span class="status-label">${tool}</span>`
      : ""
    return `<div class="status" part="status">${label}${SPINNER}</div>`
  }

  #userTurn(text: string): void {
    this.#maybeDivider()
    const turn = document.createElement("div")
    turn.className = "turn user"
    const body = document.createElement("div")
    body.className = "body"
    body.setAttribute("part", "message message-user")
    body.textContent = text
    turn.appendChild(body)
    this.#thread.appendChild(turn)
    this.#scroll()
  }

  #assistantTurn(): { body: HTMLElement; aside: HTMLElement } {
    this.#maybeDivider()
    const turn = document.createElement("div")
    turn.className = "turn assistant"
    turn.innerHTML = `<div class="avatar" part="avatar">${this.#options.avatar}</div><div class="content"><div class="body" part="message message-assistant"></div><div class="aside"></div></div>`
    this.#thread.appendChild(turn)
    this.#scroll()
    return {
      body: turn.querySelector(".body") as HTMLElement,
      aside: turn.querySelector(".aside") as HTMLElement,
    }
  }

  #maybeDivider(): void {
    this.#thread.classList.remove("empty")
    if (this.#thread.querySelector(".turn") || this.#thread.querySelector(".divider"))
      return
    const divider = document.createElement("div")
    divider.className = "divider"
    divider.innerHTML = `<span>${escapeHtml(this.#options.todayLabel)}</span>`
    this.#thread.appendChild(divider)
  }

  #scroll(): void {
    this.#thread.scrollTop = this.#thread.scrollHeight
  }
}
