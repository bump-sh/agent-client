import type { ButtonLabel } from "./types.js"

const VARIABLE = /\{args((?:\.[\w-]+)+)\}/g
const PRINTABLE = ["string", "number", "boolean"]

/**
 * The text of a button label for a tool call, or undefined when it has none: a
 * variable of the template that does not resolve, or a function returning nothing
 * or throwing: a label never breaks a reply.
 */
export function resolveLabel<Args>(
  label: ButtonLabel<Args>,
  args: Args,
): string | undefined {
  if (typeof label === "function") return functionLabel(label, args)
  const text = label.replace(VARIABLE, replaceArgsFunction(args))
  return text.match(VARIABLE) ? undefined : text
}

function functionLabel<Args>(
  label: (args: Args) => string | undefined,
  args: Args,
): string | undefined {
  try {
    return label(args) || undefined
  } catch {
    return undefined
  }
}

function replaceArgsFunction<Args>(args: Args): (match: string, p1: string) => string {
  // See signature for replacement functions
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_function_as_the_replacement
  return (_, path: string) => {
    const value = path
      .slice(1)
      .split(".")
      .reduce<unknown>(
        (value, key) => (value as Record<string, unknown> | undefined)?.[key],
        args,
      )

    // Return unchanged template when its not a printable value
    if (!PRINTABLE.includes(typeof value)) return `{args${path}}`

    return String(value)
  }
}
