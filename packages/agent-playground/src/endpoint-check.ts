// Probe an endpoint the same way the widget will talk to it: POST an empty
// history, then check the first NDJSON line is an agent event. The stream is
// cancelled right away, so a valid agent never produces a full (billed) run.

const PROBE_TIMEOUT_MS = 6000

/** Returns a short error message, or null when the endpoint looks compatible. */
export async function checkEndpoint(
  url: string,
  token: string,
  signal: AbortSignal,
): Promise<string | null> {
  if (!/^https?:\/\/\S+$/.test(url)) return "Enter a full http(s):// URL."
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages: [] }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(PROBE_TIMEOUT_MS)]),
    })
  } catch (error) {
    if (signal.aborted) throw error
    if ((error as Error).name === "TimeoutError") return "The endpoint timed out."
    return "Can't reach this endpoint — check the URL (network error or CORS)."
  }
  if (response.status === 401 || response.status === 403)
    return "The endpoint rejected the token."
  // An agent refuses the empty history with a JSON 400 — that IS the protocol
  // answering, so the endpoint is compatible without having run anything.
  if (response.status === 400)
    return (await isJsonBody(response)) ? null : "The endpoint responded with HTTP 400."
  if (response.status === 404) return "No agent found at this URL."
  if (!response.ok) return `The endpoint responded with HTTP ${response.status}.`
  if (await startsWithAgentEvent(response)) return null
  return "Reachable, but the response is not an agent event stream."
}

async function isJsonBody(response: Response): Promise<boolean> {
  try {
    const body: unknown = await response.json()
    return typeof body === "object" && body !== null
  } catch {
    return false
  }
}

async function startsWithAgentEvent(response: Response): Promise<boolean> {
  const reader = response.body?.getReader()
  if (!reader) return false
  try {
    const event: unknown = JSON.parse(await firstLine(reader))
    return typeof (event as { type?: unknown })?.type === "string"
  } catch {
    return false
  } finally {
    reader.cancel().catch(() => {})
  }
}

async function firstLine(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<string> {
  const decoder = new TextDecoder()
  let buffer = ""
  while (buffer.length < 4096) {
    const { done, value } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: true })
    const newline = buffer.indexOf("\n")
    if (newline >= 0) return buffer.slice(0, newline)
    if (done) break
  }
  return buffer
}
