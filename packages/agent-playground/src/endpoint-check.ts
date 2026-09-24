// Probe an agent with its discovery endpoint: GET /agent.
//
// The expected response of a valid agent is a JSON object with:
// - a `name` of the agent
// - a `tools` list of tool names

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
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(PROBE_TIMEOUT_MS)]),
    })
  } catch (error) {
    if (signal.aborted) throw error
    if ((error as Error).name === "TimeoutError") return "The endpoint timed out."
    return "Can't reach this endpoint — check the URL (network error or CORS)."
  }
  if (response.status === 401 || response.status === 403)
    return "The endpoint rejected the token."
  if (response.status === 404) return "No agent found at this URL."
  if (!response.ok) return `The endpoint responded with HTTP ${response.status}.`
  if (await isAgentDescription(response)) return null
  return "Reachable, but the response is not an agent description."
}

async function isAgentDescription(response: Response): Promise<boolean> {
  try {
    const data = await response.json()

    return data.name && data.tools
  } catch {
    return false
  }
}
