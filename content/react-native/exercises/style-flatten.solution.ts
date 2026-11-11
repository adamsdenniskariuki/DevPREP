export type StyleObject = Record<string, unknown>
export type Style = StyleObject | false | null | undefined | Style[]

export function flattenStyle(style: Style): StyleObject {
  const result: StyleObject = {}
  const visit = (value: Style) => {
    if (!value) return
    if (Array.isArray(value)) value.forEach(visit)
    else Object.assign(result, value)
  }
  visit(style)
  return result
}
