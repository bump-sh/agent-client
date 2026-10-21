// Shadow-DOM CSS. Light, modern, sober defaults. Themeable via --agent-* tokens.
export const css = `
:host {
  --agent-accent: #0a0a0a;
  --agent-bg: #ffffff;
  --agent-text: #0d0d0d;
  --agent-muted: #8a8a8f;
  --agent-user-bg: #f4f4f5;
  --agent-border: #ececee;
  --agent-code-bg: #f4f4f6;
  --agent-code-block-bg: #16171d;
  --agent-code-block-text: #e4e4e7;
  --agent-avatar-bg: var(--agent-user-bg);
  --agent-button-bg: var(--agent-accent);
  --agent-button-fg: #fff;
  --agent-input-bg: #f7f7f8;
  --agent-radius: 20px;
  --agent-font: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --agent-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --agent-width: 26vw;
  --agent-z: 2147483000;

  /* Layout scale — one source of truth, no per-element pixel nudging. */
  --agent-gutter: 18px;       /* horizontal padding of header, thread, composer */
  --agent-avatar-size: 28px;  /* avatar box; assistant rows align against it */
  --agent-action-height: 36px; /* action buttons under a reply */
  --agent-column: 760px;      /* readable conversation width in inline */

  font-family: var(--agent-font);
  color: var(--agent-text);
  font-size: 16px;
  line-height: 1.6;
}
:host, :host * { box-sizing: border-box; }

/* ---- launcher (modal & sidebar) ---- */
.launcher {
  position: fixed; right: 22px; bottom: 22px; z-index: var(--agent-z);
  width: 56px; height: 56px; border: 0; border-radius: 50%; cursor: pointer;
  background: var(--agent-button-bg); color: var(--agent-button-fg);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; overflow: hidden;
  box-shadow: 0 6px 24px rgba(0, 0, 0, .18);
  transition: transform .15s ease;
}
.launcher:hover { transform: translateY(-2px); }
.launcher svg { width: 26px; height: 26px; }
.launcher img { width: 100%; height: 100%; object-fit: cover; }
:host([mode="inline"]) .launcher { display: none; }
:host([open]) .launcher { display: none; }

/* ---- panel ---- */
.panel {
  display: none; flex-direction: column; background: var(--agent-bg);
  border: 0; padding: 0; color: var(--agent-text); overflow: hidden;
}
:host([open]) .panel { display: flex; }

/* Fill the host element (which fills whatever container it is placed in). */
:host([mode="inline"]) { display: block; width: 100%; height: 100%; }
:host([mode="inline"]) .panel { width: 100%; height: 100%; }
/* Center the conversation in a readable column on wide screens. */
:host([mode="inline"]) .header,
:host([mode="inline"]) .thread,
:host([mode="inline"]) .suggestions,
:host([mode="inline"]) .composer {
  padding-inline: max(var(--agent-gutter), calc((100% - var(--agent-column)) / 2));
}

/* modal & sidebar are top-layer <dialog>s (native Escape + click-outside). */
dialog.panel { border: 0; padding: 0; max-width: none; max-height: none; z-index: var(--agent-z); }
dialog.panel:not([open]) { display: none; }
dialog.panel[open] { display: flex; }
dialog.panel::backdrop { background: transparent; }

:host([mode="modal"]) .panel {
  margin: auto; width: min(94vw, 600px); height: min(88dvh, 760px);
  border-radius: var(--agent-radius); box-shadow: 0 24px 70px rgba(0, 0, 0, .30);
}
:host([mode="modal"]) .panel::backdrop { background: rgba(20, 20, 22, .40); }

:host([mode="sidebar"]) .panel {
  inset: 0 0 0 auto; margin: 0; height: 100dvh;
  width: min(94vw, max(400px, var(--agent-width)));
  box-shadow: -8px 0 30px rgba(0, 0, 0, .12);
  border-left: 1px solid var(--agent-border);
}

/* ---- header ---- */
.header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px var(--agent-gutter); flex: none;
}
.heading { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.title { font-weight: 600; font-size: 1.05em; letter-spacing: -.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.subtitle { font-size: .82em; color: var(--agent-muted); }
.spacer { flex: 1; }
.close {
  border: 0; background: none; cursor: pointer; color: var(--agent-muted);
  width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center;
}
.close:hover { background: var(--agent-user-bg); color: var(--agent-text); }
.close svg { width: 20px; height: 20px; }
:host([mode="inline"]) .close { display: none; }

/* ---- thread ---- */
.thread { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 8px var(--agent-gutter) 20px;
  scrollbar-width: thin; scrollbar-color: var(--agent-border) transparent; }
.thread.empty { display: flex; align-items: center; justify-content: center; padding-bottom: 80px; }
.thread:not(.empty) slot[name="empty"] { display: none; }
.empty-hint { color: var(--agent-muted); }

.divider { text-align: center; margin: 8px 0 18px; }
.divider span { color: var(--agent-muted); font-size: .82em; font-weight: 500; }

.turn { margin: 20px 0; }
.turn:first-of-type { margin-top: 4px; }
.turn.user { display: flex; justify-content: flex-end; }
.turn.user .body {
  background: var(--agent-user-bg); padding: 11px 16px;
  border-radius: var(--agent-radius); max-width: 84%; white-space: pre-wrap;
}
.turn.assistant { display: flex; gap: 12px; align-items: flex-start; }
.avatar {
  flex: none; width: var(--agent-avatar-size); height: var(--agent-avatar-size);
  border-radius: 50%; background: var(--agent-avatar-bg); color: var(--agent-text);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.avatar svg { width: 60%; height: 60%; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.content { flex: 1; min-width: 0; }

.body { font-size: .9375em; line-height: 1.6; }
.body > :first-child { margin-top: 0; }
.body > :last-child { margin-bottom: 0; }
.body p { margin: .5em 0; }
.body strong { font-weight: 600; }
.body h3, .body h4, .body h5 { margin: 1em 0 .35em; font-size: 1em; font-weight: 600; line-height: 1.4; }
.body ul, .body ol { margin: .45em 0; padding-left: 1.3em; }
.body li { margin: .15em 0; }
.body li::marker { color: var(--agent-muted); }
.body a { color: var(--agent-accent); text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 2px; overflow-wrap: anywhere; }
.body a:hover { text-decoration-color: currentColor; }
.body code { background: var(--agent-code-bg); padding: .1em .35em; border-radius: 5px; font-size: .88em; font-family: var(--agent-mono); }

/* ---- code blocks: dark surface, language label, copy button ---- */
.body .code-block { position: relative; margin: .7em 0; }
.body pre {
  margin: 0; padding: 14px 16px; border-radius: 12px; overflow-x: auto;
  background: var(--agent-code-block-bg); color: var(--agent-code-block-text);
  font-family: var(--agent-mono); font-size: .84em; line-height: 1.6;
}
.body pre[data-lang]::before {
  content: attr(data-lang); display: block; margin-bottom: .6em;
  color: color-mix(in srgb, var(--agent-code-block-text) 55%, transparent); font-size: .85em; text-transform: lowercase;
}
.body pre code { background: none; padding: 0; font-size: inherit; }
.body .copy {
  position: absolute; top: 8px; right: 8px; width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border: 0; border-radius: 8px; cursor: pointer;
  background: color-mix(in srgb, var(--agent-code-block-text) 10%, transparent);
  color: var(--agent-code-block-text);
  opacity: 0; transition: opacity .15s, background .15s;
}
.body .copy svg { width: 15px; height: 15px; }
.body .copy:hover { background: color-mix(in srgb, var(--agent-code-block-text) 20%, transparent); }
.body .code-block:hover .copy, .body .copy:focus-visible, .body .copy[data-state] { opacity: 1; }
@media (hover: none) { .body .copy { opacity: 1; } }
.body .copy .copied-icon, .body .copy[data-state="done"] .copy-icon { display: none; }
.body .copy[data-state="done"] .copied-icon { display: block; }
.body table { border-collapse: collapse; margin: .6em 0; width: 100%; font-size: .94em; }
.body th, .body td { border: 1px solid var(--agent-border); padding: 6px 10px; text-align: left; }
.body th { background: var(--agent-code-bg); }
.body hr { border: 0; border-top: 1px solid var(--agent-border); margin: 1.1em 0; }
.body blockquote { margin: .6em 0; padding: 2px 0 2px 12px; border-left: 3px solid var(--agent-border); color: var(--agent-muted); }

.status { display: flex; align-items: center; gap: 8px; min-height: var(--agent-avatar-size); color: var(--agent-muted); font-size: .92em; }
.status-icon { width: 16px; height: 16px; flex: none; opacity: .8; }
.status-label { font-family: var(--agent-mono); font-size: .92em; }
.loader { display: inline-flex; gap: 4px; }
.loader span { width: 6px; height: 6px; border-radius: 50%; background: var(--agent-muted); animation: agent-blink 1.2s infinite both; }
.loader span:nth-child(2) { animation-delay: .2s; }
.loader span:nth-child(3) { animation-delay: .4s; }
@keyframes agent-blink { 0%, 80%, 100% { opacity: .2; transform: scale(.7); } 40% { opacity: 1; transform: scale(1); } }

/* ---- action buttons (frontend tool confirmations) ---- */
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.actions:empty, .turn[aria-busy="true"] .actions { display: none; }
/* Without text, the first row of buttons centers on the avatar. */
.body:empty + .actions { margin-top: calc((var(--agent-avatar-size) - var(--agent-action-height)) / 2); }
.action {
  border: 1px solid var(--agent-button-bg); background: var(--agent-button-bg); color: var(--agent-button-fg);
  min-height: var(--agent-action-height); border-radius: 999px; padding: 4px 14px; cursor: pointer;
  font: inherit; font-size: .92em; line-height: 1.4; text-align: left;
  transition: background-color .15s, color .15s, border-color .15s, opacity .15s;
}
.action:hover:enabled { background: color-mix(in srgb, var(--agent-button-bg) 85%, #fff); }
.action:disabled { cursor: default; background: var(--agent-bg); color: var(--agent-muted); border-color: var(--agent-border); }
.action[aria-busy="true"] { cursor: progress; }
.action[data-state="done"]::before { content: "✓ "; }
.action[data-state="failed"]::before { content: "✕ "; }
.action[data-state="dismissed"] { opacity: .6; }

/* ---- suggestions (example prompts, cleared on the first message) ---- */
.suggestions {
  flex: none; display: flex; flex-wrap: wrap; gap: 8px;
  justify-content: flex-end; padding: 0 var(--agent-gutter) 4px;
}
.suggestion {
  border: 1px solid var(--agent-border); background: var(--agent-bg); color: var(--agent-text);
  border-radius: 999px; padding: 7px 14px; cursor: pointer;
  font: inherit; font-size: .92em; line-height: 1.4; text-align: left;
  transition: background .15s;
}
.suggestion:hover { background: var(--agent-user-bg); }

/* ---- composer ---- */
.composer { flex: none; padding: 10px var(--agent-gutter) 14px; }
.box {
  display: flex; align-items: flex-end; gap: 8px;
  background: var(--agent-input-bg); border: 1px solid var(--agent-border);
  border-radius: var(--agent-radius); padding: 6px 6px 6px 18px; transition: border-color .15s;
}
.box:focus-within { border-color: color-mix(in srgb, var(--agent-border) 90%, var(--agent-text)); }
.input {
  flex: 1; min-width: 0;
  background: none; border: 0; color: var(--agent-text); resize: none; outline: none;
  font: inherit; line-height: 1.5; padding: 6px 0;
  field-sizing: content; max-height: 168px; /* native auto-grow, no JS */
}
.input::placeholder { color: var(--agent-muted); }
.tools { display: flex; align-items: center; gap: 6px; }
.send {
  flex: none; width: 36px; height: 36px; border: 0; border-radius: 50%; cursor: pointer;
  background: var(--agent-button-bg); color: var(--agent-button-fg);
  display: flex; align-items: center; justify-content: center; transition: background .15s, opacity .15s;
}
.send:hover:not(:disabled) { background: color-mix(in srgb, var(--agent-button-bg) 85%, #fff); }
.send:disabled { opacity: .38; cursor: default; }
.send svg { width: 18px; height: 18px; }

.disclaimer { text-align: center; color: var(--agent-muted); font-size: .78em; margin-top: 10px; }
.disclaimer:empty { display: none; }
`
