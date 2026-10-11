import { resolveLabel } from "./label.js"
import { type WireEvent, parseSse } from "./sse.js"
import type {
  AgentContext,
  AgentEvent,
  ButtonLabel,
  ConversationOptions,
  FrontendTool,
  HeadersProvider,
  Message,
  RunAgentInput,
  RunContext,
  SendOptions,
  TokenProvider,
  ToolArgs,
  ToolCall,
  ToolConfirmation,
} from "./types.js"

type AssistantMessage = Extract<Message, { role: "assistant" }>

const uuid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

/** The tool names the agent accepts, as its LLM providers do. */
const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/
const NO_PARAMETERS = { type: "object", properties: {} }
const DISMISSED = "Not run: the user did not confirm it."
const UNAVAILABLE = "Not run: this tool is no longer available on the page."
const UNLABELLED = "Not run: its confirmation could not be offered to the user."
const INVALID_ARGUMENTS = "Not run: its arguments are not valid JSON."
/** The runs one reply may chain on frontend tools, against a model calling them in a loop. */
const MAX_RUNS = 10
/** Tells the agent how a tool to confirm behaves, which its description alone does not. */
const CONFIRM_HINT =
  "Calling this tool asks the user to confirm it with a button: it runs only when they " +
  "click it, and you get its result with their next message. To offer it, call it " +
  "rather than ask."

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
  confirmation: (confirmation: ToolConfirmation) => void
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
  #frontendTools = new Map<string, FrontendTool>()
  /** The ids of the tool calls waiting for the user to confirm them. */
  #pendingConfirmations = new Set<string>()
  /** The confirmed tools executing: the next run waits for their results. */
  #executing = new Set<Promise<void>>()
  /** The length of the history when the current run started, restored if it fails. */
  #checkpoint = 0
  /** Whether the reply streaming has text since its last paragraph opened. */
  #paragraphOpen = false
  #agentContext?: AgentContext
  #fetch: typeof fetch
  #threadId = uuid()
  #messages: Message[]
  #listeners: { [K in keyof Listeners]: Set<Listeners[K]> } = {
    text: new Set(),
    tool: new Set(),
    message: new Set(),
    error: new Set(),
    confirmation: new Set(),
    done: new Set(),
  }

  constructor(options: ConversationOptions) {
    this.#endpoint = options.endpoint
    this.#token = options.token
    this.#config = options.config ?? {}
    this.#headers = options.headers ?? {}
    this.#allowedTools = options.allowedTools
    for (const tool of options.frontendTools ?? []) this.addFrontendTool(tool)
    this.#agentContext = options.agentContext
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
    this.#pendingConfirmations.clear()
  }

  /**
   * Let the agent call a tool of the page, from its next run
   * on. Throws an error if it conflicts with known server tools
   * names as it would be refused by the server.
   */
  addFrontendTool(tool: FrontendTool): void {
    const { name } = tool
    if (!TOOL_NAME.test(name))
      throw new Error(
        `Frontend tool "${name}": use letters, digits, _ or - (64 characters at most)`,
      )
    if (this.#frontendTools.has(name))
      throw new Error(`Frontend tool "${name}" is declared twice`)
    if (this.#allowedTools?.includes(name))
      throw new Error(
        `Frontend tool "${name}" must not be in allowedTools (server tools)`,
      )
    this.#frontendTools.set(name, tool)
  }

  /** Stop the agent calling a tool of the page, from its next run on. */
  removeFrontendTool(name: string): void {
    this.#frontendTools.delete(name)
  }

  /** Subscribe to a stream event. Returns an unsubscribe function. */
  on<K extends keyof Listeners>(event: K, handler: Listeners[K]): () => void {
    this.#listeners[event].add(handler)
    return () => this.#listeners[event].delete(handler)
  }

  /** Send a user turn and stream the assistant reply. */
  send(content: string, options: SendOptions = {}): StreamResult {
    this.#dismissConfirmations()
    // Record the user turn synchronously so `messages` is correct even before
    // the (lazy) stream is consumed. The request still fires on consumption.
    const turn: Message = { id: uuid(), role: "user", content }
    this.#messages.push(turn)
    return new StreamResult(this.#run(options))
  }

  /** One reply of the agent: it streams into the history as it comes. */
  async *#run(options: SendOptions): AsyncGenerator<AgentEvent> {
    let reply = ""
    try {
      await Promise.allSettled(this.#executing)
      for await (const event of this.#events(options.signal)) {
        if (event.type === "text") reply += event.delta
        this.#notify(event)
        yield event
      }
    } catch (cause) {
      this.#rollback()
      yield this.#fail(cause)
    } finally {
      this.#emit("message", reply)
      this.#emit("done")
    }
  }

  #notify(event: AgentEvent): void {
    if (event.type === "text") this.#emit("text", event.delta)
    if (event.type === "tool") this.#emit("tool", event.name)
    if (event.type === "confirmation") this.#emit("confirmation", event.confirmation)
  }

  #fail(cause: unknown): AgentEvent {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    this.#emit("error", error)
    return { type: "error", error }
  }

  /**
   * Drops what the run cut short appended: the agent refuses a history holding a
   * tool call without its result. The tools executed by earlier runs stay recorded.
   */
  #rollback(): void {
    this.#messages.splice(this.#checkpoint)
    this.#pendingConfirmations.clear()
  }

  /**
   * The events to show for one reply, its history folded in as it streams. A run
   * ending on frontend tools that ran is followed by another. Each new assistant
   * message after some text opens a new paragraph of the reply.
   */
  async *#events(signal?: AbortSignal): AsyncGenerator<AgentEvent> {
    this.#paragraphOpen = false
    let runs = 0
    do {
      this.#checkpoint = this.#messages.length
      if (runs++ === MAX_RUNS)
        throw new Error(`The agent called frontend tools ${MAX_RUNS} runs in a row`)
      for await (const event of this.#stream(signal)) yield* this.#shown(event)
    } while (yield* this.#callFrontendTools())
  }

  /** The events to show for an event of the run, recorded in the history first. */
  *#shown(event: WireEvent): Generator<AgentEvent> {
    this.#record(event)
    if (event.type === "TEXT_MESSAGE_START" && this.#paragraphOpen) {
      this.#paragraphOpen = false
      yield { type: "text", delta: "\n\n" }
    }
    if (event.type === "TEXT_MESSAGE_CONTENT") this.#paragraphOpen = true
    const shown = toAgentEvent(event)
    if (shown) yield shown
  }

  /**
   * Answers the tool calls a run ended without result, all of the page: executes
   * the tools, asks for the confirmations. Returns whether the agent can go on,
   * every call having its result.
   */
  async *#callFrontendTools(): AsyncGenerator<AgentEvent, boolean> {
    const calls = this.#unansweredToolCalls()
    let asked = false
    for (const call of calls) {
      const confirmation = await this.#callFrontendTool(call)
      if (confirmation) {
        asked = true
        yield { type: "confirmation", confirmation }
      }
    }
    return calls.length > 0 && !asked
  }

  /** The arguments of a call, or none when the model sent invalid JSON. */
  #parseToolArgs(call: ToolCall): ToolArgs | undefined {
    try {
      return JSON.parse(call.function.arguments || "{}")
    } catch {
      return undefined
    }
  }

  /** Executes the tool of a call, or returns the confirmation it waits for. */
  async #callFrontendTool(call: ToolCall): Promise<ToolConfirmation | undefined> {
    const tool = this.#frontendTools.get(call.function.name)
    const args = this.#parseToolArgs(call)
    if (!tool) {
      this.#recordToolResult(call.id, UNAVAILABLE)
    } else if (!args) {
      this.#recordToolResult(call.id, INVALID_ARGUMENTS)
    } else if (tool.confirm) {
      return this.#pendingConfirmationTool(call.id, tool, args, tool.confirm)
    } else {
      // A failure is not the reply's: the agent reads the error and tells the user.
      await this.#answerTool(call.id, tool, args).catch(() => {})
    }
  }

  #unansweredToolCalls(): ToolCall[] {
    const answered = new Set(
      this.#messages.flatMap((message) =>
        message.role === "tool" ? message.toolCallId : [],
      ),
    )
    return this.#toolCalls().filter((call) => !answered.has(call.id))
  }

  #toolCalls(): ToolCall[] {
    return this.#messages.flatMap((message) =>
      message.role === "assistant" ? (message.toolCalls ?? []) : [],
    )
  }

  /** The confirmation a call waits for, or none when its label does not resolve. */
  #pendingConfirmationTool(
    callId: string,
    tool: FrontendTool,
    args: ToolArgs,
    confirm: ButtonLabel,
  ): ToolConfirmation | undefined {
    const label = resolveLabel(confirm, args)
    if (!label) {
      this.#recordToolResult(callId, UNLABELLED)
      return
    }
    this.#pendingConfirmations.add(callId)
    return {
      name: tool.name,
      args,
      label,
      accept: () => this.#confirmTool(callId, tool, args),
    }
  }

  /** Executes a confirmed tool call; rejects when it does not run, or throws. */
  async #confirmTool(
    callId: string,
    tool: FrontendTool,
    args: ToolArgs,
  ): Promise<void> {
    if (!this.#pendingConfirmations.delete(callId))
      throw new Error(
        `Frontend tool "${tool.name}": the confirmation is no longer pending`,
      )
    if (this.#frontendTools.get(tool.name) !== tool) {
      this.#recordToolResult(callId, UNAVAILABLE)
      throw new Error(`Frontend tool "${tool.name}" is no longer available`)
    }
    return this.#track(this.#answerTool(callId, tool, args))
  }

  /** Awaits an execution, which the next run waits for meanwhile. */
  async #track(execution: Promise<void>): Promise<void> {
    this.#executing.add(execution)
    try {
      await execution
    } finally {
      this.#executing.delete(execution)
    }
  }

  /** A frontend tool result as the agent reads it: text as is, anything else as JSON. */
  #toolResultContent(result: unknown): string {
    if (result === undefined) return "Done."
    return typeof result === "string" ? result : JSON.stringify(result)
  }

  /** Executes a frontend tool and records its result, or its error, for the agent. */
  async #answerTool(callId: string, tool: FrontendTool, args: ToolArgs): Promise<void> {
    try {
      this.#recordToolResult(callId, this.#toolResultContent(await tool.execute(args)))
    } catch (error) {
      this.#recordToolResult(
        callId,
        `Error: ${error instanceof Error ? error.message : error}`,
      )
      throw error
    }
  }

  /** Answers the confirmations left pending: the agent needs a result for every call. */
  #dismissConfirmations(): void {
    for (const callId of this.#pendingConfirmations)
      this.#recordToolResult(callId, DISMISSED)
    this.#pendingConfirmations.clear()
  }

  /**
   * Records a tool result right after its call and the results before it, where
   * the agent expects it even when it comes late. A call no longer in the history
   * gets none.
   */
  #recordToolResult(toolCallId: string, content: string): void {
    const callIndex = this.#messages.findIndex(
      (message) =>
        message.role === "assistant" &&
        message.toolCalls?.some(({ id }) => id === toolCallId),
    )
    if (callIndex < 0) return
    let index = callIndex + 1
    while (this.#messages[index]?.role === "tool") index++
    this.#messages.splice(index, 0, { id: uuid(), role: "tool", toolCallId, content })
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
      tools: this.#declaredTools(),
      context: this.#context(),
      forwardedProps: { allowedTools: this.#allowedTools },
    }
  }

  #context(): RunContext[] {
    return Object.entries(this.#agentContext || {}).map(([key, value]) => {
      return { description: key, value: value }
    })
  }

  /** The frontend tools, as AG-UI declares a tool. */
  #declaredTools(): RunAgentInput["tools"] {
    return [...this.#frontendTools.values()].map(
      ({ name, description, parameters, confirm }) => ({
        name,
        description: confirm ? `${description}\n\n${CONFIRM_HINT}` : description,
        parameters: parameters ?? NO_PARAMETERS,
      }),
    )
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
