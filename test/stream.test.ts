import { describe, expect, it } from "vitest"
import { type WireEvent, parseNdjson } from "../src/stream.js"

/** Build a ReadableStream that emits the given string chunks as UTF-8 bytes. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(chunks: string[]): Promise<WireEvent[]> {
  const events: WireEvent[] = []
  for await (const event of parseNdjson(streamOf(chunks))) events.push(event)
  return events
}

describe("parseNdjson", () => {
  it("parses one JSON object per line", async () => {
    const events = await collect(['{"type":"text","content":"Hi"}\n{"type":"done"}\n'])
    expect(events).toEqual([{ type: "text", content: "Hi" }, { type: "done" }])
  })

  it("recomposes a line split across two chunks", async () => {
    const events = await collect(['{"type":"text","con', 'tent":"Hi"}\n'])
    expect(events).toEqual([{ type: "text", content: "Hi" }])
  })

  it("emits a trailing line that has no final newline", async () => {
    const events = await collect(['{"type":"done"}'])
    expect(events).toEqual([{ type: "done" }])
  })
})
