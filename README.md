# @bump-sh/agent-client

Tiny, dependency-free client for streaming conversations with an
[Bump.sh](https://bump.sh) agent endpoint. Drop it into any web app to let your
users chat with an agent scoped to your MCP server.

- **Zero dependencies** — uses native `fetch` / `ReadableStream`.
- **Stateful** — keeps the conversation history for you.
- **Two styles, one call** — `await` the reply, or `for await` the stream.
- **TypeScript** — fully typed events.

## Install

```sh
npm install @bump-sh/agent-client
```

## Quickstart (the 5-minute path)

```ts
import { Agent } from "@bump-sh/agent-client"

const agent = new Agent("https://your-host/demo/weather/agent/chat")

agent.on("text", (delta) => {
  document.querySelector("#reply").textContent += delta
})

await agent.send("What's the weather in Paris?")
```

`send()` resolves to the full assistant reply, so you can also just:

```ts
const reply = await agent.send("What's the weather in Paris?")
console.log(reply)
```

## Streaming every event (the control path)

Same call — iterate it instead of awaiting:

```ts
for await (const event of agent.send("What's the weather in Paris?")) {
  if (event.type === "text") append(event.delta)
  if (event.type === "tool") showToolActivity(event.names)
  if (event.type === "error") showError(event.error)
}
```

## API

### `new Agent(endpoint, options?)`

| option     | type                       | description                                        |
| ---------- | -------------------------- | -------------------------------------------------- |
| `headers`  | `Record<string, string>`   | Extra request headers (e.g. `Authorization`).      |
| `fetch`    | `typeof fetch`             | Custom fetch (SSR, testing). Defaults to `fetch`.  |
| `messages` | `Message[]`                | Seed the conversation history.                     |

### `agent.send(content, { signal? })`

Sends a user turn and streams the reply. Returns a `StreamResult` that is both:

- **awaitable** → resolves to the assistant reply (rejects on error), and
- **async-iterable** → yields `AgentEvent`s.

### `agent.on(event, handler)`

Subscribe to `"text"`, `"tool"`, `"message"`, `"error"`, or `"done"`. Returns an
unsubscribe function.

```ts
const off = agent.on("tool", (names) => console.log("running", names))
off() // stop listening
```

### `agent.messages` / `agent.reset()`

Read the history, or clear it to start a fresh conversation.

## Events

```ts
type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; names: string[] }
  | { type: "error"; error: Error }
```

## Wire protocol

The client speaks the Bump.sh agent protocol: it `POST`s
`{ "messages": [{ "role", "content" }] }` as JSON and reads an
`application/x-ndjson` response, one JSON event per line
(`text` / `tool` / `error` / `done`).

## License

MIT
