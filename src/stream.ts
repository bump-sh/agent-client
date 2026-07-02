/** A single parsed line from the NDJSON stream (the Bump.sh wire format). */
export type WireEvent =
  | { type: "text"; content: string }
  | { type: "tool"; names: string[] }
  | { type: "error"; content: string }
  | { type: "done" }

/**
 * Parse an `application/x-ndjson` body into wire events. Buffers partial lines,
 * so a JSON object split across two network chunks is recomposed correctly.
 */
export async function* parseNdjson(
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
        const newline = buffer.indexOf("\n")
        if (newline < 0) break
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) yield JSON.parse(line) as WireEvent
      }
    }
    const last = buffer.trim()
    if (last) yield JSON.parse(last) as WireEvent
  } finally {
    reader.releaseLock()
  }
}
