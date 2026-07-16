# @bump-sh/agent-ui

Embeddable, themeable chat widget for Bump.sh agents. A Web Component you drop in
with 3 lines — fully isolated (Shadow DOM), fully customizable.

- **3-line path** — `new Chat({ endpoint })` and you have a chat box.
- **3 display modes** — `modal` (default), `sidebar`, `inline`.
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

new Chat({ endpoint: "https://your-host/demo/weather/agent" })
```

That mounts a floating launcher + modal. Or declaratively:

```html
<agent-chat endpoint="https://…/agent" mode="sidebar"></agent-chat>
<script type="module" src="https://unpkg.com/@bump-sh/agent-ui"></script>
```

## Local demo

Build a self-contained bundle and open the page — no server needed:

```sh
npm run example                 # writes examples/agent-ui.js
open examples/index.html        # set an endpoint, try the three modes
```

## Options

```ts
const chat = new Chat({
  endpoint,                         // OR agent: myAgent  (bring your own)
  token,                            // auth: string | () => string | Promise<string>
  headers,                          // extra request headers (config, not auth)
  mode: "modal",                    // "modal" | "sidebar" | "inline"
  target: "#app",                   // inline container; modal/sidebar → <body>
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

### Authentication

Pass a `token` — it's sent to the endpoint as `Authorization: Bearer <token>`.
Use a callback for short-lived tokens; it's re-evaluated on every request, so
the token refreshes without remounting the widget:

```ts
new Chat({
  endpoint,
  token: async () => (await fetch("/agent-token")).text(),
})
```

The token lives in the browser, so **mint a user-scoped, short-lived token
server-side** — where the page already knows who the logged-in user is — and
never expose a raw or tenant-wide API key. `headers` is only for non-auth
config the endpoint expects.

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

const agent = new Agent({ endpoint: "https://…/agent", token: "…" })
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
`--agent-user-bg`, `--agent-input-bg`, `--agent-border`, `--agent-code-bg`,
`--agent-font`, `--agent-radius`, `--agent-width`, `--agent-z`.

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
