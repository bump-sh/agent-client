// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import { renderForm } from "../src/form.js"
import { defaults } from "../src/state.js"

function fieldLabelled(root: HTMLElement, label: string): HTMLElement {
  const caption = [...root.querySelectorAll(".field-label")].find(
    (node) => node.textContent === label,
  )
  return caption?.closest(".field") as HTMLElement
}

describe("renderForm", () => {
  it("shows a reset button on modified fields and restores the default", () => {
    const state = { ...defaults(), title: "Support" }
    const root = document.createElement("form")
    const onReset = vi.fn()
    renderForm(root, state, () => {}, onReset)

    const field = fieldLabelled(root, "Title")
    expect(field.classList.contains("modified")).toBe(true)
    ;(field.querySelector(".field-reset") as HTMLButtonElement).click()
    expect(state.title).toBe("Assistant")
    expect(onReset).toHaveBeenCalled()
  })

  it("marks a field as modified while typing", () => {
    const state = defaults()
    const root = document.createElement("form")
    renderForm(
      root,
      state,
      () => {},
      () => {},
    )

    const field = fieldLabelled(root, "Title")
    expect(field.classList.contains("modified")).toBe(false)
    const input = field.querySelector(".text-input") as HTMLInputElement
    input.value = "Support"
    input.dispatchEvent(new Event("input"))
    expect(field.classList.contains("modified")).toBe(true)
  })

  it("shows the inherited color in the swatch of an empty color field", () => {
    const root = document.createElement("form")
    renderForm(
      root,
      defaults(),
      () => {},
      () => {},
    )
    const swatch = fieldLabelled(root, "Button icons").querySelector(
      ".color-swatch",
    ) as HTMLInputElement
    expect(swatch.value).toBe("#ffffff")
  })

  it("gives connection fields and one-click controls no reset affordance", () => {
    const state = {
      ...defaults(),
      endpoint: "https://x/agent",
      mode: "inline",
      launcher: false,
    }
    const root = document.createElement("form")
    renderForm(
      root,
      state,
      () => {},
      () => {},
    )
    expect(fieldLabelled(root, "Endpoint").querySelector(".field-reset")).toBeNull()
    expect(fieldLabelled(root, "Mode").querySelector(".field-reset")).toBeNull()
    expect(
      fieldLabelled(root, "Launcher button").querySelector(".field-reset"),
    ).toBeNull()
  })
})
