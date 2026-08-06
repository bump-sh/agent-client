# agent-client

Open-source JavaScript SDK for embedding [Bump.sh](https://bump.sh) agents into any
web app — from a headless streaming client up to a drop-in chat widget. An npm
workspaces monorepo with two layers you can use together or on their own.

## Packages

| Package | What it does |
| ------- | ------------ |
| [`@bump-sh/agent-conversation`](packages/agent-conversation) | Tiny, dependency-free client: streams a stateful conversation with an agent endpoint over NDJSON. The logic, no UI. |
| [`@bump-sh/agent-widget`](packages/agent-widget) | Embeddable, themeable chat widget (Web Component) built on `agent-conversation`. The UI. |

Two layers, one mental model: a **`Conversation`** talks to the agent and holds the
message history; a **`Widget`** mounts a chat surface on the page and drives a
conversation for you. Use the widget for the 5-minute path, or the conversation
alone to build your own UI.

## Drop-in widget

```ts
import { Widget } from "@bump-sh/agent-widget"

new Widget({ endpoint: "https://your-host/demo/weather/agent" })
```

Mounts a floating launcher + modal. Three display modes — `modal` (default),
`sidebar`, `inline` — plus CSS-token theming, `::part()` and slots. See the
[widget README](packages/agent-widget).

## Headless conversation

```ts
import { Conversation } from "@bump-sh/agent-conversation"

const conversation = new Conversation({ endpoint: "https://…/agent" })

// await the full reply…
const reply = await conversation.send("What's the weather in Paris?")

// …or stream every event
for await (const event of conversation.send("And in Lyon?")) {
  if (event.type === "text") append(event.delta)
}
```

The widget is built on this — bring your own conversation when you need to:

```ts
import { Conversation } from "@bump-sh/agent-conversation"
import { Widget } from "@bump-sh/agent-widget"

new Widget({ conversation: new Conversation({ endpoint, token }) })
```

## Authentication

Pass a `token` (string, or a callback re-evaluated per request for short-lived
tokens); it's sent as `Authorization: Bearer <token>`. Mint a user-scoped,
short-lived token server-side — never ship a raw or tenant-wide key to the
browser. Both packages accept it, and the token is available in your workflow
file as `$current_user.token`.

## Agent configuration & custom headers

Pass `config` to configure the agent — each key is sent as a `Config-<Key>`
request header and is available in your workflow file as `$config.<key>` —
and `headers` for any other custom header. Both packages accept a map, or a
callback re-evaluated on every request.

## Local demo

No server needed — build the widget bundle and open the page:

```sh
npm install
npm run example -w @bump-sh/agent-widget   # writes examples/agent-widget.js
open packages/agent-widget/examples/index.html
```

## Develop

```sh
npm install            # links the workspaces
npm test               # test every package
npm run build          # build every package
npm run check          # lint + format check (Biome)
```

## License

MIT
