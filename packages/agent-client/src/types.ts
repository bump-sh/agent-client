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

export interface AgentOptions {
  /** The agent chat endpoint URL to POST conversations to. */
  endpoint: string
  /** Extra request headers (e.g. `Authorization`). */
  headers?: Record<string, string>
  /** Custom fetch implementation (SSR, testing). Defaults to global `fetch`. */
  fetch?: typeof fetch
  /** Seed the conversation history. */
  messages?: Message[]
}

export interface SendOptions {
  signal?: AbortSignal
}
