export type Role = "user" | "assistant"

export interface Message {
  role: Role
  content: string
}

/** An event yielded while streaming an assistant reply. */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; names: string[] }
  | { type: "error"; error: Error }

/** A bearer token, or a callback re-evaluated per request (for short-lived tokens). */
export type TokenProvider = string | (() => string | Promise<string>)

/** A header map, or a callback re-evaluated per request (for values that change). */
export type HeadersProvider =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>)

export interface ConversationOptions {
  /** The agent chat endpoint URL to POST conversations to. */
  endpoint: string
  /**
   * Bearer token sent as `Authorization: Bearer <token>`. Pass a string, or a
   * callback re-evaluated on every request so short-lived tokens can refresh.
   * Mint a user-scoped, short-lived token server-side — never ship a raw key.
   */
  token?: TokenProvider
  /**
   * Agent configuration keys, sent as `Config-<Key>` request headers
   * (`{ locale: "fr" }` → `Config-locale: fr`). Map, or a callback
   * re-evaluated on every request.
   */
  config?: HeadersProvider
  /** Extra request headers, merged last. Map, or a callback re-evaluated on every request. */
  headers?: HeadersProvider
  /** Custom fetch implementation (SSR, testing). Defaults to global `fetch`. */
  fetch?: typeof fetch
  /** Seed the conversation history. */
  messages?: Message[]
}

export interface SendOptions {
  signal?: AbortSignal
}
