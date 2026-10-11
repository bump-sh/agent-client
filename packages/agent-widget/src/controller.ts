import type { AgentEvent, ToolConfirmation } from "@bump-sh/agent-conversation"
import type { ConversationLike } from "./types.js"

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const SPINNER = '<span class="loader"><span></span><span></span><span></span></span>'
const TOOL_ICON = `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1 2.5-2.5z"/></svg>`

function actionButton(kind: string, label: string): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.className = `action ${kind}`
  button.setAttribute("part", `action ${kind}`)
  button.textContent = label
  return button
}

/** Runs the action of a button, its state reflected for CSS; an error is reported. */
async function execute(
  button: HTMLButtonElement,
  action: () => unknown,
): Promise<void> {
  button.setAttribute("aria-busy", "true")
  try {
    await action()
    button.dataset.state = "done"
  } catch (error) {
    button.dataset.state = "failed"
    reportError(error)
  } finally {
    button.removeAttribute("aria-busy")
  }
}

/** An assistant reply streaming into its turn. */
interface Reply {
  turn: HTMLElement
  body: HTMLElement
  actions: HTMLElement
  aside: HTMLElement
  text: string
  liveTools: string[]
  done: boolean
  error?: string
}

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
    this.#dismissConfirmations()
    this.#userTurn(content)
    const reply = this.#startReply()
    try {
      for await (const event of this.#conversation().send(content))
        this.#show(event, reply)
    } catch {
      reply.error = "Connection lost."
    } finally {
      this.#finish(reply)
    }
  }

  /** A new assistant turn, busy until its reply has streamed: the actions show under it then. */
  #startReply(): Reply {
    const reply: Reply = {
      ...this.#assistantTurn(),
      text: "",
      liveTools: [],
      done: false,
    }
    reply.turn.setAttribute("aria-busy", "true")
    this.#paint(reply)
    return reply
  }

  #show(event: AgentEvent, reply: Reply): void {
    if (event.type === "text") {
      reply.liveTools = []
      reply.text += event.delta
    }
    if (event.type === "tool") reply.liveTools.push(event.name)
    if (event.type === "text" || event.type === "tool") this.#paint(reply)
    if (event.type === "confirmation")
      reply.actions.appendChild(this.#confirmationButton(event.confirmation))
    if (event.type === "error") reply.error = "Something went wrong."
  }

  #paint({ body, aside, text, liveTools, done }: Reply): void {
    body.innerHTML = this.#options.render(text)
    aside.innerHTML = done ? "" : this.#liveStatus(liveTools)
    this.#scroll()
  }

  #finish(reply: Reply): void {
    reply.done = true
    reply.turn.removeAttribute("aria-busy")
    if (reply.error) {
      reply.body.textContent = reply.error
      reply.aside.innerHTML = ""
    } else {
      this.#paint(reply)
    }
  }

  /** Executes the confirmed tool on its one click. */
  #confirmationButton(confirmation: ToolConfirmation): HTMLButtonElement {
    const button = actionButton("action-confirmation", confirmation.label)
    button.addEventListener(
      "click",
      () => {
        button.disabled = true
        execute(button, () => confirmation.accept())
      },
      { once: true },
    )
    return button
  }

  /** The conversation dismisses the confirmations left pending when a message is sent. */
  #dismissConfirmations(): void {
    const buttons =
      this.#thread.querySelectorAll<HTMLButtonElement>(".action-confirmation")
    for (const button of buttons) {
      if (button.disabled) continue
      button.disabled = true
      button.dataset.state = "dismissed"
    }
  }

  #liveStatus(tools: string[]): string {
    const names = escapeHtml(tools.join(", ").replace(/_/g, " "))
    const label = names ? `${TOOL_ICON}<span class="status-label">${names}</span>` : ""
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

  #assistantTurn(): {
    turn: HTMLElement
    body: HTMLElement
    actions: HTMLElement
    aside: HTMLElement
  } {
    this.#maybeDivider()
    const turn = document.createElement("div")
    turn.className = "turn assistant"
    turn.innerHTML = `<div class="avatar" part="avatar">${this.#options.avatar}</div><div class="content"><div class="body" part="message message-assistant"></div><div class="actions"></div><div class="aside"></div></div>`
    this.#thread.appendChild(turn)
    this.#scroll()
    return {
      turn,
      body: turn.querySelector(".body") as HTMLElement,
      actions: turn.querySelector(".actions") as HTMLElement,
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
