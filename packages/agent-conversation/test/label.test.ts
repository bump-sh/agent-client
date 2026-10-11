import { describe, expect, it } from "vitest"
import { resolveLabel } from "../src/label.js"

describe("resolveLabel", () => {
  it("fills the variables of a template with the arguments", () => {
    const label = "Update {args.parking}"

    const text = resolveLabel(label, { parking: "Ralliement" })

    expect(text).toBe("Update Ralliement")
  })

  it("has no text when a variable does not resolve to a printable value", () => {
    const args = { parking: "Ralliement" }

    expect(resolveLabel("Update {args.city}", args)).toBeUndefined()
  })

  it("calls a function label with the arguments", () => {
    const label = (args: { n: number }) => `${args.n + 1}`

    expect(resolveLabel(label, { n: 1 })).toBe("2")
  })
})
