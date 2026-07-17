import type { AgentEvent } from "@bump-sh/agent-conversation"
import { describe, expect, it } from "vitest"
import { Controller } from "../src/controller.js"
import type { ConversationLike } from "../src/types.js"

function fakeAgent(events: AgentEvent[]): ConversationLike {
  return {
    // eslint-disable-next-line require-yield
    async *send(): AsyncGenerator<AgentEvent> {
      for (const event of events) yield event
    },
  }
}

const options = {
  render: (text: string): string => text,
  avatar: "",
  todayLabel: "Today",
}

describe("Controller", () => {
  it("renders a user turn then streams the assistant reply", async () => {
    const thread = document.createElement("div")
    const agent = fakeAgent([
      { type: "tool", names: ["get_weather"] },
      { type: "text", delta: "Sunny in Paris" },
    ])

    await new Controller(thread, () => agent, options).send("weather?")

    const turns = thread.querySelectorAll(".turn")
    expect(turns).toHaveLength(2)
    expect(turns[0]?.classList.contains("user")).toBe(true)
    expect(turns[0]?.textContent).toBe("weather?")
    expect(turns[1]?.classList.contains("assistant")).toBe(true)
    expect(turns[1]?.textContent).toContain("Sunny in Paris")
  })

  it("clears the spinner once the stream is done", async () => {
    const thread = document.createElement("div")
    const agent = fakeAgent([{ type: "text", delta: "hi" }])

    await new Controller(thread, () => agent, options).send("hi")

    expect(thread.innerHTML).not.toContain("loader")
  })

  it("shows a fallback message on error events", async () => {
    const thread = document.createElement("div")
    const agent = fakeAgent([{ type: "error", error: new Error("boom") }])

    await new Controller(thread, () => agent, options).send("hi")

    const assistant = thread.querySelectorAll(".turn")[1]
    expect(assistant?.textContent).toBe("Something went wrong.")
  })

  it("breaks the paragraph between text sent before and after a tool call", async () => {
    const thread = document.createElement("div")
    const agent = fakeAgent([
      { type: "text", delta: "Checking now!" },
      { type: "tool", names: ["get_weather"] },
      { type: "text", delta: "Here it is." },
    ])

    await new Controller(thread, () => agent, options).send("weather?")

    const body = thread.querySelectorAll(".turn")[1]?.querySelector(".body")
    expect(body?.textContent).toBe("Checking now!\n\nHere it is.")
  })
})
