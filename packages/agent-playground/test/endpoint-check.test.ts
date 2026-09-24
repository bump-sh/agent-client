import { afterEach, describe, expect, it, vi } from "vitest"
import { checkEndpoint } from "../src/endpoint-check.js"

const signal = () => new AbortController().signal
const check = (url = "https://x/agent") => checkEndpoint(url, "", signal())

afterEach(() => vi.unstubAllGlobals())

describe("checkEndpoint", () => {
  it("rejects malformed URLs without hitting the network", async () => {
    expect(await check("localhost:3001/agent")).toContain("http(s)://")
    expect(await check("not a url")).toContain("http(s)://")
  })

  it("accepts an endpoint whose stream starts with an agent event", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response('{"name":"My super agent", "tools": ["doThings"]}'),
    )
    expect(await check()).toBeNull()
  })

  it("flags a reachable URL that does not speak the agent protocol", async () => {
    vi.stubGlobal("fetch", async () => new Response("<!doctype html><html>…"))
    expect(await check()).toContain("not an agent description")
  })

  it("still flags a 400 whose body is not JSON", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 400 }))
    expect(await check()).toContain("HTTP 400")
  })

  it("reports a missing agent on 404", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }))
    expect(await check()).toContain("No agent found")
  })

  it("distinguishes auth failures from other HTTP errors", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 401 }))
    expect(await check()).toContain("rejected the token")

    vi.stubGlobal("fetch", async () => new Response("", { status: 500 }))
    expect(await check()).toContain("HTTP 500")
  })

  it("reports network failures as unreachable", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch")
    })
    expect(await check()).toContain("Can't reach this endpoint — check the URL")
  })

  it("sends the probe like the widget would, token included", async () => {
    const fetchMock = vi.fn(
      async () => new Response('{"name":"My super agent", "tools": ["doThings"]}'),
    )
    vi.stubGlobal("fetch", fetchMock)
    await checkEndpoint("https://x/agent", "s3cret", signal())
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe("GET")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer s3cret")
  })
})
