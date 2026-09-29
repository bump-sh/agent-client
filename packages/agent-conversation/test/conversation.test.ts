import { describe, expect, it, vi } from "vitest"
import { Conversation } from "../src/conversation.js"
import type { AgentEvent, Message } from "../src/types.js"

describe("Conversation", () => {
  it("accumulates text and resolves to the final reply", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning(reply("Hello ", "world")),
    })

    const result = await agent.send("hi")

    expect(result).toBe("Hello world")
    expect(agent.messages).toEqual([
      { id: expect.any(String), role: "user", content: "hi" },
      { id: "a1", role: "assistant", content: "Hello world" },
    ])
  })

  it("records the user turn synchronously, before the stream is consumed", () => {
    const agent = new Conversation({ endpoint: "/agent", fetch: fetchReturning([]) })

    agent.send("hi") // not awaited / not iterated

    expect(agent.messages).toEqual([
      { id: expect.any(String), role: "user", content: "hi" },
    ])
  })

  it("exposes messages as a copy, not the internal array", () => {
    const agent = new Conversation({ endpoint: "/agent", fetch: fetchReturning([]) })
    agent.send("hi")

    const snapshot = agent.messages as Message[]
    snapshot.push({ id: "x", role: "user", content: "tampered" })

    expect(agent.messages).toHaveLength(1)
  })

  it("seeds the history with ids", () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([]),
      messages: [{ role: "assistant", content: "Welcome!" }],
    })

    expect(agent.messages).toEqual([
      { id: expect.any(String), role: "assistant", content: "Welcome!" },
    ])
  })

  it("replays the history on the next turn", async () => {
    const fetchImpl = fetchReturning(reply("ok"))
    const agent = new Conversation({ endpoint: "/agent", fetch: fetchImpl })

    await agent.send("first")
    await agent.send("second")

    expect(requestBody(fetchImpl, 1).messages.map((m: Message) => m.content)).toEqual([
      "first",
      "ok",
      "second",
    ])
  })

  it("keeps the agent's tool calls and their results in the history", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([
        { type: "RUN_STARTED" },
        ...toolRound("call_1", "get_weather", '{"city":"Paris"}', "15"),
        ...reply("Sunny"),
      ]),
    })

    await agent.send("weather?")

    expect(agent.messages.slice(1)).toEqual([
      {
        id: "p1",
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "get_weather", arguments: '{"city":"Paris"}' },
          },
        ],
      },
      { id: "r1", role: "tool", toolCallId: "call_1", content: "15" },
      { id: "a1", role: "assistant", content: "Sunny" },
    ])
  })

  it("joins the assistant messages of a run as paragraphs of one reply", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([
        { type: "TEXT_MESSAGE_START", messageId: "a1" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "a1", delta: "Checking" },
        ...toolRound("call_1", "get_weather", "{}", "15", "a1"),
        ...reply("Sunny"),
      ]),
    })
    const messages: string[] = []
    agent.on("message", (content) => messages.push(content))

    const result = await agent.send("weather?")

    expect(result).toBe("Checking\n\nSunny")
    expect(messages).toEqual(["Checking\n\nSunny"])
    expect(agent.messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "weather?"],
      ["assistant", "Checking"],
      ["tool", "15"],
      ["assistant", "Sunny"],
    ])
  })

  it("hangs a tool call without parent under the assistant message streaming", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([
        { type: "TEXT_MESSAGE_START", messageId: "a1" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "a1", delta: "Checking" },
        { type: "TOOL_CALL_START", toolCallId: "call_1", toolCallName: "get_weather" },
        { type: "RUN_FINISHED" },
      ]),
    })

    await agent.send("weather?")

    expect(agent.messages[1]).toEqual({
      id: "a1",
      role: "assistant",
      content: "Checking",
      toolCalls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "get_weather", arguments: "" },
        },
      ],
    })
  })

  it("gives a tool call without parent nor streaming message an assistant message of its own", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([
        { type: "TOOL_CALL_START", toolCallId: "call_1", toolCallName: "get_weather" },
        { type: "RUN_FINISHED" },
      ]),
    })

    await agent.send("weather?")

    expect(agent.messages[1]).toMatchObject({
      id: expect.any(String),
      role: "assistant",
    })
  })

  it("rejects arguments for a tool call it never saw start", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([
        { type: "TOOL_CALL_ARGS", toolCallId: "ghost", delta: "{" },
      ]),
    })

    await expect(agent.send("hi")).rejects.toThrow("unknown tool call ghost")
  })

  it("surfaces text and tool events to callbacks", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([
        ...toolRound("call_1", "get_weather", "{}", "15"),
        ...reply("Sunny"),
      ]),
    })
    const tools: string[] = []
    const deltas: string[] = []
    agent.on("tool", (name) => tools.push(name))
    agent.on("text", (delta) => deltas.push(delta))

    await agent.send("weather?")

    expect(tools).toEqual(["get_weather"])
    expect(deltas).toEqual(["Sunny"])
  })

  it("yields events when iterated", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([
        ...toolRound("call_1", "get_weather", "{}", "15"),
        ...reply("Hi"),
      ]),
    })

    const events: AgentEvent[] = []
    for await (const event of agent.send("hi")) events.push(event)

    expect(events).toEqual([
      { type: "tool", name: "get_weather" },
      { type: "text", delta: "Hi" },
    ])
  })

  it("rejects and emits on a RUN_ERROR event", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([{ type: "RUN_ERROR", message: "boom" }]),
    })
    const errors: Error[] = []
    agent.on("error", (error) => errors.push(error))

    await expect(agent.send("hi")).rejects.toThrow("boom")
    expect(errors.map((e) => e.message)).toEqual(["boom"])
  })

  it("rejects when the request fails", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: vi.fn(
        async () => new Response("nope", { status: 500 }),
      ) as unknown as typeof fetch,
    })

    await expect(agent.send("hi")).rejects.toThrow("status 500")
  })

  it("rejects when the stream ends before the run finished", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning(reply("Hel").slice(0, -1)),
    })

    await expect(agent.send("hi")).rejects.toThrow("ended before the run finished")
    expect(agent.messages).toHaveLength(1)
  })

  it("keeps only the user turn of a run that failed midway", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([
        { type: "TEXT_MESSAGE_START", messageId: "a1" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "a1", delta: "Checking" },
        { type: "TEXT_MESSAGE_END", messageId: "a1" },
        {
          type: "TOOL_CALL_START",
          toolCallId: "call_1",
          toolCallName: "get_weather",
          parentMessageId: "a1",
        },
        { type: "RUN_ERROR", message: "boom" },
      ]),
    })

    await expect(agent.send("hi")).rejects.toThrow("boom")

    expect(agent.messages).toEqual([
      { id: expect.any(String), role: "user", content: "hi" },
    ])
  })

  it("leaves a history reset during the run empty when the run then fails", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning([
        { type: "TEXT_MESSAGE_START", messageId: "a1" },
        { type: "RUN_ERROR", message: "boom" },
      ]),
    })

    const run = agent.send("hi")[Symbol.asyncIterator]()
    await run.next()
    agent.reset()
    await run.next()

    expect(agent.messages).toEqual([])
  })

  it("reset() clears history", async () => {
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchReturning(reply("ok")),
    })

    await agent.send("hi")
    agent.reset()

    expect(agent.messages).toEqual([])
  })

  it("sends an AG-UI run: one thread, a fresh run id each time", async () => {
    const fetchImpl = fetchReturning(finished)
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchImpl,
      allowedTools: ["doThis"],
    })

    await agent.send("first")
    await agent.send("second")

    const [first, second] = [requestBody(fetchImpl, 0), requestBody(fetchImpl, 1)]
    expect(first).toEqual({
      threadId: expect.any(String),
      runId: expect.any(String),
      messages: [{ id: expect.any(String), role: "user", content: "first" }],
      tools: [],
      context: [],
      forwardedProps: { allowedTools: ["doThis"] },
    })
    expect(second.threadId).toBe(first.threadId)
    expect(second.runId).not.toBe(first.runId)
    expect(requestInit(fetchImpl).headers.Accept).toBe("text/event-stream")
  })

  it("sends no allowed tools restriction when not configured", async () => {
    const fetchImpl = fetchReturning(finished)
    const agent = new Conversation({ endpoint: "/agent", fetch: fetchImpl })

    await agent.send("hi")

    expect(requestBody(fetchImpl).forwardedProps).toEqual({})
  })

  it("sends a string token as an Authorization bearer header", async () => {
    const fetchImpl = fetchReturning(finished)
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchImpl,
      token: "t0ken",
    })

    await agent.send("hi")

    expect(requestInit(fetchImpl).headers.Authorization).toBe("Bearer t0ken")
  })

  it("re-evaluates a token callback on every request so it can refresh", async () => {
    const fetchImpl = fetchReturning(finished)
    let n = 0
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchImpl,
      token: async () => `t${++n}`,
    })

    await agent.send("first")
    await agent.send("second")

    expect(requestInit(fetchImpl, 0).headers.Authorization).toBe("Bearer t1")
    expect(requestInit(fetchImpl, 1).headers.Authorization).toBe("Bearer t2")
  })

  it("sends config keys as Config-* headers", async () => {
    const fetchImpl = fetchReturning(finished)
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchImpl,
      config: { locale: "fr", "Doc-Id": "42" },
    })

    await agent.send("hi")

    expect(requestInit(fetchImpl).headers["Config-locale"]).toBe("fr")
    expect(requestInit(fetchImpl).headers["Config-Doc-Id"]).toBe("42")
  })

  it("re-evaluates a headers callback on every request", async () => {
    const fetchImpl = fetchReturning(finished)
    let n = 0
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchImpl,
      headers: () => ({ "X-Request-N": `${++n}` }),
    })

    await agent.send("first")
    await agent.send("second")

    expect(requestInit(fetchImpl, 0).headers["X-Request-N"]).toBe("1")
    expect(requestInit(fetchImpl, 1).headers["X-Request-N"]).toBe("2")
  })

  it("re-evaluates a config callback on every request", async () => {
    const fetchImpl = fetchReturning(finished)
    let locale = "fr"
    const agent = new Conversation({
      endpoint: "/agent",
      fetch: fetchImpl,
      config: async () => ({ locale }),
    })

    await agent.send("first")
    locale = "en"
    await agent.send("second")

    expect(requestInit(fetchImpl, 0).headers["Config-locale"]).toBe("fr")
    expect(requestInit(fetchImpl, 1).headers["Config-locale"]).toBe("en")
  })

  it("omits Authorization when no token is given", async () => {
    const fetchImpl = fetchReturning(finished)
    const agent = new Conversation({ endpoint: "/agent", fetch: fetchImpl })

    await agent.send("hi")

    expect(requestInit(fetchImpl).headers.Authorization).toBeUndefined()
  })

  it("forwards the abort signal to fetch", async () => {
    const fetchImpl = fetchReturning(finished)
    const agent = new Conversation({ endpoint: "/agent", fetch: fetchImpl })
    const controller = new AbortController()

    await agent.send("hi", { signal: controller.signal })

    expect(requestInit(fetchImpl).signal).toBe(controller.signal)
  })
})

/** A fake `fetch` streaming the given AG-UI events back as server-sent events. */
function fetchReturning(events: object[]): typeof fetch {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")
  return vi.fn(async () => new Response(body)) as unknown as typeof fetch
}

const finished = [{ type: "RUN_FINISHED" }]

/** A text reply streamed as message "a1", then the end of the run. */
function reply(...deltas: string[]): object[] {
  return [
    { type: "TEXT_MESSAGE_START", messageId: "a1", role: "assistant" },
    ...deltas.map((delta) => ({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "a1",
      delta,
    })),
    { type: "TEXT_MESSAGE_END", messageId: "a1" },
    ...finished,
  ]
}

/** A tool call under an assistant message, its arguments split in two, then its result "r1". */
function toolRound(
  id: string,
  name: string,
  args: string,
  result: string,
  parentMessageId = "p1",
): object[] {
  return [
    { type: "TOOL_CALL_START", toolCallId: id, toolCallName: name, parentMessageId },
    { type: "TOOL_CALL_ARGS", toolCallId: id, delta: args.slice(0, 3) },
    { type: "TOOL_CALL_ARGS", toolCallId: id, delta: args.slice(3) },
    { type: "TOOL_CALL_END", toolCallId: id },
    {
      type: "TOOL_CALL_RESULT",
      messageId: "r1",
      toolCallId: id,
      content: result,
      role: "tool",
    },
  ]
}

// biome-ignore lint/suspicious/noExplicitAny: the recorded fetch init is untyped
function requestInit(fetchImpl: typeof fetch, call = 0): any {
  return (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[call]?.[1]
}

// biome-ignore lint/suspicious/noExplicitAny: parsed JSON body
function requestBody(fetchImpl: typeof fetch, call = 0): any {
  return JSON.parse(requestInit(fetchImpl, call).body)
}
