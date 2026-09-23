# @bump-sh/agent-conversation

Tiny, dependency-free client for streaming a conversation with a
[Bump.sh](https://bump.sh) agent API endpoint. Drop it into any web app to let
your users chat with an agent scoped to your Bump.sh MCP server.

- **Zero dependencies** — uses native `fetch` / `ReadableStream`.
- **Stateful** — keeps the message history for you.
- **Two styles, one call** — `await` the reply, or `for await` the stream.
- **TypeScript** — fully typed events.

Building a chat UI? [`@bump-sh/agent-widget`](../agent-widget) is a drop-in
widget built on this package.

## Install

```sh
npm install @bump-sh/agent-conversation
```

Requires a runtime with native `fetch` and `ReadableStream`: any modern
browser, or Node.js ≥ 18.

## Quickstart (the 5-minute path)

```ts
import { Conversation } from "@bump-sh/agent-conversation"

const conversation = new Conversation({
  endpoint: "https://your-host/demo/weather/agent",
})

conversation.on("text", (delta) => {
  document.querySelector("#reply").textContent += delta
})

await conversation.send("What's the weather in Paris?")
```

`send()` resolves to the full assistant reply, so you can also just:

```ts
const reply = await conversation.send("What's the weather in Paris?")
console.log(reply)
```

## Streaming every event (the control path)

Same call — iterate it instead of awaiting:

```ts
for await (const event of conversation.send("What's the weather in Paris?")) {
  if (event.type === "text") append(event.delta)
  if (event.type === "tool") showToolActivity(event.names)
  if (event.type === "error") showError(event.error)
}
```

```ts
type AgentEvent =
  | { type: "text"; delta: string }   // a chunk of the assistant reply
  | { type: "tool"; names: string[] } // the agent started running these tools
  | { type: "error"; error: Error }   // the turn failed (network or agent error)
```

## API

### `new Conversation(options)`

| option     | type                                          | description                                                        |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `endpoint` | `string` (required)                           | The agent endpoint URL to POST to.                                 |
| `token`    | `string \| () => string \| Promise<string>`   | Bearer token → `Authorization`. A callback is re-evaluated per request, so short-lived tokens refresh. |
| `config`   | `Record<string, string>` or a callback        | Agent configuration keys, sent as `Config-<Key>` request headers.  |
| `headers`  | `Record<string, string>` or a callback        | Extra request headers, merged last.                                |
| `allowedTools` | `string[]`                                | Focus the agent on a specific set of tools, sent as `allowed_tools` in the request body. Defaults to `[]` (no restriction). |
| `fetch`    | `typeof fetch`                                | Custom fetch (SSR, testing). Defaults to `fetch`.                  |
| `messages` | `Message[]`                                   | Seed the conversation history (`{ role: "user" \| "assistant", content: string }`). |

### `conversation.send(content, { signal? })`

Sends a user turn and streams the reply. Returns a `StreamResult` that is both:

- **awaitable** → resolves to the assembled assistant reply, rejects on error;
- **async-iterable** → yields `AgentEvent`s. Iteration never throws — errors
  arrive as `{ type: "error" }` events, so your loop always runs to completion.

Two things to know about the `StreamResult`:

- **The request is lazy.** Nothing is sent over the network until you `await`
  the result or start iterating it. A bare `conversation.send("hi")` with the
  result discarded sends nothing.
- **Consume it once, either way.** It wraps a single underlying stream:
  awaiting *and* iterating (or iterating twice) drains it once — the second
  consumer sees an empty stream. To both render deltas and get the full
  reply, iterate and accumulate, or combine `on("text", …)` with `await`.

Pass an `AbortSignal` to cancel a turn in flight:

```ts
const controller = new AbortController()
const result = conversation.send("Summarize this very long document…", {
  signal: controller.signal,
})
controller.abort() // surfaces as an "error" event / rejection
```

### `conversation.on(event, handler)`

Subscribe to stream events across all turns — the callback style, equivalent
to iterating. Returns an unsubscribe function.

| event       | handler payload    | fires                                                        |
| ----------- | ------------------ | ------------------------------------------------------------ |
| `"text"`    | `delta: string`    | For each chunk of the assistant reply.                       |
| `"tool"`    | `names: string[]`  | When the agent starts running tools.                         |
| `"error"`   | `error: Error`     | On a network or agent error.                                 |
| `"message"` | `content: string`  | When a turn ends, with the full assistant reply (`""` if the turn failed before any text). |
| `"done"`    | —                  | When a turn ends, success or failure.                        |

```ts
const off = conversation.on("tool", (names) => console.log("running", names))
off() // stop listening
```

### `conversation.messages` / `conversation.reset()`

`messages` is a read-only snapshot of the history (user and assistant turns) —
the user turn is recorded as soon as you call `send()`, the assistant turn when
its reply finishes. `reset()` clears the history to start fresh.

## Authentication

Pass a `token` — it's sent as `Authorization: Bearer <token>`:

```ts
// short-lived token, refreshed transparently on every turn
new Conversation({
  endpoint,
  token: async () => (await fetch("/agent-token")).text(),
})
```

The token travels in the browser, so **mint a user-scoped, short-lived token
server-side** (a signed JWT your API verifies is ideal) — never ship a raw or
tenant-wide API key to the page. In your workflow file, the token is available
as `$current_user.token`.

## Configuration & custom headers

Pass `config` to configure the agent: each key is sent as a `Config-<Key>`
request header and is available in your workflow file as `$config.<key>`
(`config: { locale: "fr" }` → `$config.locale`). Use `headers` for any other
extra header. Both take a map, or a callback re-evaluated on every request
for values that change over time:

```ts
new Conversation({
  endpoint,
  config: { locale: "fr" },
  headers: () => ({ "X-Request-Id": crypto.randomUUID() }),
})
```

Key matching is case-insensitive and treats `-` and `_` as equivalent:
`config: { "doc-id": "42" }` can be read as `$config.doc_id`. Prefer
dash-separated keys — some proxies drop headers with underscores.

Values travel as raw HTTP header values, so keep them ASCII (identifiers,
locales, URLs) — encode anything richer yourself.

## Error handling

A failed turn (non-2xx response, network failure, agent error, abort)
surfaces three ways — pick the one matching how you consume the stream:

- `await conversation.send(…)` **rejects** with the `Error`;
- iterating yields an `{ type: "error", error }` event and the stream ends;
- `on("error", handler)` fires.

Any text streamed before the failure is kept in `conversation.messages`, so
the history stays consistent with what the user saw.

## Wire protocol

The client speaks the Bump.sh agent API protocol: it `POST`s
`{ "messages": [{ "role", "content" }] }` as JSON — the full history, every
turn — and reads an `application/x-ndjson` response, one JSON event per line:

```
{ "type": "text",  "content": "It's sunny" }
{ "type": "tool",  "names": ["get_weather"] }
{ "type": "error", "content": "…" }
{ "type": "done" }
```

## Exports

`Conversation`, `StreamResult`, and the types `AgentEvent`,
`ConversationOptions`, `HeadersProvider`, `Message`, `Role`, `SendOptions`,
`TokenProvider`. ESM and CJS builds are shipped.

## License

MIT
