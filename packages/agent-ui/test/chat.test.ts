import type { AgentEvent } from "@bump-sh/agent-client"
import { describe, expect, it, vi } from "vitest"
import { Chat } from "../src/index.js"
import type { AgentLike } from "../src/types.js"

function fakeAgent(): AgentLike {
  return {
    async *send(): AsyncGenerator<AgentEvent> {
      yield { type: "text", delta: "Hello" }
    },
  }
}

describe("Chat", () => {
  it("mounts an <agent-chat> element and exposes a handle", () => {
    const chat = new Chat({ agent: fakeAgent() })

    const element = document.querySelector("agent-chat")
    expect(element).not.toBeNull()
    expect(chat.element).toBe(element)

    chat.destroy()
    expect(document.querySelector("agent-chat")).toBeNull()
  })

  it("uses a provided agent instead of building one from endpoint", () => {
    const agent = fakeAgent()
    const chat = new Chat({ agent })
    expect(chat.agent).toBe(agent)
    chat.destroy()
  })

  it("applies theme tokens as --agent-* custom properties", () => {
    const chat = new Chat({ agent: fakeAgent(), theme: { accent: "#e11d48" } })
    expect(chat.element.style.getPropertyValue("--agent-accent")).toBe("#e11d48")
    chat.destroy()
  })

  it("reflects the display mode as an attribute", () => {
    const chat = new Chat({ agent: fakeAgent(), mode: "sidebar" })
    expect(chat.element.getAttribute("mode")).toBe("sidebar")
    chat.destroy()
  })

  it("dismisses on an outside click but not on clicks inside the panel", () => {
    const chat = new Chat({ agent: fakeAgent(), mode: "sidebar", open: true })
    const shadow = chat.element.shadowRoot as ShadowRoot
    const panel = shadow.querySelector(".panel") as HTMLElement
    const input = shadow.querySelector(".input") as HTMLElement
    expect(chat.element.hasAttribute("open")).toBe(true)

    input.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(chat.element.hasAttribute("open")).toBe(true)

    panel.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(chat.element.hasAttribute("open")).toBe(false)
    chat.destroy()
  })

  it("forwards a token to the built-in agent as an Authorization header", async () => {
    const fetchMock = vi.fn(async () => new Response('{"type":"done"}\n'))
    vi.stubGlobal("fetch", fetchMock)

    const chat = new Chat({ endpoint: "/chat", token: "s3cret" })
    for await (const _event of chat.agent.send("hi")) {
      // drain the stream so the request actually fires
    }

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer s3cret")

    vi.unstubAllGlobals()
    chat.destroy()
  })

  it("streams a reply into the thread when a message is sent", async () => {
    const chat = new Chat({ agent: fakeAgent(), mode: "inline" })
    const shadow = chat.element.shadowRoot as ShadowRoot
    const input = shadow.querySelector(".input") as HTMLTextAreaElement
    const form = shadow.querySelector(".composer") as HTMLFormElement

    input.value = "hi"
    form.dispatchEvent(new Event("submit"))
    await Promise.resolve()
    await Promise.resolve()

    expect(shadow.querySelector(".turn.user")?.textContent).toBe("hi")
    await vi_waitFor(
      () =>
        shadow.querySelector(".turn.assistant")?.textContent?.includes("Hello") ??
        false,
    )
    chat.destroy()
  })
})

// Minimal poll helper (avoids extra deps) for the async streaming assertion.
async function vi_waitFor(check: () => boolean, tries = 20): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if (check()) return
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error("condition not met in time")
}
