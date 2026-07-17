# @bump-sh/agent-widget

Embeddable, themeable chat widget for Bump.sh agents. A Web Component you drop in
with 3 lines — fully isolated (Shadow DOM), fully customizable.

- **3-line path** — `new Widget({ endpoint })` and you have a chat box.
- **3 display modes** — `modal` (default), `sidebar`, `inline`.
- **Isolated** — Shadow DOM: the host page's CSS can't leak in, and vice versa.
- **Customizable** — CSS tokens, `::part()`, slots, and options.
- **BYO conversation** — pass your own
  [`@bump-sh/agent-conversation`](../agent-conversation) `Conversation`.

## Install

```sh
npm install @bump-sh/agent-widget
```

## Quickstart

```ts
import { Widget } from "@bump-sh/agent-widget"

new Widget({ endpoint: "https://your-host/demo/weather/agent" })
```

That mounts a floating launcher + modal. Or declaratively:

```html
<agent-widget endpoint="https://…/agent" mode="sidebar"></agent-widget>
<script type="module" src="https://unpkg.com/@bump-sh/agent-widget"></script>
```

## Local demo

Build a self-contained bundle and open the page — no server needed:

```sh
npm run example                 # writes examples/agent-widget.js
open examples/index.html        # set an endpoint, try the three modes
```

## Options

```ts
const widget = new Widget({
  endpoint,                         // OR conversation: myConversation  (bring your own)
  token,                            // auth: string | () => string | Promise<string>
  headers,                          // extra request headers (config, not auth)
  mode: "modal",                    // "modal" | "sidebar" | "inline"
  launcher: true,                   // floating launcher button (modal/sidebar); false to open it yourself
  target: "#app",                   // inline container; modal/sidebar → <body>
  open: false,                      // start opened
  theme: { accent: "#0a0a0a" },     // → CSS custom properties
  title: "Assistant",
  subtitle: "AI Agent",             // small line under the title
  placeholder: "Ask anything…",
  greeting: "Hi! How can I help?",  // optional first assistant message
  avatar: "https://…/logo.png",     // image URL or inline emoji/HTML
  disclaimer: "AI can make mistakes…", // footer under the composer ("" to hide)
  renderMarkdown: (text) => "…",    // replace the built-in safe renderer
})

widget.open(); widget.close(); widget.toggle(); widget.destroy()
widget.conversation // the underlying Conversation
```

### Authentication

Pass a `token` — it's sent to the endpoint as `Authorization: Bearer <token>`.
Use a callback for short-lived tokens; it's re-evaluated on every request, so
the token refreshes without remounting the widget:

```ts
new Widget({
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

new Widget({
  endpoint,
  renderMarkdown: (text) => DOMPurify.sanitize(marked.parse(text) as string),
})
```

## Bring your own conversation

```ts
import { Conversation } from "@bump-sh/agent-conversation"
import { Widget } from "@bump-sh/agent-widget"

const conversation = new Conversation({ endpoint: "https://…/agent", token: "…" })
new Widget({ conversation })
```

## Theming

Set CSS custom properties — they pierce the Shadow DOM:

```css
agent-widget {
  --agent-accent: #e11d48;
  --agent-font: "Inter", sans-serif;
  --agent-radius: 12px;
  --agent-width: 360px; /* sidebar */
}
```

Tokens: `--agent-accent`, `--agent-bg`, `--agent-text`, `--agent-muted`,
`--agent-user-bg`, `--agent-input-bg`, `--agent-border`, `--agent-code-bg`,
`--agent-font`, `--agent-mono`, `--agent-radius`, `--agent-width`, `--agent-z`.

Style internal structure with `::part()`:

```css
agent-widget::part(send) { border-radius: 6px; }
agent-widget::part(message-user) { background: #eef; }
```

Parts: `launcher`, `panel`, `header`, `title`, `subtitle`, `close`, `thread`,
`message`, `message-user`, `message-assistant`, `avatar`, `composer`,
`input`, `send`, `status`, `disclaimer`.

Replace whole regions with slots: `title`, `empty`, `composer-actions`.

## License

MIT
