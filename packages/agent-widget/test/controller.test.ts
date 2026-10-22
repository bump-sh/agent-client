import type { AgentEvent, ToolConfirmation } from "@bump-sh/agent-conversation"
import { describe, expect, it, vi } from "vitest"
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
  copyLabel: "Copy code",
}

describe("Controller", () => {
  it("renders a user turn then streams the assistant reply", async () => {
    const thread = document.createElement("div")
    const agent = fakeAgent([
      { type: "tool", name: "get_weather" },
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

  it("lists every tool of a turn in the status while they run", async () => {
    const thread = document.createElement("div")
    let status = ""
    const agent: ConversationLike = {
      async *send(): AsyncGenerator<AgentEvent> {
        yield { type: "tool", name: "get_weather" }
        yield { type: "tool", name: "get_forecast" }
        status = thread.querySelector(".status-label")?.textContent ?? ""
      },
    }

    await new Controller(thread, () => agent, options).send("weather?")

    expect(status).toBe("get weather, get forecast")
  })

  it("keeps the assistant turn busy until its reply has streamed", async () => {
    const thread = document.createElement("div")
    let busyWhileStreaming: string | null | undefined
    const agent = {
      async *send(): AsyncGenerator<AgentEvent> {
        yield { type: "text", delta: "Sunny" }
        busyWhileStreaming = thread
          .querySelector(".turn.assistant")
          ?.getAttribute("aria-busy")
      },
    }

    await new Controller(thread, () => agent, options).send("weather?")

    expect(busyWhileStreaming).toBe("true")
    expect(thread.querySelector(".turn.assistant")?.hasAttribute("aria-busy")).toBe(
      false,
    )
  })

  it("renders a confirmation that executes the tool on click", async () => {
    const thread = document.createElement("div")
    const confirmation = askedConfirmation(async () => {})
    const agent = fakeAgent([{ type: "confirmation", confirmation }])

    await new Controller(thread, () => agent, options).send("find shoes")
    const button = thread.querySelector<HTMLButtonElement>(".action-confirmation")
    button?.click()
    await vi.waitFor(() => expect(button?.dataset.state).toBe("done"))

    expect(button?.textContent).toBe("Search shoes")
    expect(button?.getAttribute("part")).toBe("action action-confirmation")
    expect(button?.disabled).toBe(true)
    expect(confirmation.accept).toHaveBeenCalledOnce()
  })

  it("marks a confirmation whose tool failed, and reports the error", async () => {
    const thread = document.createElement("div")
    const reportError = vi.fn()
    vi.stubGlobal("reportError", reportError)
    const confirmation = askedConfirmation(async () => {
      throw new Error("no page")
    })
    const agent = fakeAgent([{ type: "confirmation", confirmation }])

    await new Controller(thread, () => agent, options).send("find shoes")
    const button = thread.querySelector<HTMLButtonElement>(".action-confirmation")
    button?.click()

    await vi.waitFor(() => expect(button?.dataset.state).toBe("failed"))
    expect(reportError).toHaveBeenCalledWith(new Error("no page"))
    vi.unstubAllGlobals()
  })

  it("dismisses the confirmations left pending when the next message is sent", async () => {
    const thread = document.createElement("div")
    const confirmation = askedConfirmation(async () => {})
    const agent = fakeAgent([{ type: "confirmation", confirmation }])
    const controller = new Controller(thread, () => agent, options)

    await controller.send("find shoes")
    await controller.send("never mind")

    const [dismissed, fresh] =
      thread.querySelectorAll<HTMLButtonElement>(".action-confirmation")
    expect(dismissed?.disabled).toBe(true)
    expect(dismissed?.dataset.state).toBe("dismissed")
    expect(fresh?.disabled).toBe(false)
  })

  it("copies a code block's content with its copy button", async () => {
    const thread = document.createElement("div")
    const writeText = vi.fn(async () => {})
    vi.stubGlobal("navigator", { clipboard: { writeText } })

    new Controller(thread, () => fakeAgent([]), options).greet(
      "<pre><code>ls -la</code></pre>",
    )
    const button = thread.querySelector<HTMLButtonElement>(".code-block .copy")
    button?.click()

    expect(button?.getAttribute("aria-label")).toBe("Copy code")
    await vi.waitFor(() => expect(button?.dataset.state).toBe("done"))
    expect(writeText).toHaveBeenCalledWith("ls -la")
    vi.unstubAllGlobals()
  })

  it("keeps a code block's copied state for a moment after the last click", async () => {
    vi.useFakeTimers()
    const thread = document.createElement("div")
    vi.stubGlobal("navigator", { clipboard: { writeText: async () => {} } })

    new Controller(thread, () => fakeAgent([]), options).greet(
      "<pre><code>ls</code></pre>",
    )
    const button = thread.querySelector<HTMLButtonElement>(".copy")
    button?.click()
    await vi.advanceTimersByTimeAsync(1500)
    button?.click()
    await vi.advanceTimersByTimeAsync(1000)

    expect(button?.dataset.state).toBe("done")
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})

function askedConfirmation(accept: () => Promise<void>): ToolConfirmation {
  return {
    name: "apply_search",
    args: { query: "shoes" },
    label: "Search shoes",
    accept: vi.fn(accept),
  }
}
