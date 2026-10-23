import { hashPair } from './hash-pair'
import { prefixRange } from './prefix-range'
import { sortedPair } from './sorted-pair'
import type { Tracer } from './types'
import { variableWindow } from './variable-window'

export type { ArrayView, MapView, ParseResult, Trace, TraceFrame, Tracer, TracerParam, VarValue } from './types'

export const TRACERS: Record<string, Tracer> = Object.fromEntries([hashPair, prefixRange, sortedPair, variableWindow].map(tracer => [tracer.id, tracer]))

export function getTracer(id: string): Tracer | undefined {
  return Object.hasOwn(TRACERS, id) ? TRACERS[id] : undefined
}
