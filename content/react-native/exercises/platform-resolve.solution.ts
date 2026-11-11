export type OS = 'ios' | 'android' | 'web'
export type Spec<T> = Partial<Record<OS | 'native' | 'default', T>>

const isNative = (os: OS) => os === 'ios' || os === 'android'

export function platformSelect<T>(os: OS, spec: Spec<T>): T | undefined {
  if (os in spec) return spec[os]
  if (isNative(os) && 'native' in spec) return spec.native
  return spec.default
}

export function resolveModule(request: string, os: OS, files: Set<string>): string | null {
  const suffixes = [`.${os}.tsx`, `.${os}.ts`, ...(isNative(os) ? ['.native.tsx', '.native.ts'] : []), '.tsx', '.ts']
  const hit = suffixes.map(suffix => request + suffix).find(path => files.has(path))
  return hit ?? null
}
