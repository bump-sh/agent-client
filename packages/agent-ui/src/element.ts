import { Agent } from "@bump-sh/agent-client"
import type { TokenProvider } from "@bump-sh/agent-client"
import { Controller } from "./controller.js"
import { renderMarkdown as defaultMarkdown } from "./markdown.js"
import { css } from "./styles.js"
import type { AgentLike, Labels, Mode, Theme } from "./types.js"

const THEME_VARS: Record<keyof Theme, string> = {
  accent: "--agent-accent",
  bg: "--agent-bg",
  text: "--agent-text",
  muted: "--agent-muted",
  userBg: "--agent-user-bg",
  border: "--agent-border",
  codeBg: "--agent-code-bg",
  font: "--agent-font",
  radius: "--agent-radius",
  width: "--agent-width",
  z: "--agent-z",
}

const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.4 8.4 0 0 1 11.5 3a8.5 8.5 0 0 1 9.5 8.5z"/></svg>`
const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`
const AVATAR_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.1a4 4 0 0 0 2.5 2.5L21.5 12l-5.1 1.9a4 4 0 0 0-2.5 2.5L12 21.5l-1.9-5.1a4 4 0 0 0-2.5-2.5L2.5 12l5.1-1.9a4 4 0 0 0 2.5-2.5z"/></svg>`
const DEFAULT_DISCLAIMER = "AI can make mistakes. Always review before you act."

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const attr = (s: string): string => escapeHtml(s).replace(/"/g, "&quot;")

let sheet: CSSStyleSheet | undefined
const supportsAdopted = (): boolean =>
  typeof CSSStyleSheet !== "undefined" &&
  "replaceSync" in CSSStyleSheet.prototype &&
  "adoptedStyleSheets" in ShadowRoot.prototype

function applyStyles(shadow: ShadowRoot): void {
  if (supportsAdopted()) {
    if (!sheet) {
      sheet = new CSSStyleSheet()
      sheet.replaceSync(css)
    }
    shadow.adoptedStyleSheets = [sheet]
    return
  }
  const style = document.createElement("style")
  style.textContent = css
  shadow.insertBefore(style, shadow.firstChild)
}

/** The `<agent-chat>` custom element. Prefer the `Chat` façade for the 5-min path. */
export class AgentChat extends HTMLElement {
  static observedAttributes = [
    "endpoint",
    "mode",
    "open",
    "title",
    "subtitle",
    "placeholder",
  ]

  #providedAgent?: AgentLike
  #agentInstance?: AgentLike
  #endpoint?: string
  #token?: TokenProvider
  #headers: Record<string, string> = {}
  #mode: Mode = "modal"
  #titleText = "Assistant"
  #subtitleText?: string
  #placeholderText = "Ask anything…"
  #greeting?: string
  #avatar?: string
  #disclaimerText = DEFAULT_DISCLAIMER
  #labels: Labels = {}
  #render: (text: string) => string = defaultMarkdown
  #controller?: Controller
  #panel?: HTMLElement
  #thread?: HTMLElement
  #input?: HTMLTextAreaElement
  #send?: HTMLButtonElement
  #busy = false
  #built = false

  constructor() {
    super()
    this.attachShadow({ mode: "open" })
  }

  /** Apply options from the `Chat` façade. Call before the element is attached. */
  configure(options: {
    agent?: AgentLike
    endpoint?: string
    token?: TokenProvider
    headers?: Record<string, string>
    mode?: Mode
    title?: string
    subtitle?: string
    placeholder?: string
    greeting?: string
    avatar?: string
    disclaimer?: string
    labels?: Labels
    theme?: Theme
    renderMarkdown?: (text: string) => string
  }): this {
    if (options.agent) this.#providedAgent = options.agent
    if (options.endpoint) this.setAttribute("endpoint", options.endpoint)
    if (options.token != null) this.#token = options.token
    if (options.headers) this.#headers = options.headers
    this.setAttribute("mode", options.mode ?? this.#mode)
    if (options.title != null) this.setAttribute("title", options.title)
    if (options.subtitle != null) this.setAttribute("subtitle", options.subtitle)
    if (options.placeholder != null)
      this.setAttribute("placeholder", options.placeholder)
    if (options.greeting != null) this.#greeting = options.greeting
    if (options.avatar != null) this.#avatar = options.avatar
    if (options.disclaimer != null) this.#disclaimerText = options.disclaimer
    if (options.labels) this.#labels = options.labels
    if (options.renderMarkdown) this.#render = options.renderMarkdown
    if (options.theme) this.applyTheme(options.theme)
    return this
  }

  /** Set theme tokens as `--agent-*` custom properties on the host. */
  applyTheme(theme: Theme): void {
    for (const [key, value] of Object.entries(theme)) {
      if (value) this.style.setProperty(THEME_VARS[key as keyof Theme], value)
    }
  }

  /** The agent instance in use — provided, or built lazily from `endpoint`. */
  get agent(): AgentLike {
    if (this.#providedAgent) return this.#providedAgent
    if (!this.#agentInstance) {
      if (!this.#endpoint)
        throw new Error("agent-chat: set `endpoint` or provide an `agent`.")
      this.#agentInstance = new Agent({
        endpoint: this.#endpoint,
        token: this.#token,
        headers: this.#headers,
      })
    }
    return this.#agentInstance
  }

  open(): void {
    this.setAttribute("open", "")
  }
  close(): void {
    this.removeAttribute("open")
  }
  toggle(): void {
    this.hasAttribute("open") ? this.close() : this.open()
  }

  connectedCallback(): void {
    this.#readAttributes()
    this.setAttribute("mode", this.#mode)
    this.#build()
    if (this.#mode === "fullscreen" || this.hasAttribute("open")) this.open()
  }

  attributeChangedCallback(
    name: string,
    _old: string | null,
    value: string | null,
  ): void {
    if (name === "endpoint") {
      this.#endpoint = value ?? undefined
      this.#agentInstance = undefined
    } else if (name === "mode") {
      if (value) this.#mode = value as Mode
      if (this.#built) this.#build()
    } else if (name === "title") {
      if (value != null) this.#titleText = value
      this.#updateText()
    } else if (name === "subtitle") {
      this.#subtitleText = value ?? undefined
      if (this.#built) this.#build()
    } else if (name === "placeholder") {
      if (value != null) this.#placeholderText = value
      this.#updateText()
    } else if (name === "open") {
      this.#reflectOpen(value !== null)
    }
  }

  #readAttributes(): void {
    const endpoint = this.getAttribute("endpoint")
    if (endpoint) this.#endpoint = endpoint
    const mode = this.getAttribute("mode")
    if (mode) this.#mode = mode as Mode
    const title = this.getAttribute("title")
    if (title) this.#titleText = title
    const subtitle = this.getAttribute("subtitle")
    if (subtitle) this.#subtitleText = subtitle
    const placeholder = this.getAttribute("placeholder")
    if (placeholder) this.#placeholderText = placeholder
  }

  #build(): void {
    const shadow = this.shadowRoot as ShadowRoot
    shadow.innerHTML = this.#template()
    applyStyles(shadow)
    this.#grabRefs()
    this.#wire()
    this.#controller = new Controller(this.#thread as HTMLElement, () => this.agent, {
      render: this.#render,
      avatar: this.#avatarHtml(),
      todayLabel: this.#labels.today ?? "Today",
    })
    this.#built = true
    if (this.#greeting) this.#controller.greet(this.#greeting)
  }

  #avatarHtml(): string {
    if (!this.#avatar) return AVATAR_ICON
    if (/^(https?:|\/|\.|data:)/.test(this.#avatar))
      return `<img src="${attr(this.#avatar)}" alt="">`
    return this.#avatar
  }

  #template(): string {
    // modal & sidebar are top-layer <dialog>s → native Escape + focus trap.
    const panelTag = this.#mode === "fullscreen" ? "div" : "dialog"
    const launcher =
      this.#mode === "fullscreen"
        ? ""
        : `<button class="launcher" part="launcher" aria-label="${attr(this.#labels.launch ?? "Open chat")}">${CHAT_ICON}</button>`
    const subtitle = this.#subtitleText
      ? `<span class="subtitle" part="subtitle">${escapeHtml(this.#subtitleText)}</span>`
      : ""
    return `
      ${launcher}
      <${panelTag} class="panel" part="panel">
        <div class="header" part="header">
          <div class="heading">
            <slot name="title"><span class="title" part="title">${escapeHtml(this.#titleText)}</span></slot>
            ${subtitle}
          </div>
          <span class="spacer"></span>
          <button class="close" part="close" aria-label="${attr(this.#labels.close ?? "Close")}">${CLOSE_ICON}</button>
        </div>
        <div class="thread empty" part="thread">
          <slot name="empty"><span class="empty-hint">${escapeHtml(this.#placeholderText)}</span></slot>
        </div>
        <form class="composer" part="composer">
          <div class="box">
            <textarea class="input" part="input" rows="1" placeholder="${attr(this.#placeholderText)}"></textarea>
            <div class="tools">
              <slot name="composer-actions"></slot>
              <span class="spacer"></span>
              <button class="send" part="send" type="submit" aria-label="${attr(this.#labels.send ?? "Send")}" disabled>${SEND_ICON}</button>
            </div>
          </div>
          <div class="disclaimer" part="disclaimer">${escapeHtml(this.#disclaimerText)}</div>
        </form>
      </${panelTag}>
    `
  }

  #grabRefs(): void {
    const shadow = this.shadowRoot as ShadowRoot
    this.#panel = shadow.querySelector(".panel") as HTMLElement
    this.#thread = shadow.querySelector(".thread") as HTMLElement
    this.#input = shadow.querySelector(".input") as HTMLTextAreaElement
    this.#send = shadow.querySelector(".send") as HTMLButtonElement
  }

  #wire(): void {
    const shadow = this.shadowRoot as ShadowRoot
    shadow.querySelector(".launcher")?.addEventListener("click", () => this.open())
    shadow.querySelector(".close")?.addEventListener("click", () => this.close())
    shadow
      .querySelector(".composer")
      ?.addEventListener("submit", (e) => this.#submit(e))
    this.#input?.addEventListener("input", () => this.#syncSend())
    this.#input?.addEventListener("keydown", (e) => this.#onKeydown(e as KeyboardEvent))
    if (this.#mode !== "fullscreen") {
      // Native <dialog>: Escape fires "close"; a click on the backdrop targets
      // the dialog itself (not its children) → dismiss when clicking outside.
      this.#panel?.addEventListener("close", () => this.removeAttribute("open"))
      this.#panel?.addEventListener("click", (e) => {
        if (e.target === this.#panel) this.close()
      })
    }
  }

  #reflectOpen(open: boolean): void {
    if (!this.#built) return
    if (this.#mode !== "fullscreen") {
      const dialog = this.#panel as HTMLDialogElement
      try {
        open ? dialog.showModal() : dialog.close()
      } catch {
        // happy-dom / environments without full <dialog> support
      }
    }
    if (open) this.#input?.focus()
  }

  #updateText(): void {
    if (!this.#built) return
    const shadow = this.shadowRoot as ShadowRoot
    const title = shadow.querySelector(".title")
    if (title) title.textContent = this.#titleText
    if (this.#input) this.#input.placeholder = this.#placeholderText
    const hint = shadow.querySelector(".empty-hint")
    if (hint) hint.textContent = this.#placeholderText
  }

  #syncSend(): void {
    if (this.#send)
      this.#send.disabled = (this.#input?.value.trim() ?? "") === "" || this.#busy
  }

  #onKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.#submit()
    }
  }

  async #submit(event?: Event): Promise<void> {
    event?.preventDefault()
    const input = this.#input as HTMLTextAreaElement
    const content = input.value.trim()
    if (!content || this.#busy) return
    this.#busy = true
    input.value = ""
    this.#syncSend()
    try {
      await (this.#controller as Controller).send(content)
    } finally {
      this.#busy = false
      this.#syncSend()
      input.focus()
    }
  }
}

/** Register the `<agent-chat>` element (idempotent, no-op outside the browser). */
export function defineAgentChat(tag = "agent-chat"): void {
  if (typeof customElements === "undefined") return
  if (!customElements.get(tag)) customElements.define(tag, AgentChat)
}
