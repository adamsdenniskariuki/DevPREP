export type StyleObject = Record<string, unknown>
export type Style = StyleObject | false | null | undefined | Style[]

export function flattenStyle(style: Style): StyleObject {
  // TODO: merge nested arrays left to right, skipping falsy entries
  return Array.isArray(style) ? {} : { ...(style || {}) }
}
