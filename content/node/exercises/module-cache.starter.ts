export interface Module { exports: any }
export type Definition = (module: Module, require: (name: string) => any) => void

export function createRequire(definitions: Record<string, Definition>): (name: string) => any {
  const require = (name: string): any => {
    // TODO: cache modules and guard against unknown names and cycles.
    const module: Module = { exports: {} }
    definitions[name](module, require)
    return module.exports
  }
  return require
}
