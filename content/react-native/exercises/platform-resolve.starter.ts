export type OS = 'ios' | 'android' | 'web'
export type Spec<T> = Partial<Record<OS | 'native' | 'default', T>>

export function platformSelect<T>(os: OS, spec: Spec<T>): T | undefined {
  return spec[os] || spec.default
}

export function resolveModule(request: string, os: OS, files: Set<string>): string | null {
  // TODO: platform, native, then plain extensions
  return files.has(request + '.tsx') ? request + '.tsx' : null
}
