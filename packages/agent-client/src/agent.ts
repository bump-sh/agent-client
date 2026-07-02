import { parseNdjson } from "./stream.js"
import type { AgentEvent, AgentOptions, Message, SendOptions } from "./types.js"

type Listeners = {
  text: (delta: string) => void
  tool: (names: string[]) => void
  message: (content: string) => void
  error: (error: Error) => void
  done: () => void
}

/**
 * The return value of {@link Agent.send}. Consume it ONCE, either way:
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
 * A stateful conversation with a single Bump.sh agent endpoint. It keeps the
 * message history and replays it on every {@link send}.
 */
export class Agent {
  #endpoint: string
  #headers: Record<string, string>
  #fetch: typeof fetch
  #messages: Message[]
  #listeners: { [K in keyof Listeners]: Set<Listeners[K]> } = {
    text: new Set(),
    tool: new Set(),
    message: new Set(),
    error: new Set(),
    done: new Set(),
  }

  constructor(options: AgentOptions) {
    this.#endpoint = options.endpoint
    this.#headers = options.headers ?? {}
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#messages = options.messages ? [...options.messages] : []
  }

  /** The conversation history so far (user and assistant turns). */
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
    this.#messages.push({ role: "user", content })
    return new StreamResult(this.#run(options))
  }

  async *#run(options: SendOptions): AsyncGenerator<AgentEvent> {
    let assistant = ""
    try {
      const response = await this.#request(options.signal)
      if (!response.ok || !response.body) {
        throw new Error(`Agent request failed with status ${response.status}`)
      }
      for await (const event of parseNdjson(response.body)) {
        if (event.type === "text") {
          assistant += event.content
          this.#emit("text", event.content)
          yield { type: "text", delta: event.content }
        } else if (event.type === "tool") {
          this.#emit("tool", event.names)
          yield { type: "tool", names: event.names }
        } else if (event.type === "error") {
          const error = new Error(event.content)
          this.#emit("error", error)
          yield { type: "error", error }
        } else if (event.type === "done") {
          break
        }
      }
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause))
      this.#emit("error", error)
      yield { type: "error", error }
    } finally {
      if (assistant) this.#messages.push({ role: "assistant", content: assistant })
      this.#emit("message", assistant)
      this.#emit("done")
    }
  }

  #request(signal?: AbortSignal): Promise<Response> {
    const doFetch = this.#fetch
    return doFetch(this.#endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.#headers },
      body: JSON.stringify({ messages: this.#messages }),
      signal,
    })
  }

  #emit<K extends keyof Listeners>(event: K, ...args: Parameters<Listeners[K]>): void {
    for (const handler of this.#listeners[event]) {
      ;(handler as (...a: unknown[]) => void)(...args)
    }
  }
}
