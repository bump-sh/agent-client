// A tiny, safe markdown renderer: it escapes all HTML first, then re-introduces
// only a known subset of tags. No dependency, no raw HTML passthrough.

// Link URLs must start with a known-safe scheme; anything else (javascript:,
// data:, …) is dropped to plain text. Note: `& < >` are already entity-escaped
// by renderMarkdown before inline() runs, so only `"` can still break the href.
const SAFE_URL = /^(https?:|mailto:|#|\/|\.)/i
const escapeAttr = (url: string): string => url.replace(/"/g, "&quot;")

const link = (_match: string, text: string, url: string): string =>
  SAFE_URL.test(url)
    ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${text}</a>`
    : text

const inline = (s: string): string =>
  s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, link)

const isSpecial = (l: string): boolean =>
  /^```|^#{1,3}\s|^\s*[-*]\s+|^\s*\d+\.\s+|^\s*>|^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)

/** Render a markdown string to a safe HTML string. */
export function renderMarkdown(src: string): string {
  const lines = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")

  let html = ""
  let i = 0
  while (i < lines.length) {
    const line = lines[i] as string

    if (/^```/.test(line)) {
      let code = ""
      i++
      while (i < lines.length && !/^```/.test(lines[i] as string))
        code += `${lines[i++]}\n`
      i++
      html += `<pre><code>${code.replace(/\n$/, "")}</code></pre>`
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.*)/)
    if (heading) {
      const level = (heading[1] as string).length + 2
      html += `<h${level}>${inline(heading[2] as string)}</h${level}>`
      i++
      continue
    }

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1] as string)
    ) {
      const row = (r: string) =>
        r
          .replace(/^\s*\|/, "")
          .replace(/\|\s*$/, "")
          .split("|")
          .map((c) => c.trim())
      const head = row(line)
      i += 2
      const body: string[][] = []
      while (i < lines.length && (lines[i] as string).includes("|"))
        body.push(row(lines[i++] as string))
      html +=
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
        `${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      continue
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html += "<hr>"
      i++
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i] as string))
        items.push((lines[i++] as string).replace(/^\s*>\s?/, ""))
      html += `<blockquote>${items.map(inline).join("<br>")}</blockquote>`
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] as string))
        items.push((lines[i++] as string).replace(/^\s*[-*]\s+/, ""))
      html += `<ul>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] as string))
        items.push((lines[i++] as string).replace(/^\s*\d+\.\s+/, ""))
      html += `<ol>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ol>`
      continue
    }

    if (/^\s*$/.test(line)) {
      i++
      continue
    }

    const para: string[] = []
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i] as string) &&
      !isSpecial(lines[i] as string)
    )
      para.push(lines[i++] as string)
    html += `<p>${para.map(inline).join("<br>")}</p>`
  }
  return html
}
