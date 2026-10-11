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

export type RunContext = { description: string; value: string }

/** The input of one AG-UI run, as posted to the agent. */
export interface RunAgentInput {
  threadId: string
  runId: string
  messages: Message[]
  /** The frontend tools, as AG-UI declares a tool. */
  tools: { name: string; description: string; parameters: Record<string, unknown> }[]
  /** Represents a piece of contextual information provided to an agent. */
  context: RunContext[]
  /** `allowedTools` is left out when the conversation names none. */
  forwardedProps: { allowedTools?: string[] }
}

// biome-ignore lint/suspicious/noExplicitAny: the arguments follow the tool's own JSON Schema.
export type ToolArgs = Record<string, any>

/**
 * The label of a button: a template whose `{args.x}` variables read
 * the tool call, or a function returning it. A variable that does not
 * resolve to a string, a number or a boolean, or a function returning
 * nothing or throwing, means no label: the button is not offered.
 */
export type ButtonLabel<Args = ToolArgs> = string | ((args: Args) => string | undefined)

/**
 * A tool of the page embedding the agent, which the agent may call. Without
 * `confirm`, it executes as soon as the agent calls it, and the agent goes on
 * with its result. With `confirm`, the user confirms the call with a button first,
 * and the agent reads its result on the next message.
 */
// biome-ignore lint/suspicious/noExplicitAny: a list of tools mixes their argument types.
export interface FrontendTool<Args extends ToolArgs = any> {
  /** Letters, digits, `_` or `-` (64 chars at most), unlike any tool of the agent server. */
  name: string
  /** What the tool does and when to use it: the agent decides from it. */
  description: string
  /** JSON Schema of the arguments. Left out, the tool takes none. */
  parameters?: Record<string, unknown>
  /** Executes the tool. Its return value, or the error it throws, is what the agent reads. */
  execute(args: Args): unknown
  /**
   * Ask the user to confirm the call with a button so labelled, instead of executing
   * it right away. Without a label, the call is not executed.
   */
  confirm?: ButtonLabel<Args>
}

/** A frontend tool call waiting for the user to confirm it. */
export interface ToolConfirmation {
  name: string
  args: ToolArgs
  label: string
  /**
   * Executes the tool and records its result for the agent. Rejects when the tool
   * throws, or when it does not run: accepted already, dismissed by the next
   * message, or the tool removed.
   */
  accept(): Promise<void>
}

/** An event yielded while streaming an assistant reply. */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string }
  | { type: "confirmation"; confirmation: ToolConfirmation }
  | { type: "error"; error: Error }

/** A bearer token, or a callback re-evaluated per request (for short-lived tokens). */
export type TokenProvider = string | (() => string | Promise<string>)

/** A header map, or a callback re-evaluated per request (for values that change). */
export type HeadersProvider =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>)

/** A context map of key-value pairs sent as an application context to the agent. */
export type AgentContext = Record<string, string>

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
  /** Tools of the page the agent may call. See {@link FrontendTool}. */
  frontendTools?: FrontendTool[]
  /** Define an application context for the agent to know where it lives. */
  agentContext?: AgentContext
  /** Custom fetch implementation (SSR, testing). Defaults to global `fetch`. */
  fetch?: typeof fetch
  /** Seed the conversation history. */
  messages?: SeedMessage[]
}

export interface SendOptions {
  signal?: AbortSignal
}
