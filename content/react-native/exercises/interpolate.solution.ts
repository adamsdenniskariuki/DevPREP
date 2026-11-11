export type Extrapolate = 'extend' | 'clamp' | 'identity'
export interface InterpolateConfig { inputRange: number[]; outputRange: number[]; extrapolate?: Extrapolate; extrapolateLeft?: Extrapolate; extrapolateRight?: Extrapolate }

export function interpolate(value: number, config: InterpolateConfig): number {
  const { inputRange: input, outputRange: output } = config
  if (input.length < 2 || input.length !== output.length) throw new Error('inputRange and outputRange must have the same length (at least 2)')
  for (let i = 1; i < input.length; i++) if (input[i] < input[i - 1]) throw new Error('inputRange must be non-decreasing')
  const last = input.length - 1
  if (value < input[0] || value > input[last]) {
    const left = value < input[0]
    const mode = (left ? config.extrapolateLeft : config.extrapolateRight) ?? config.extrapolate ?? 'extend'
    if (mode === 'identity') return value
    if (mode === 'clamp') return left ? output[0] : output[last]
  }
  let i = 0
  while (i < last - 1 && value > input[i + 1]) i++
  const [in0, in1, out0, out1] = [input[i], input[i + 1], output[i], output[i + 1]]
  if (in1 === in0) return out0
  return out0 + (value - in0) * (out1 - out0) / (in1 - in0)
}
