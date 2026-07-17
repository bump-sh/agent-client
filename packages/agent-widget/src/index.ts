import { defineAgentWidget } from "./element.js"

export { Widget } from "./widget.js"
export { AgentWidget, defineAgentWidget } from "./element.js"
export { renderMarkdown } from "./markdown.js"
export type { ConversationLike, WidgetOptions, Labels, Mode, Theme } from "./types.js"

// Auto-register <agent-widget> so the declarative usage works on script load.
defineAgentWidget()
