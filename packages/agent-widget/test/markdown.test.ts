import { describe, expect, it } from "vitest"
import { renderMarkdown } from "../src/markdown.js"

describe("renderMarkdown", () => {
  it("escapes HTML before rendering (no live tags)", () => {
    const html = renderMarkdown("<script>alert(1)</script>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("escapes HTML in every kind of block", () => {
    const blocks = [
      "# <b>",
      "- <b>",
      "1. <b>",
      "> <b>",
      "| <b> |\n| - |\n| <b> |",
      "```\n<b>\n```",
    ]
    for (const block of blocks) expect(renderMarkdown(block)).not.toContain("<b>")
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

  it("renders blockquotes, one line per quoted line", () => {
    expect(renderMarkdown("> Ordered from\n> the most recent.")).toBe(
      "<blockquote>Ordered from<br>the most recent.</blockquote>",
    )
  })

  it("ends a paragraph where a blockquote starts", () => {
    expect(renderMarkdown("Note:\n> **careful**")).toBe(
      "<p>Note:</p><blockquote><strong>careful</strong></blockquote>",
    )
  })

  it("renders tables", () => {
    const html = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |")
    expect(html).toContain("<table>")
    expect(html).toContain("<th>a</th>")
    expect(html).toContain("<td>1</td>")
  })

  it("renders safe links", () => {
    expect(renderMarkdown("[Bump](https://bump.sh)")).toContain(
      '<a href="https://bump.sh" target="_blank" rel="noopener">Bump</a>',
    )
  })

  it("drops javascript: link schemes to plain text", () => {
    const html = renderMarkdown("[click](javascript:alert(1))")
    expect(html).not.toContain("href")
    expect(html).not.toContain("javascript:")
    expect(html).toContain("click")
  })

  it("drops data: link schemes to plain text", () => {
    const html = renderMarkdown("[x](data:text/html,<script>alert(1)</script>)")
    expect(html).not.toContain("href")
    expect(html).not.toContain("data:")
  })

  it("escapes quotes so a URL cannot break out of the href attribute", () => {
    const html = renderMarkdown('[x](https://a.com/"onmouseover="alert(1))')
    expect(html).not.toContain('"onmouseover=')
    expect(html).toContain("&quot;")
  })
})
