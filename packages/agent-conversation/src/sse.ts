/** The AG-UI events the client reads, as received on the wire. Any other is ignored. */
export type WireEvent =
  | { type: "TEXT_MESSAGE_START"; messageId: string }
  | { type: "TEXT_MESSAGE_CONTENT"; messageId: string; delta: string }
  | {
      type: "TOOL_CALL_START"
      toolCallId: string
      toolCallName: string
      parentMessageId?: string
    }
  | { type: "TOOL_CALL_ARGS"; toolCallId: string; delta: string }
  | { type: "TOOL_CALL_RESULT"; messageId: string; toolCallId: string; content: string }
  | { type: "RUN_ERROR"; message: string }
  | { type: "RUN_FINISHED" }

/** A blank line ends a frame; lines may end in LF or CRLF. */
const FRAME_END = /\r?\n\r?\n/
const LINE_END = /\r?\n/

/**
 * Parse a `text/event-stream` body into events. Only `data:` lines carry
 * events (one JSON object per frame); comments and other fields are ignored.
 * Buffers partial frames, so a frame split across two network chunks is
 * recomposed correctly.
 */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<WireEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      for (;;) {
        const separator = FRAME_END.exec(buffer)
        if (!separator) break
        const event = parseFrame(buffer.slice(0, separator.index))
        buffer = buffer.slice(separator.index + separator[0].length)
        if (event) yield event
      }
    }
    const last = parseFrame(buffer)
    if (last) yield last
  } finally {
    reader.releaseLock()
  }
}

function parseFrame(frame: string): WireEvent | undefined {
  const data = frame
    .split(LINE_END)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n")
  return data ? (JSON.parse(data) as WireEvent) : undefined
}
