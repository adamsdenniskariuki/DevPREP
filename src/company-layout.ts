import { wrap } from './diagram-layout'
import type { Company, FocusLevel } from './company-types'

// Company diagrams are generated from content. Both are narrow vertical stacks so they stay
// readable at 360px without sideways scrolling, and scale up only a little on wide screens.
export const LOOP_W = 340
export const LOOP_WRAP = 38
const RAIL_X = 24
const TEXT_X = 50
const LINE_H = 17
const STAGE_GAP = 18

export interface LoopStage { top: number; height: number; name: string; tag: string; lines: string[] }

/** Stages top to bottom: a numbered marker on a rail, the stage name, its basis and its rounds. */
export function layoutLoop(company: Pick<Company, 'process'>) {
  let top = 16
  const stages: LoopStage[] = company.process.stages.map(stage => {
    const lines = stage.rounds.flatMap(round => wrap(`• ${round}`, LOOP_WRAP))
    const height = 38 + lines.length * LINE_H
    const item = { top, height, name: stage.name, tag: stage.basis === 'official' ? 'OFFICIAL' : 'REPORTED', lines }
    top += height + STAGE_GAP
    return item
  })
  return { width: LOOP_W, height: top - STAGE_GAP + 12, railX: RAIL_X, textX: TEXT_X, lineHeight: LINE_H, stages }
}

export const FOCUS_W = 340
export const FOCUS_TRACK = 220
export const LEVEL_SHARE: Record<FocusLevel, number> = { low: 1 / 3, medium: 2 / 3, high: 1 }
export const LEVEL_LABEL: Record<FocusLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' }
const ROW_H = 44

/** One row per focus area: the label above a bar whose length shows the editorial emphasis. */
export function layoutFocus(company: Pick<Company, 'focus'>) {
  const rows = company.focus.map((item, index) => ({
    label: item.label, level: LEVEL_LABEL[item.level], top: 14 + index * ROW_H,
    width: Math.round(FOCUS_TRACK * LEVEL_SHARE[item.level]),
  }))
  return { width: FOCUS_W, height: 14 + rows.length * ROW_H + 6, track: FOCUS_TRACK, rows }
}

/** Plain-text versions of both diagrams, for the "Text description" disclosure and screen readers. */
export function describeLoop(company: Pick<Company, 'process'>): string[] {
  return company.process.stages.map((stage, index) => `Stage ${index + 1}, ${stage.name} (${stage.basis}): ${stage.rounds.join('; ')}.`)
}

export function describeFocus(company: Pick<Company, 'focus'>): string[] {
  return company.focus.map(item => `${item.label}: ${LEVEL_LABEL[item.level].toLowerCase()} emphasis.`)
}
