export type Role = "user" | "assistant" | "tool"

/** A tool call made by the assistant, as AG-UI carries it: arguments are a JSON string. */
export interface ToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

type UserMessage = { role: "user"; content: string }
type AssistantMessage = { role: "assistant"; content: string; toolCalls?: ToolCall[] }
type ToolMessage = { role: "tool"; content: string; toolCallId: string }

/** A message to seed the history with. It gets an id. */
export type SeedMessage = UserMessage | AssistantMessage

/** A message of the history, in the AG-UI shape sent to the agent. */
export type Message = { id: string } & (SeedMessage | ToolMessage)

/** The input of one AG-UI run, as posted to the agent. */
export interface RunAgentInput {
  threadId: string
  runId: string
  messages: Message[]
  /** No frontend tool nor context is declared yet. */
  tools: []
  context: []
  /** `allowedTools` is left out when the conversation names none. */
  forwardedProps: { allowedTools?: string[] }
}

/** An event yielded while streaming an assistant reply. */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string }
  | { type: "error"; error: Error }

/** A bearer token, or a callback re-evaluated per request (for short-lived tokens). */
export type TokenProvider = string | (() => string | Promise<string>)

/** A header map, or a callback re-evaluated per request (for values that change). */
export type HeadersProvider =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>)

export interface ConversationOptions {
  /** The agent endpoint URL to POST runs to. */
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
  /** Limit the agent to these tools. Left out, every tool is available. */
  allowedTools?: string[]
  /** Custom fetch implementation (SSR, testing). Defaults to global `fetch`. */
  fetch?: typeof fetch
  /** Seed the conversation history. */
  messages?: SeedMessage[]
}

export interface SendOptions {
  signal?: AbortSignal
}
