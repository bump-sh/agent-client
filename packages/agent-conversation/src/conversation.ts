import { type WireEvent, parseSse } from "./sse.js"
import type {
  AgentEvent,
  ConversationOptions,
  HeadersProvider,
  Message,
  RunAgentInput,
  SendOptions,
  TokenProvider,
  ToolCall,
} from "./types.js"

type AssistantMessage = Extract<Message, { role: "assistant" }>

const uuid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

async function resolveHeaders(
  provider: HeadersProvider,
): Promise<Record<string, string>> {
  return typeof provider === "function" ? await provider() : provider
}

/** The wire events worth showing while a reply streams. */
function toAgentEvent(event: WireEvent): AgentEvent | undefined {
  if (event.type === "TEXT_MESSAGE_CONTENT") return { type: "text", delta: event.delta }
  if (event.type === "TOOL_CALL_START")
    return { type: "tool", name: event.toolCallName }
}

type Listeners = {
  text: (delta: string) => void
  tool: (name: string) => void
  message: (content: string) => void
  error: (error: Error) => void
  done: () => void
}

/**
 * The return value of {@link Conversation.send}. Consume it ONCE, either way:
 * - `await result` resolves to the assembled assistant reply (rejects on error).
 * - `for await (const event of result)` yields each streamed event.
 *
 * It wraps a single underlying stream, so awaiting *and* iterating (or iterating
 * twice) drains it once — the second consumer sees an empty stream.
 */
export class StreamResult implements AsyncIterable<AgentEvent>, PromiseLike<string> {
  #events: AsyncGenerator<AgentEvent>
  #settled?: Promise<string>

  constructor(events: AsyncGenerator<AgentEvent>) {
    this.#events = events
  }

  [Symbol.asyncIterator](): AsyncGenerator<AgentEvent> {
    return this.#events
  }

  // biome-ignore lint/suspicious/noThenProperty: being thenable is the point — `await agent.send(...)`.
  then<R = string, E = never>(
    onFulfilled?: ((text: string) => R | PromiseLike<R>) | null,
    onRejected?: ((reason: unknown) => E | PromiseLike<E>) | null,
  ): PromiseLike<R | E> {
    this.#settled ??= this.#drain()
    return this.#settled.then(onFulfilled, onRejected)
  }

  async #drain(): Promise<string> {
    let text = ""
    for await (const event of this.#events) {
      if (event.type === "text") text += event.delta
      if (event.type === "error") throw event.error
    }
    return text
  }
}

/**
 * A stateful conversation with a single Bump.sh agent API endpoint, speaking
 * the AG-UI protocol: it keeps the message history and replays it on every run.
 */
export class Conversation {
  #endpoint: string
  #token?: TokenProvider
  #config: HeadersProvider
  #headers: HeadersProvider
  #allowedTools?: string[]
  #fetch: typeof fetch
  #threadId = uuid()
  #messages: Message[]
  #listeners: { [K in keyof Listeners]: Set<Listeners[K]> } = {
    text: new Set(),
    tool: new Set(),
    message: new Set(),
    error: new Set(),
    done: new Set(),
  }

  constructor(options: ConversationOptions) {
    this.#endpoint = options.endpoint
    this.#token = options.token
    this.#config = options.config ?? {}
    this.#headers = options.headers ?? {}
    this.#allowedTools = options.allowedTools
    // Bound once: the native fetch refuses any receiver but the global.
    this.#fetch = (options.fetch ?? globalThis.fetch).bind(globalThis)
    this.#messages = (options.messages ?? []).map((message) => ({
      id: uuid(),
      ...message,
    }))
  }

  /** The conversation history so far, in the shape sent to the agent. */
  get messages(): readonly Message[] {
    return [...this.#messages]
  }

  /** Clear the conversation history. */
  reset(): void {
    this.#messages = []
  }

  /** Subscribe to a stream event. Returns an unsubscribe function. */
  on<K extends keyof Listeners>(event: K, handler: Listeners[K]): () => void {
    this.#listeners[event].add(handler)
    return () => this.#listeners[event].delete(handler)
  }

  /** Send a user turn and stream the assistant reply. */
  send(content: string, options: SendOptions = {}): StreamResult {
    // Record the user turn synchronously so `messages` is correct even before
    // the (lazy) stream is consumed. The request still fires on consumption.
    const turn: Message = { id: uuid(), role: "user", content }
    this.#messages.push(turn)
    return new StreamResult(this.#run(turn, options))
  }

  /** One run of the agent: its reply streams into the history as it comes. */
  async *#run(turn: Message, options: SendOptions): AsyncGenerator<AgentEvent> {
    let reply = ""
    try {
      for await (const event of this.#events(options.signal)) {
        if (event.type === "text") reply += event.delta
        this.#notify(event)
        yield event
      }
    } catch (cause) {
      this.#rollback(turn)
      yield this.#fail(cause)
    } finally {
      this.#emit("message", reply)
      this.#emit("done")
    }
  }

  #notify(event: AgentEvent): void {
    if (event.type === "text") this.#emit("text", event.delta)
    if (event.type === "tool") this.#emit("tool", event.name)
  }

  #fail(cause: unknown): AgentEvent {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    this.#emit("error", error)
    return { type: "error", error }
  }

  /**
   * Drops what a run cut short appended after its user turn: the agent refuses
   * a history holding a tool call without its result.
   */
  #rollback(turn: Message): void {
    const index = this.#messages.indexOf(turn)
    if (index >= 0) this.#messages.splice(index + 1)
  }

  /**
   * The events to show for one run, its history folded in as it streams. Each
   * new assistant message after some text opens a new paragraph of the reply.
   */
  async *#events(signal?: AbortSignal): AsyncGenerator<AgentEvent> {
    let paragraphOpen = false
    for await (const event of this.#stream(signal)) {
      this.#record(event)
      if (event.type === "TEXT_MESSAGE_START" && paragraphOpen) {
        paragraphOpen = false
        yield { type: "text", delta: "\n\n" }
      }
      if (event.type === "TEXT_MESSAGE_CONTENT") paragraphOpen = true
      const shown = toAgentEvent(event)
      if (shown) yield shown
    }
  }

  /** The wire events of one run, up to the end of the run. */
  async *#stream(signal?: AbortSignal): AsyncGenerator<WireEvent> {
    const response = await this.#request(signal)
    if (!response.ok || !response.body) {
      throw new Error(`Conversation request failed with status ${response.status}`)
    }
    for await (const event of parseSse(response.body)) {
      if (event.type === "RUN_FINISHED") return
      if (event.type === "RUN_ERROR") throw new Error(event.message)
      yield event
    }
    throw new Error("Conversation stream ended before the run finished")
  }

  /** Folds a wire event into the history. */
  #record(event: WireEvent): void {
    switch (event.type) {
      case "TEXT_MESSAGE_START":
        this.#assistant(event.messageId)
        break
      case "TEXT_MESSAGE_CONTENT":
        this.#assistant(event.messageId).content += event.delta
        break
      case "TOOL_CALL_START":
        this.#startToolCall(event)
        break
      case "TOOL_CALL_ARGS":
        this.#toolCall(event.toolCallId).function.arguments += event.delta
        break
      case "TOOL_CALL_RESULT":
        this.#messages.push({
          id: event.messageId,
          role: "tool",
          toolCallId: event.toolCallId,
          content: event.content,
        })
        break
    }
  }

  /** Hangs a new tool call under the assistant message it belongs to. */
  #startToolCall(event: Extract<WireEvent, { type: "TOOL_CALL_START" }>): void {
    const call: ToolCall = {
      id: event.toolCallId,
      type: "function",
      function: { name: event.toolCallName, arguments: "" },
    }
    const parent = this.#assistant(event.parentMessageId)
    parent.toolCalls = [...(parent.toolCalls ?? []), call]
  }

  /**
   * The assistant message being streamed, appended on its first event. With
   * no id, it is the one last streamed, or a fresh one.
   */
  #assistant(id?: string): AssistantMessage {
    const last = this.#messages.at(-1)
    if (last?.role === "assistant" && (!id || last.id === id)) return last
    const created: AssistantMessage = {
      id: id ?? uuid(),
      role: "assistant",
      content: "",
    }
    this.#messages.push(created)
    return created
  }

  /** A tool call of the assistant message being streamed. */
  #toolCall(id: string): ToolCall {
    const last = this.#messages.at(-1)
    const call = last?.role === "assistant" && last.toolCalls?.find((c) => c.id === id)
    if (!call)
      throw new Error(`Conversation received arguments for unknown tool call ${id}`)
    return call
  }

  async #request(signal?: AbortSignal): Promise<Response> {
    return this.#fetch(this.#endpoint, {
      method: "POST",
      headers: await this.#requestHeaders(),
      body: JSON.stringify(this.#runInput()),
      signal,
    })
  }

  #runInput(): RunAgentInput {
    return {
      threadId: this.#threadId,
      runId: uuid(),
      messages: this.#messages,
      tools: [],
      context: [],
      forwardedProps: { allowedTools: this.#allowedTools },
    }
  }

  async #requestHeaders(): Promise<Record<string, string>> {
    const token = typeof this.#token === "function" ? await this.#token() : this.#token
    const config = await resolveHeaders(this.#config)
    const configHeaders = Object.fromEntries(
      Object.entries(config).map(([key, value]) => [`Config-${key}`, value]),
    )
    return {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...configHeaders,
      ...(await resolveHeaders(this.#headers)),
    }
  }

  #emit<K extends keyof Listeners>(event: K, ...args: Parameters<Listeners[K]>): void {
    for (const handler of this.#listeners[event]) {
      ;(handler as (...a: unknown[]) => void)(...args)
    }
  }
}
