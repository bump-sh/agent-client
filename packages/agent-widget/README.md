# @bump-sh/agent-widget

Embeddable, themeable chat widget for [Bump.sh](https://bump.sh) agents. A Web
Component you drop in with 3 lines — fully isolated (Shadow DOM), fully
customizable.

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

Requires a modern browser with Web Components and native `<dialog>` support
(all evergreen browsers). The only dependency is
[`@bump-sh/agent-conversation`](../agent-conversation).

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

Importing the package auto-registers the `<agent-widget>` element.

## Playground

Explore every option interactively — live preview plus the code to copy — with
the [playground](../agent-playground):

```sh
npm run playground              # from the repo root
```

## Options

```ts
const widget = new Widget({
  endpoint,                         // OR conversation: myConversation  (bring your own)
  token,                            // auth: string | () => string | Promise<string>
  config,                           // agent config → Config-<Key> headers (map or per-request callback)
  headers,                          // extra request headers (map or per-request callback)
  mode: "modal",                    // "modal" | "sidebar" | "inline"
  launcher: true,                   // floating launcher button (modal/sidebar); false to open it yourself
  target: "#app",                   // inline container (selector or element); modal/sidebar → <body>
  open: false,                      // start opened (inline is always open)
  theme: { accent: "#0a0a0a" },     // → CSS custom properties, see Theming
  title: "Assistant",
  subtitle: "AI Agent",             // small line under the title
  placeholder: "Ask anything…",
  greeting: "Hi! How can I help?",  // optional first assistant message (visual only, not sent to the agent)
  avatar: "https://…/logo.png",     // image URL or inline emoji/HTML
  launcherIcon: "✨",               // launcher button icon: image URL or inline emoji/HTML
                                    // (defaults to an AI sparkle)
  disclaimer: "AI can make mistakes…", // footer under the composer ("" to hide)
  labels: { send: "Send", close: "Close", launch: "Open chat", today: "Today" },
                                    // a11y labels + the date divider — override to localize
  renderMarkdown: (text) => "…",    // replace the built-in safe renderer
})
```

The instance is the handle:

```ts
widget.open(); widget.close(); widget.toggle()
widget.destroy()      // remove the element from the page
widget.conversation   // the underlying Conversation (history, events, reset)
widget.element        // the <agent-widget> DOM element
```

### HTML attributes

For declarative use, these attributes are observed and reactive — change one
and the widget updates:

| attribute     | maps to        | notes                                          |
| ------------- | -------------- | ---------------------------------------------- |
| `endpoint`    | `endpoint`     | Changing it resets the built-in conversation.  |
| `mode`        | `mode`         | `modal` \| `sidebar` \| `inline`.              |
| `open`        | `open()`/`close()` | Present = open. Toggle it to drive the panel. |
| `title`       | `title`        |                                                |
| `subtitle`    | `subtitle`     |                                                |
| `placeholder` | `placeholder`  | Also the empty-state hint.                     |

Everything else (`token`, `config`, `theme`, callbacks…) is JS-only: pass it
to `new Widget(options)`, or call `element.configure(options)` before
attaching a hand-created element.

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
never expose a raw or tenant-wide API key. In your workflow file, the token is
available as `$current_user.token`.

### Agent configuration & custom headers

`config` keys are sent as `Config-<Key>` request headers and are available in
your workflow file as `$config.<key>` (`config: { locale: "fr" }` →
`$config.locale`); `headers` adds any other header. Key matching is
case-insensitive and treats `-` and `_` as equivalent — prefer dash-separated
keys. Both accept a map, or a callback re-evaluated on every request:

```ts
new Widget({
  endpoint,
  config: { locale: "fr" },
  headers: () => ({ "X-Request-Id": crypto.randomUUID() }),
})
```

### Markdown rendering

The built-in renderer is intentionally tiny and dependency-free: it escapes all
HTML first, then re-introduces a fixed, safe subset — bold, italic, inline code,
code blocks, headings, lists, blockquotes, tables, horizontal rules, and links
restricted to `http(s)`/`mailto`/relative schemes. It keeps the bundle small —
no `javascript:`/`data:` links, no raw HTML passthrough.

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

Build the `Conversation` yourself when you need direct access to it — history,
`on()` events, `reset()` — or to share it with other parts of your app:

```ts
import { Conversation } from "@bump-sh/agent-conversation"
import { Widget } from "@bump-sh/agent-widget"

const conversation = new Conversation({ endpoint: "https://…/agent", token: "…" })
new Widget({ conversation })
```

Anything with a `send(content): AsyncIterable<AgentEvent>` works
(`ConversationLike`), so you can also wrap or mock it.

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

| token                 | default                 | what it styles                          |
| --------------------- | ----------------------- | --------------------------------------- |
| `--agent-accent`      | `#0a0a0a`               | Accents: links, and buttons by default  |
| `--agent-button-bg`   | `var(--agent-accent)`   | Launcher & send button — override to decouple them from the accent |
| `--agent-button-fg`   | `#fff`                  | Launcher & send button icon             |
| `--agent-bg`          | `#ffffff`               | Panel background                        |
| `--agent-text`        | `#0d0d0d`               | Text                                    |
| `--agent-muted`       | `#8a8a8f`               | Secondary text (subtitle, status…)      |
| `--agent-user-bg`     | `#f4f4f5`               | User message bubble                     |
| `--agent-input-bg`    | `#f7f7f8`               | Composer input                          |
| `--agent-border`      | `#ececee`               | Borders                                 |
| `--agent-code-bg`     | `#f4f4f6`               | Code blocks & table headers             |
| `--agent-avatar-bg`   | `var(--agent-user-bg)`  | Avatar background                       |
| `--agent-avatar-size` | `28px`                  | Avatar box                              |
| `--agent-font`        | system sans stack       | Font family                             |
| `--agent-mono`        | system mono stack       | Code font family                        |
| `--agent-radius`      | `20px`                  | Corner radius (user bubble, composer, modal panel) |
| `--agent-width`       | `26vw`                  | Sidebar width                           |
| `--agent-gutter`      | `18px`                  | Horizontal padding                      |
| `--agent-column`      | `760px`                 | Max conversation width (inline)         |
| `--agent-z`           | `2147483000`            | Stacking order                          |

The `theme` option is a JS shortcut for the most common ones — `accent`,
`buttonBg`, `buttonFg`, `bg`, `text`, `muted`, `userBg`, `inputBg`, `border`,
`codeBg`, `font`, `radius`, `width`, `z` — set the rest directly in CSS as
above.

Style internal structure with `::part()`:

```css
agent-widget::part(send) { border-radius: 6px; }
agent-widget::part(message-user) { background: #eef; }
```

Parts: `launcher`, `panel`, `header`, `title`, `subtitle`, `close`, `thread`,
`message`, `message-user`, `message-assistant`, `avatar`, `composer`,
`input`, `send`, `status`, `disclaimer`.

Replace whole regions with slots: `title`, `empty` (empty-thread state),
`composer-actions` (left of the send button).

```html
<agent-widget endpoint="https://…/agent">
  <span slot="title">Ask our docs</span>
</agent-widget>
```

## Interaction & accessibility

- **Enter** sends, **Shift+Enter** inserts a newline.
- Modal and sidebar are native `<dialog>`s shown top-layer: **Escape** closes,
  focus is trapped, and clicking the backdrop dismisses.
- Launcher, close, and send buttons carry `aria-label`s — localize them via
  `labels`.
- While a reply streams, sending is disabled and a status line shows the
  tools the agent is running.

## Exports

- `Widget` — the one-line façade (create, mount, handle).
- `AgentWidget` — the custom element class, for hand-rolled setups.
- `defineAgentWidget(tag?)` — register the element, optionally under a custom
  tag name (idempotent; called automatically on import).
- `renderMarkdown` — the built-in safe renderer, reusable on its own.
- Types: `WidgetOptions`, `ConversationLike`, `Labels`, `Mode`, `Theme`.

## License

MIT
