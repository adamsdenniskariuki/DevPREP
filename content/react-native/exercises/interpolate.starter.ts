export type Extrapolate = 'extend' | 'clamp' | 'identity'
export interface InterpolateConfig { inputRange: number[]; outputRange: number[]; extrapolate?: Extrapolate; extrapolateLeft?: Extrapolate; extrapolateRight?: Extrapolate }

export function interpolate(value: number, config: InterpolateConfig): number {
  const [in0, in1] = config.inputRange
  const [out0, out1] = config.outputRange
  return out0 + (value - in0) * (out1 - out0) / (in1 - in0)
}
