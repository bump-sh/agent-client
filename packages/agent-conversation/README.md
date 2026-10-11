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
  if (event.type === "tool") showToolActivity(event.name)
  if (event.type === "error") showError(event.error)
}
```

```ts
type AgentEvent =
  | { type: "text"; delta: string }  // a chunk of the assistant reply
  | { type: "tool"; name: string }   // the agent started running this tool
  | { type: "confirmation"; confirmation: ToolConfirmation } // see Frontend tools
  | { type: "error"; error: Error }  // the turn failed (network or agent error)
```

When the agent speaks again after running tools, a `"\n\n"` delta opens the
new paragraph: concatenating every delta gives the same reply `await` resolves to.

## Frontend tools

Let the agent act on your page by defining `frontendTools`. Those are
javascript functions of your page the agent may call, offered to it on
every run right next to its server tools.

```ts
const conversation = new Conversation({
  endpoint,
  frontendTools: [
    {
      name: "get_selection",
      description: "Get the rows the user selected in the table",
      execute: () => table.selectedRows(),
    },
    {
      name: "apply_search",
      description: "Show the results of a product search on the page",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
      execute: ({ query }) => applySearch(query),
      confirm: "Search “{args.query}”",
    },
  ],
})

// or later, for a part of the page that comes and goes:
conversation.addFrontendTool(tool)
conversation.removeFrontendTool("apply_search")
```

### Defining a Frontend Tool

| property      | type                           | description                                                                                                                                                                                                                                                             |
|---------------|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `name`        | `string` (required)            | Letters, digits, `_` or `-` (64 characters at most). It must differ from the agent's server tools names: the agent refuses the run otherwise. A frontend tool name should never be set in `allowedTools`, which is used to limit the **server tools** only.             |
| `description` | `string` (required)            | What the tool does and when to use it: the agent decides from this text.                                                                                                                                                                                                |
| `execute`     | `function` (required)          | The javascript code you want to run when this tool is called                                                                                                                                                                                                            |
| `parameters`  | `object`                       | A JSON schema describing the input arguments of the `execute` function. The arguments passed to the `execute` function are validated with this schema before called by the agent.                                                                                       |
| `confirm`     | `string` \| `(args) => string` | Define a confirmation label if you need the call to be confirmed by the user before it executes. Either a fixed string, or a template accepting `{args.x}` syntax to read arguments values passed to the execute function, or a javascript function `(args) => string`. |

Use the tool `name` value if you need to remove it from an existing conversation.

The `execute` function's return value is what the agent reads:
- `undefined` will read as `"Done."`
- a string text is returned as is
- anything else is stringified as JSON

If the function throws an error it is reported to the agent, which tells
the user.

An optional `parameters` should be defined (as a JSON schema) if the `execute` function takes arguments.

An optional `confirm` label can be set if the frontend tool should be confirmed by the user.

A frontend tool then executes either:
- **Right away** (no `confirm`): it executes as soon as the agent calls it, and
  the agent goes on with its result — within the same `send()`, as one reply.
- **Once confirmed** (with `confirm`, the label of the button): the
  confirmation yields a `{ type: "confirmation", confirmation }`
  event. Where `confirmation` has a `label` to render as a button; and
  an `accept()` method which executes the tool and records its result,
  without calling the agent again — it reads the result on the next
  message. The next `send()` dismisses a confirmation left pending,
  and waits for a confirmed tool still executing. `accept()` rejects
  when the tool throws, or when it does not run: accepted already,
  dismissed, or the tool removed.

### Rules

- A reply chains at most 10 runs on frontend tools, then fails: a
  model calling them in a loop cannot spend requests forever. When a
  run fails, the tools executed by the runs before it stay recorded,
  so the agent does not run them twice.

- Tools are declared to the agent on each run, so adding or removing
  one applies from the next run. A call to a removed tool, or a
  pending confirmation of it, is answered as unavailable.

- For a tool to be confirmed, the conversation adds how confirmations
  behave, so the agent calls the tool to offer the confirmation action
  to the user instead of asking first.

## API

### `new Conversation(options)`

| option          | type                                        | description                                                                                                           |
|-----------------|---------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `endpoint`      | `string` (required)                         | The agent endpoint URL to POST to.                                                                                    |
| `token`         | `string \| () => string \| Promise<string>` | Bearer token → `Authorization`. A callback is re-evaluated per request, so short-lived tokens refresh.                |
| `config`        | `Record<string, string>` or a callback      | Agent configuration keys, sent as `Config-<Key>` request headers.                                                     |
| `headers`       | `Record<string, string>` or a callback      | Extra request headers, merged last.                                                                                   |
| `allowedTools`  | `string[]`                                  | Focus the agent on a specific set of tools, sent as `forwardedProps.allowedTools`. Left out, every tool is available. |
| `frontendTools` | `FrontendTool[]`                            | Tools of your page the agent may call. See [Frontend tools](#frontend-tools).                                         |
| `agentContext`  | `Record<string, string>`                    | Define application context for the agent to know where it lives. Optional list of key-value pairs.                    |
| `fetch`         | `typeof fetch`                              | Custom fetch (SSR, testing). Defaults to `fetch`.                                                                     |
| `messages`      | `SeedMessage[]`                             | Seed the conversation history (`{ role: "user" \| "assistant", content: string }`).                                   |

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
| `"tool"`    | `name: string`     | When the agent starts running a tool.                        |
| `"confirmation"` | `confirmation: ToolConfirmation` | When a frontend tool call waits for the user to confirm it. |
| `"error"`   | `error: Error`     | On a network or agent error.                                 |
| `"message"` | `content: string`  | When a turn ends, with the full assistant reply (`""` if the turn failed before any text). |
| `"done"`    | —                  | When a turn ends, success or failure.                        |

```ts
const off = conversation.on("tool", (name) => console.log("running", name))
off() // stop listening
```

### `conversation.addFrontendTool(tool)` / `conversation.removeFrontendTool(name)`

Lets the agent call a tool of the page from its next run on, or stops it. See
[Frontend tools](#frontend-tools).

### `conversation.messages` / `conversation.reset()`

`messages` is a read-only snapshot of the history, in the AG-UI shape sent to
the agent: user, assistant (with their `toolCalls`) and tool messages, each
with an `id`. The user turn is recorded as soon as you call `send()`, the
assistant turn as it streams. `reset()` clears the history to start fresh.

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

A failed turn (non-2xx response, network failure, agent error, stream cut
before `RUN_FINISHED`, abort) surfaces three ways — pick the one matching how
you consume the stream:

- `await conversation.send(…)` **rejects** with the `Error`;
- iterating yields an `{ type: "error", error }` event and the stream ends;
- `on("error", handler)` fires.

A failed turn leaves nothing but the user message in `conversation.messages`:
a reply cut short (a tool call without its result) is one the agent would
refuse on the next turn.

## Wire protocol

The client speaks [AG-UI](https://docs.ag-ui.com): each `send()` is one run.
It `POST`s a [`RunAgentInput`](https://docs.ag-ui.com/sdk/js/core/types#runagentinput)
as JSON — `threadId`, `runId`, the full
`messages` history, the frontend `tools` and `forwardedProps.allowedTools` — and reads a
`text/event-stream` response, one JSON event per `data:` frame:

```
RUN_STARTED → TEXT_MESSAGE_START / CONTENT / END → TOOL_CALL_START / ARGS / END
→ TOOL_CALL_RESULT → RUN_FINISHED | RUN_ERROR
```

The agent runs its server tools itself and reports them as they go. A frontend
tool call ends the run without a result: the client answers it with a tool
message in the next run. Any AG-UI client
(CopilotKit, assistant-ui…) can talk to the same endpoint.

## Exports

`Conversation`, `StreamResult`, `resolveLabel`, and the types `AgentEvent`, `AgentContext`,
`ButtonLabel`, `ConversationOptions`, `FrontendTool`, `HeadersProvider`,
`Message`, `Role`, `RunAgentInput`, `SeedMessage`, `SendOptions`,
`TokenProvider`, `ToolArgs`, `ToolCall`, `ToolConfirmation`. ESM and CJS builds are shipped.

## License

MIT
