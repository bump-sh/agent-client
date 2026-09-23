import type { AgentEvent } from "@bump-sh/agent-conversation"
import { describe, expect, it, vi } from "vitest"
import { Widget } from "../src/index.js"
import type { ConversationLike } from "../src/types.js"

function fakeConversation(): ConversationLike {
  return {
    async *send(): AsyncGenerator<AgentEvent> {
      yield { type: "text", delta: "Hello" }
    },
  }
}

describe("Widget", () => {
  it("mounts an <agent-widget> element and exposes a handle", () => {
    const chat = new Widget({ conversation: fakeConversation() })

    const element = document.querySelector("agent-widget")
    expect(element).not.toBeNull()
    expect(chat.element).toBe(element)

    chat.destroy()
    expect(document.querySelector("agent-widget")).toBeNull()
  })

  it("uses a provided conversation instead of building one from endpoint", () => {
    const conversation = fakeConversation()
    const chat = new Widget({ conversation })
    expect(chat.conversation).toBe(conversation)
    chat.destroy()
  })

  it("applies theme tokens as --agent-* custom properties", () => {
    const chat = new Widget({
      conversation: fakeConversation(),
      theme: { accent: "#e11d48", buttonFg: "#111111", inputBg: "#fafafa" },
    })
    expect(chat.element.style.getPropertyValue("--agent-accent")).toBe("#e11d48")
    expect(chat.element.style.getPropertyValue("--agent-button-fg")).toBe("#111111")
    expect(chat.element.style.getPropertyValue("--agent-input-bg")).toBe("#fafafa")
    chat.destroy()
  })

  it("reflects the display mode as an attribute", () => {
    const chat = new Widget({ conversation: fakeConversation(), mode: "sidebar" })
    expect(chat.element.getAttribute("mode")).toBe("sidebar")
    chat.destroy()
  })

  it("renders the launcher by default but omits it when launcher is false", () => {
    const shown = new Widget({ conversation: fakeConversation(), mode: "modal" })
    expect(shown.element.shadowRoot?.querySelector(".launcher")).not.toBeNull()
    shown.destroy()

    const hidden = new Widget({
      conversation: fakeConversation(),
      mode: "modal",
      launcher: false,
    })
    expect(hidden.element.shadowRoot?.querySelector(".launcher")).toBeNull()
    hidden.destroy()
  })

  it("renders the default sparkle launcher icon, replaceable via launcherIcon", () => {
    const sparkle = new Widget({ conversation: fakeConversation(), mode: "modal" })
    expect(sparkle.element.shadowRoot?.querySelector(".launcher svg")).not.toBeNull()
    sparkle.destroy()

    const emoji = new Widget({
      conversation: fakeConversation(),
      mode: "modal",
      launcherIcon: "🤖",
    })
    expect(emoji.element.shadowRoot?.querySelector(".launcher")?.textContent).toBe("🤖")
    emoji.destroy()

    const image = new Widget({
      conversation: fakeConversation(),
      mode: "modal",
      launcherIcon: "https://example.com/bot.png",
    })
    const img = image.element.shadowRoot?.querySelector(".launcher img")
    expect(img?.getAttribute("src")).toBe("https://example.com/bot.png")
    image.destroy()
  })

  it("shows clickable suggestions until the first message is sent", async () => {
    const chat = new Widget({
      conversation: fakeConversation(),
      mode: "inline",
      suggestions: ["What can you do?", "Show me the docs"],
    })
    const shadow = chat.element.shadowRoot as ShadowRoot
    const chips = shadow.querySelectorAll(".suggestion")
    expect([...chips].map((chip) => chip.textContent)).toEqual([
      "What can you do?",
      "Show me the docs",
    ])
    ;(chips[0] as HTMLButtonElement).click()
    expect(shadow.querySelector(".suggestions")).toBeNull()
    expect(shadow.querySelector(".turn.user")?.textContent).toBe("What can you do?")
    chat.destroy()
  })

  it("renders no suggestions container when none are configured", () => {
    const chat = new Widget({ conversation: fakeConversation(), mode: "inline" })
    expect(chat.element.shadowRoot?.querySelector(".suggestions")).toBeNull()
    chat.destroy()
  })

  it("dismisses on an outside click but not on clicks inside the panel", () => {
    const chat = new Widget({
      conversation: fakeConversation(),
      mode: "sidebar",
      open: true,
    })
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

  it("forwards a token to the built-in conversation as an Authorization header", async () => {
    const fetchMock = vi.fn(async () => new Response('{"type":"done"}\n'))
    vi.stubGlobal("fetch", fetchMock)

    const chat = new Widget({ endpoint: "/chat", token: "s3cret" })
    for await (const _event of chat.conversation.send("hi")) {
      // drain the stream so the request actually fires
    }

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer s3cret")

    vi.unstubAllGlobals()
    chat.destroy()
  })

  it("forwards a list of allowed tools to the built-in conversation as a request body argument", async () => {
    const fetchMock = vi.fn(async () => new Response('{"type":"done"}\n'))
    vi.stubGlobal("fetch", fetchMock)

    const chat = new Widget({ endpoint: "/chat", allowedTools: ["doThis"] })
    for await (const _event of chat.conversation.send("hi")) {
      // drain the stream so the request actually fires
    }

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).allowed_tools).toEqual([
      "doThis",
    ])

    vi.unstubAllGlobals()
    chat.destroy()
  })

  it("streams a reply into the thread when a message is sent", async () => {
    const chat = new Widget({ conversation: fakeConversation(), mode: "inline" })
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
