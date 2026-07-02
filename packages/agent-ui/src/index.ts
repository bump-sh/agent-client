import { defineAgentChat } from "./element.js"

export { Chat } from "./chat.js"
export { AgentChat, defineAgentChat } from "./element.js"
export { renderMarkdown } from "./markdown.js"
export type { AgentLike, ChatOptions, Labels, Mode, Theme } from "./types.js"

// Auto-register <agent-chat> so the declarative usage works on script load.
defineAgentChat()
