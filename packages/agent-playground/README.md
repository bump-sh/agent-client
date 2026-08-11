# @bump-sh/agent-playground

Interactive configurator for [`@bump-sh/agent-widget`](../agent-widget):
tweak the options in a form, watch the widget update live against a real
endpoint, and copy the exact code — JS or HTML — that reproduces the result.
Private package, never published.

## Run it

A live instance is deployed from `main` at
**<https://bump-sh.github.io/agent-client/>**. Locally:

```sh
npm run playground        # from the repo root — serves http://localhost:8000
```

## Export it

```sh
npm run build -w @bump-sh/agent-playground
```

`dist/` is fully self-contained static files (widget bundled in) — drop the
directory on any static host or embed it in another site.

## Share via URL

The address bar always mirrors the configuration: every non-default option
appears as a query parameter named after its schema key, updated live as you
edit — copy the URL to share the exact setup. Opening such a link fills the
form, preview and code panel. Values are URL-encoded (`#e11d48` →
`%23e11d48`); booleans are `true`/`false`. The token never goes through the
URL — it is neither emitted nor accepted.

```
/?endpoint=https://run.bump.sh/acme/support/agent&mode=sidebar&theme.accent=%23e11d48
```

## How it works

Everything is driven by one declarative list, [`src/schema.ts`](src/schema.ts):
each entry describes an option (key, section, control type, the widget's
default). The form ([`src/form.ts`](src/form.ts)), the live preview
([`src/options.ts`](src/options.ts) → [`src/frame.ts`](src/frame.ts)), and the
code panel ([`src/codegen.ts`](src/codegen.ts)) all read it — **adding an
option to the widget means adding one entry here** and everything follows.

The preview runs inside an iframe styled as a ghost host site: the widget's
top-layer dialogs and fixed launcher stay confined to the canvas, so the
controls remain usable while the widget is open. When the launcher is
disabled, a stand-in "Open the widget" button plays the role of the host
site's own trigger.

The code panel only emits options that differ from the widget's defaults, so
the snippet is always the minimal code to write.
