export interface Module { exports: any }
export type Definition = (module: Module, require: (name: string) => any) => void

export function createRequire(definitions: Record<string, Definition>): (name: string) => any {
  const cache = new Map<string, Module>()
  const require = (name: string): any => {
    const cached = cache.get(name)
    if (cached) return cached.exports
    if (!Object.prototype.hasOwnProperty.call(definitions, name)) throw new Error(`Cannot find module '${name}'`)
    const module: Module = { exports: {} }
    cache.set(name, module)
    definitions[name](module, require)
    return module.exports
  }
  return require
}
