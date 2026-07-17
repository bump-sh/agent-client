import type { AgentEvent, TokenProvider } from "@bump-sh/agent-client"

export type Mode = "modal" | "sidebar" | "inline"

/** The minimal shape the widget needs from an agent. `Agent` satisfies it. */
export interface AgentLike {
  send(content: string): AsyncIterable<AgentEvent>
}

/** Theme tokens. Each maps to a `--agent-*` CSS custom property on the host. */
export interface Theme {
  accent?: string
  bg?: string
  text?: string
  muted?: string
  userBg?: string
  border?: string
  codeBg?: string
  font?: string
  radius?: string
  /** Sidebar width, e.g. "22vw" or "360px". */
  width?: string
  /** Stacking order of the widget. */
  z?: string
}

export interface Labels {
  send?: string
  close?: string
  launch?: string
  /** Date divider shown at the top of a conversation. */
  today?: string
}

export interface ChatOptions {
  /** Agent chat endpoint. Used to build an Agent when `agent` is not given. */
  endpoint?: string
  /** Bring your own agent instance instead of building one from `endpoint`. */
  agent?: AgentLike
  /**
   * Bearer token for the built-in Agent, sent as `Authorization`. String, or a
   * callback re-evaluated per request so short-lived tokens refresh. This is the
   * recommended way to authenticate — mint a user-scoped token server-side.
   */
  token?: TokenProvider
  /** Extra request headers for the built-in Agent (config, not auth — prefer `token`). */
  headers?: Record<string, string>
  /** Display mode. Defaults to "modal". */
  mode?: Mode
  /** Show the floating launcher button (modal/sidebar). Default true. */
  launcher?: boolean
  /** Where to attach the element. Inline → container; modal/sidebar → body. */
  target?: string | HTMLElement
  /** Start opened (modal/sidebar). Inline is always open. */
  open?: boolean
  theme?: Theme
  title?: string
  /** Small line under the title (e.g. "AI Agent"). */
  subtitle?: string
  placeholder?: string
  /** Optional first assistant message shown before any user input. */
  greeting?: string
  /** Assistant avatar: an image URL, or inline HTML/emoji. Defaults to a glyph. */
  avatar?: string
  /** Disclaimer under the composer. Pass "" to hide. */
  disclaimer?: string
  labels?: Labels
  /** Replace the built-in safe markdown renderer. */
  renderMarkdown?: (text: string) => string
}
