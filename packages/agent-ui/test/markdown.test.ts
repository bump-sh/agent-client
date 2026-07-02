import { describe, expect, it } from "vitest"
import { renderMarkdown } from "../src/markdown.js"

describe("renderMarkdown", () => {
  it("escapes HTML before rendering (no live tags)", () => {
    const html = renderMarkdown("<script>alert(1)</script>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("renders bold and inline code", () => {
    expect(renderMarkdown("**hi** and `code`")).toContain("<strong>hi</strong>")
    expect(renderMarkdown("**hi** and `code`")).toContain("<code>code</code>")
  })

  it("renders unordered lists", () => {
    expect(renderMarkdown("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>")
  })

  it("renders fenced code blocks without interpreting their content", () => {
    const html = renderMarkdown("```\n<b>x</b>\n```")
    expect(html).toBe("<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>")
  })

  it("renders tables", () => {
    const html = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |")
    expect(html).toContain("<table>")
    expect(html).toContain("<th>a</th>")
    expect(html).toContain("<td>1</td>")
  })
})
