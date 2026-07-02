# agent-client

Open-source JavaScript SDK for embedding [Bump.sh](https://bump.sh) agents into any
web app. An npm workspaces monorepo.

## Packages

| Package | What it does |
| ------- | ------------ |
| [`@bump-sh/agent-client`](packages/agent-client) | Tiny, dependency-free conversation client: streams a chat with an agent endpoint over NDJSON. |
| [`@bump-sh/agent-ui`](packages/agent-ui) | Embeddable, themeable chat widget (Web Component) built on `agent-client`. |

```ts
import { Agent } from "@bump-sh/agent-client"
import { Chat }  from "@bump-sh/agent-ui"

const agent = new Agent({ endpoint: "https://…/agent/chat" })  // conversation only
new Chat({ endpoint: "https://…/agent/chat" })                 // full chat widget
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
