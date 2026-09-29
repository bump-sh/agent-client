import { describe, expect, it } from "vitest"
import { type WireEvent, parseSse } from "../src/sse.js"

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
  for await (const event of parseSse(streamOf(chunks))) events.push(event)
  return events
}

describe("parseSse", () => {
  it("parses one JSON event per data frame", async () => {
    const events = await collect([
      'data: {"type":"RUN_STARTED"}\n\ndata: {"type":"RUN_FINISHED"}\n\n',
    ])
    expect(events).toEqual([{ type: "RUN_STARTED" }, { type: "RUN_FINISHED" }])
  })

  it("recomposes a frame split across two chunks", async () => {
    const events = await collect([
      'data: {"type":"TEXT_MESSAGE_CONTENT","del',
      'ta":"Hi"}\n\n',
    ])
    expect(events).toEqual([{ type: "TEXT_MESSAGE_CONTENT", delta: "Hi" }])
  })

  it("ignores comments and non-data fields, and joins multi-line data", async () => {
    const events = await collect([
      ': ping\n\nevent: x\nid: 1\ndata: {"type":"CUSTOM",\ndata: "name":"n"}\n\n',
    ])
    expect(events).toEqual([{ type: "CUSTOM", name: "n" }])
  })

  it("accepts CRLF line endings", async () => {
    const events = await collect([
      'data: {"type":"RUN_STARTED"}\r\n\r\ndata: {"type":"RUN_FI',
      'NISHED"}\r\n\r\n',
    ])
    expect(events).toEqual([{ type: "RUN_STARTED" }, { type: "RUN_FINISHED" }])
  })

  it("emits a trailing frame that has no final separator", async () => {
    const events = await collect(['data: {"type":"RUN_FINISHED"}'])
    expect(events).toEqual([{ type: "RUN_FINISHED" }])
  })
})
