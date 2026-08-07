// Single source of truth for every configurable widget option. The form, the
// live preview, and the code generator are all driven by this list — adding an
// option here is all it takes to surface it everywhere.

export type Value = string | boolean

export interface OptionDef {
  /** State key. Dots nest in the generated options object ("theme.accent"). */
  key: string
  label: string
  input: "text" | "color" | "toggle" | "segmented"
  /** The widget's own default — the code panel only emits values that differ. */
  default: Value
  choices?: readonly string[]
  placeholder?: string
  /** Attribute name when the option is settable declaratively in HTML. */
  attribute?: string
  /** CSS custom property when the option is a theme token. */
  cssVar?: string
}

export interface Section {
  title: string
  /** Advanced sections render collapsed. */
  advanced?: boolean
  /** Connection details, not widget config — they survive resets. */
  keepOnReset?: boolean
  options: OptionDef[]
}

export const SECTIONS: Section[] = [
  {
    title: "Connection",
    keepOnReset: true,
    options: [
      {
        key: "endpoint",
        label: "Endpoint",
        input: "text",
        default: "",
        placeholder: "https://your-host/demo/weather/agent",
        attribute: "endpoint",
      },
      {
        key: "token",
        label: "Token",
        input: "text",
        default: "",
        placeholder: "Bearer token (optional)",
      },
    ],
  },
  {
    title: "Display",
    options: [
      {
        key: "mode",
        label: "Mode",
        input: "segmented",
        default: "modal",
        choices: ["modal", "sidebar", "inline"],
        attribute: "mode",
      },
      { key: "launcher", label: "Launcher button", input: "toggle", default: true },
    ],
  },
  {
    title: "Content",
    options: [
      {
        key: "title",
        label: "Title",
        input: "text",
        default: "Assistant",
        attribute: "title",
      },
      {
        key: "subtitle",
        label: "Subtitle",
        input: "text",
        default: "",
        placeholder: "AI Agent",
        attribute: "subtitle",
      },
      {
        key: "placeholder",
        label: "Placeholder",
        input: "text",
        default: "Ask anything…",
        attribute: "placeholder",
      },
      {
        key: "greeting",
        label: "Greeting",
        input: "text",
        default: "",
        placeholder: "Hi! How can I help?",
      },
      {
        key: "disclaimer",
        label: "Disclaimer",
        input: "text",
        default: "AI can make mistakes. Always review before you act.",
      },
    ],
  },
  {
    title: "Brand",
    options: [
      {
        key: "theme.accent",
        label: "Accent color",
        input: "color",
        default: "#0a0a0a",
        cssVar: "--agent-accent",
      },
      {
        key: "launcherIcon",
        label: "Launcher icon",
        input: "text",
        default: "",
        placeholder: "Image URL or emoji",
      },
      {
        key: "avatar",
        label: "Avatar",
        input: "text",
        default: "",
        placeholder: "Image URL or emoji",
      },
    ],
  },
  {
    title: "Theme tokens",
    advanced: true,
    options: [
      {
        key: "theme.buttonBg",
        label: "Buttons",
        input: "color",
        default: "",
        placeholder: "Accent color",
        cssVar: "--agent-button-bg",
      },
      {
        key: "theme.bg",
        label: "Background",
        input: "color",
        default: "#ffffff",
        cssVar: "--agent-bg",
      },
      {
        key: "theme.text",
        label: "Text",
        input: "color",
        default: "#0d0d0d",
        cssVar: "--agent-text",
      },
      {
        key: "theme.muted",
        label: "Muted text",
        input: "color",
        default: "#8a8a8f",
        cssVar: "--agent-muted",
      },
      {
        key: "theme.userBg",
        label: "User bubble",
        input: "color",
        default: "#f4f4f5",
        cssVar: "--agent-user-bg",
      },
      {
        key: "theme.border",
        label: "Borders",
        input: "color",
        default: "#ececee",
        cssVar: "--agent-border",
      },
      {
        key: "theme.codeBg",
        label: "Code background",
        input: "color",
        default: "#f4f4f6",
        cssVar: "--agent-code-bg",
      },
      {
        key: "theme.font",
        label: "Font family",
        input: "text",
        default: "",
        placeholder: "System sans stack",
        cssVar: "--agent-font",
      },
      {
        key: "theme.radius",
        label: "Corner radius",
        input: "text",
        default: "20px",
        cssVar: "--agent-radius",
      },
      {
        key: "theme.width",
        label: "Sidebar width",
        input: "text",
        default: "26vw",
        cssVar: "--agent-width",
      },
      {
        key: "theme.z",
        label: "Stacking order",
        input: "text",
        default: "2147483000",
        cssVar: "--agent-z",
      },
    ],
  },
  {
    title: "Localization",
    advanced: true,
    options: [
      { key: "labels.send", label: "Send", input: "text", default: "Send" },
      { key: "labels.close", label: "Close", input: "text", default: "Close" },
      { key: "labels.launch", label: "Launch", input: "text", default: "Open chat" },
      { key: "labels.today", label: "Date divider", input: "text", default: "Today" },
    ],
  },
]

export const OPTIONS: OptionDef[] = SECTIONS.flatMap((section) => section.options)
