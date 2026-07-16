import { describe, expect, it, vi } from "vitest"
import { Agent } from "../src/agent.js"
import type { AgentEvent, Message } from "../src/types.js"

/** A fake `fetch` that streams the given NDJSON lines back as the response body. */
function fetchReturning(lines: string[]): typeof fetch {
  const body = lines.join("")
  return vi.fn(async () => new Response(body)) as unknown as typeof fetch
}

describe("Agent", () => {
  it("accumulates text and resolves to the final reply", async () => {
    const agent = new Agent({
      endpoint: "/chat",
      fetch: fetchReturning([
        '{"type":"text","content":"Hello "}\n',
        '{"type":"text","content":"world"}\n',
        '{"type":"done"}\n',
      ]),
    })

    const reply = await agent.send("hi")

    expect(reply).toBe("Hello world")
    expect(agent.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hello world" },
    ])
  })

  it("records the user turn synchronously, before the stream is consumed", () => {
    const agent = new Agent({ endpoint: "/chat", fetch: fetchReturning([]) })

    agent.send("hi") // not awaited / not iterated

    expect(agent.messages).toEqual([{ role: "user", content: "hi" }])
  })

  it("exposes messages as a copy, not the internal array", () => {
    const agent = new Agent({ endpoint: "/chat", fetch: fetchReturning([]) })
    agent.send("hi")

    const snapshot = agent.messages as Message[]
    snapshot.push({ role: "user", content: "tampered" })

    expect(agent.messages).toEqual([{ role: "user", content: "hi" }])
  })

  it("replays history on the next turn", async () => {
    const fetchImpl = fetchReturning(['{"type":"text","content":"ok"}\n'])
    const agent = new Agent({ endpoint: "/chat", fetch: fetchImpl })

    await agent.send("first")
    await agent.send("second")

    const secondBody = JSON.parse(
      (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[1][1].body,
    )
    expect(secondBody.messages.map((m: { content: string }) => m.content)).toEqual([
      "first",
      "ok",
      "second",
    ])
  })

  it("surfaces text and tool events to callbacks", async () => {
    const agent = new Agent({
      endpoint: "/chat",
      fetch: fetchReturning([
        '{"type":"tool","names":["get_weather"]}\n',
        '{"type":"text","content":"Sunny"}\n',
        '{"type":"done"}\n',
      ]),
    })
    const tools: string[][] = []
    const deltas: string[] = []
    agent.on("tool", (names) => tools.push(names))
    agent.on("text", (delta) => deltas.push(delta))

    await agent.send("weather?")

    expect(tools).toEqual([["get_weather"]])
    expect(deltas).toEqual(["Sunny"])
  })

  it("yields events when iterated", async () => {
    const agent = new Agent({
      endpoint: "/chat",
      fetch: fetchReturning(['{"type":"text","content":"Hi"}\n', '{"type":"done"}\n']),
    })

    const events: AgentEvent[] = []
    for await (const event of agent.send("hi")) events.push(event)

    expect(events).toEqual([{ type: "text", delta: "Hi" }])
  })

  it("rejects and emits on a server error event", async () => {
    const agent = new Agent({
      endpoint: "/chat",
      fetch: fetchReturning(['{"type":"error","content":"boom"}\n']),
    })
    const errors: Error[] = []
    agent.on("error", (error) => errors.push(error))

    await expect(agent.send("hi")).rejects.toThrow("boom")
    expect(errors.map((e) => e.message)).toEqual(["boom"])
  })

  it("rejects when the request fails", async () => {
    const agent = new Agent({
      endpoint: "/chat",
      fetch: vi.fn(
        async () => new Response("nope", { status: 500 }),
      ) as unknown as typeof fetch,
    })

    await expect(agent.send("hi")).rejects.toThrow("status 500")
  })

  it("reset() clears history", async () => {
    const agent = new Agent({
      endpoint: "/chat",
      fetch: fetchReturning(['{"type":"text","content":"ok"}\n', '{"type":"done"}\n']),
    })

    await agent.send("hi")
    agent.reset()

    expect(agent.messages).toEqual([])
  })

  it("sends a string token as an Authorization bearer header", async () => {
    const fetchImpl = fetchReturning(['{"type":"done"}\n'])
    const agent = new Agent({ endpoint: "/chat", fetch: fetchImpl, token: "t0ken" })

    await agent.send("hi")

    const init = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(init.headers.Authorization).toBe("Bearer t0ken")
  })

  it("re-evaluates a token callback on every request so it can refresh", async () => {
    const fetchImpl = fetchReturning(['{"type":"done"}\n'])
    let n = 0
    const agent = new Agent({
      endpoint: "/chat",
      fetch: fetchImpl,
      token: async () => `t${++n}`,
    })

    await agent.send("first")
    await agent.send("second")

    const calls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0][1].headers.Authorization).toBe("Bearer t1")
    expect(calls[1][1].headers.Authorization).toBe("Bearer t2")
  })

  it("omits Authorization when no token is given", async () => {
    const fetchImpl = fetchReturning(['{"type":"done"}\n'])
    const agent = new Agent({ endpoint: "/chat", fetch: fetchImpl })

    await agent.send("hi")

    const init = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it("forwards the abort signal to fetch", async () => {
    const fetchImpl = fetchReturning(['{"type":"done"}\n'])
    const agent = new Agent({ endpoint: "/chat", fetch: fetchImpl })
    const controller = new AbortController()

    await agent.send("hi", { signal: controller.signal })

    const init = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(init.signal).toBe(controller.signal)
  })
})
