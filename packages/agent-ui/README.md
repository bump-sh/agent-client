# @bump-sh/agent-ui

Embeddable, themeable chat widget for Bump.sh agents. A Web Component you drop in
with 3 lines — fully isolated (Shadow DOM), fully customizable.

- **3-line path** — `new Chat({ endpoint })` and you have a chat box.
- **3 display modes** — `modal` (default), `sidebar`, `fullscreen`.
- **Isolated** — Shadow DOM: the host page's CSS can't leak in, and vice versa.
- **Customizable** — CSS tokens, `::part()`, slots, and options.
- **BYO agent** — pass your own [`@bump-sh/agent-client`](../agent-client) `Agent`.

## Install

```sh
npm install @bump-sh/agent-ui
```

## Quickstart

```ts
import { Chat } from "@bump-sh/agent-ui"

new Chat({ endpoint: "https://your-host/demo/weather/agent/chat" })
```

That mounts a floating launcher + modal. Or declaratively:

```html
<agent-chat endpoint="https://…/agent/chat" mode="sidebar"></agent-chat>
<script type="module" src="https://unpkg.com/@bump-sh/agent-ui"></script>
```

## Options

```ts
const chat = new Chat({
  endpoint,                         // OR agent: myAgent  (bring your own)
  headers,                          // forwarded to the built-in Agent (auth)
  mode: "modal",                    // "modal" | "sidebar" | "fullscreen"
  target: "#app",                   // fullscreen container; modal/sidebar → <body>
  open: false,                      // start opened
  theme: { accent: "#4f7cff" },     // → CSS custom properties
  title: "Assistant",
  subtitle: "AI Agent",             // small line under the title
  placeholder: "Ask anything…",
  greeting: "Hi! How can I help?",  // optional first assistant message
  avatar: "https://…/logo.png",     // image URL or inline emoji/HTML
  disclaimer: "AI can make mistakes…", // footer under the composer ("" to hide)
  renderMarkdown: (text) => "…",    // replace the built-in safe renderer
})

chat.open(); chat.close(); chat.toggle(); chat.destroy()
chat.agent // the underlying Agent
```

### Markdown rendering

The built-in renderer is intentionally tiny and dependency-free: it escapes all
HTML first, then re-introduces a fixed, safe subset (bold, code, lists, tables,
and links restricted to `http(s)`/`mailto`/relative schemes). It keeps the bundle
small — no `javascript:`/`data:` links, no raw HTML passthrough.

Need full CommonMark/GFM? Swap in a specialized renderer via `renderMarkdown`.
Always pair the parser with a sanitizer — do not trust model output:

```ts
import { marked } from "marked"
import DOMPurify from "dompurify"

new Chat({
  endpoint,
  renderMarkdown: (text) => DOMPurify.sanitize(marked.parse(text) as string),
})
```

## Bring your own agent

```ts
import { Agent } from "@bump-sh/agent-client"
import { Chat } from "@bump-sh/agent-ui"

const agent = new Agent({ endpoint: "https://…/agent/chat", headers: { Authorization: "Bearer …" } })
new Chat({ agent })
```

## Theming

Set CSS custom properties — they pierce the Shadow DOM:

```css
agent-chat {
  --agent-accent: #e11d48;
  --agent-font: "Inter", sans-serif;
  --agent-radius: 12px;
  --agent-width: 360px; /* sidebar */
}
```

Tokens: `--agent-accent`, `--agent-bg`, `--agent-text`, `--agent-muted`,
`--agent-user-bg`, `--agent-border`, `--agent-code-bg`, `--agent-font`,
`--agent-radius`, `--agent-width`, `--agent-z`.

Style internal structure with `::part()`:

```css
agent-chat::part(send) { border-radius: 6px; }
agent-chat::part(message-user) { background: #eef; }
```

Parts: `launcher`, `panel`, `header`, `title`, `subtitle`, `close`, `thread`,
`message`, `message-user`, `message-assistant`, `avatar`, `composer`,
`input`, `send`, `status`, `disclaimer`.

Replace whole regions with slots: `title`, `empty`, `composer-actions`.

## License

MIT
