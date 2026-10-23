import { describe, expect, it } from 'vitest'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }
import { MAX_BOARD_BYTES, parseFullBackup, serializeFullBackup } from './board-backup'
import type { BoardRecord } from './boards'
import { gameStats } from './gamification'
import { emptyProgress, parseBackup, recordBoardCreated, serializeBackup } from './progress'
import { caseIds } from './cases'
import { finish, newPractice, tick } from './practice'

const at = '2026-10-01T10:00:00.000Z'
function board(id: string, extra: Partial<BoardRecord> = {}): BoardRecord {
  return {
    id, title: `Board ${id}`, kind: 'free', createdAt: at, updatedAt: at, appState: { viewBackgroundColor: '#ffffff' }, files: {},
    elements: [{ id: `${id}-r`, type: 'rectangle', x: 1, y: 2, width: 30, height: 40, isDeleted: false, groupIds: [], boundElements: null }],
    ...extra,
  }
}
const withBoards = (boards: unknown) => JSON.stringify({ ...JSON.parse(serializeBackup(emptyProgress(new Date(at)))), boards })

describe('backups with whiteboards', () => {
  it('round-trips boards and progress', () => {
    const progress = recordBoardCreated(emptyProgress(new Date(at)), undefined, new Date(at))
    const boards = [board('a'), board('b', { kind: 'practice', caseId: 'url-shortener', fallback: { nodes: [], edges: [] } }), board('c', { kind: 'scratch', problemId: 'count-pair-sums' })]
    const text = serializeFullBackup(progress, boards)
    const parsed = parseFullBackup(text)
    expect(parsed.progress).toEqual(progress)
    expect(parsed.boards).toEqual(boards)
  })

  it('keeps the old format when boards are left out', () => {
    const progress = emptyProgress(new Date(at))
    expect(serializeFullBackup(progress)).toBe(serializeBackup(progress))
    expect(parseFullBackup(serializeBackup(progress))).toEqual({ progress })
    expect(serializeFullBackup(progress, [])).toContain('"boards":[]')
    expect(parseFullBackup(serializeFullBackup(progress, [])).boards).toEqual([])
  })

  it('still imports old backups without boards', () => {
    const parsed = parseFullBackup(JSON.stringify(legacyBackup))
    expect(parsed.boards).toBeUndefined()
    expect(parsed.progress).toEqual(parseBackup(JSON.stringify(legacyBackup)))
  })

  it('keeps progress errors as before', () => {
    expect(() => parseFullBackup('nope')).toThrow('Invalid backup: not valid JSON.')
    expect(() => parseFullBackup(JSON.stringify({ ...legacyBackup, extra: 1 }))).toThrow('unexpected or missing fields')
    expect(() => parseFullBackup(JSON.stringify({ ...legacyBackup, version: 2, boards: [] }))).toThrow('unsupported version')
  })

  it('rejects malformed boards clearly', () => {
    expect(() => parseFullBackup(withBoards({}))).toThrow('whiteboards must be a list')
    expect(() => parseFullBackup(withBoards([1]))).toThrow('a whiteboard is not an object')
    expect(() => parseFullBackup(withBoards([{ ...board('a'), extra: 1 }]))).toThrow('unexpected or missing fields')
    const { title: _title, ...untitled } = board('a')
    expect(() => parseFullBackup(withBoards([untitled]))).toThrow('unexpected or missing fields')
    expect(() => parseFullBackup(withBoards([board('BAD ID')]))).toThrow('invalid id')
    expect(() => parseFullBackup(withBoards([board('a'), board('a')]))).toThrow('share an id')
    expect(() => parseFullBackup(withBoards([board('a', { kind: 'other' as never })]))).toThrow('unknown kind')
    expect(() => parseFullBackup(withBoards([board('a', { caseId: 'nope' })]))).toThrow('unknown case study')
    expect(() => parseFullBackup(withBoards([board('a', { problemId: 'nope' })]))).toThrow('unknown problem')
    expect(() => parseFullBackup(withBoards([board('a', { updatedAt: 'yesterday' })]))).toThrow('invalid timestamp')
    expect(() => parseFullBackup(withBoards([board('a', { elements: [{ id: 'x' }] as never })]))).toThrow('malformed shape')
    expect(() => parseFullBackup(withBoards([board('a', { title: '' })]))).toThrow('invalid title')
  })

  it('caps each board at 5 MB and all boards at 20 MB', () => {
    const image = (size: number) => ({ f: { id: 'f', mimeType: 'image/png', dataURL: `data:image/png;base64,${'A'.repeat(size)}`, created: 1 } })
    const huge = board('huge', { files: image(MAX_BOARD_BYTES) })
    expect(() => serializeFullBackup(emptyProgress(), [huge])).toThrow('“Board huge” is larger than 5 MB')
    expect(() => parseFullBackup(withBoards([huge]))).toThrow('whiteboard “Board huge” is larger than 5 MB')
    const big = ['a', 'b', 'c', 'd', 'e'].map(id => board(id, { files: image(4_200_000) }))
    expect(() => serializeFullBackup(emptyProgress(), big)).toThrow('more than 20 MB')
    expect(() => parseFullBackup(withBoards(big))).toThrow('whiteboards add up to more than 20 MB')
    expect(() => parseFullBackup(' '.repeat(23_000_000))).toThrow('file is larger than 22.0 MB')
    expect(parseFullBackup(withBoards(big.slice(0, 4))).boards).toHaveLength(4)
  })
})

describe('first board', () => {
  it('records once, earns XP and a badge, and survives a backup', () => {
    const start = emptyProgress(new Date(at))
    const once = recordBoardCreated(start, undefined, new Date(at))
    expect(recordBoardCreated(once)).toBe(once)
    expect(gameStats(once, new Date(at)).xp - gameStats(start, new Date(at)).xp).toBe(10)
    expect(gameStats(once, new Date(at)).badges.find(badge => badge.id === 'first-board')?.earned).toBe(true)
    expect(gameStats(start).badges.slice(-3).map(badge => badge.id)).toEqual(['first-board', 'first-practice', 'practice-5'])
    expect(parseBackup(serializeBackup(once)).whiteboard).toEqual({ firstBoard: at })
    expect(() => parseBackup(JSON.stringify({ ...once, whiteboard: { firstBoard: 'x' } }))).toThrow('invalid timestamp')
    expect(() => parseBackup(JSON.stringify({ ...once, whiteboard: {} }))).toThrow('unexpected or missing fields')
  })
})

describe('whiteboard practice', () => {
  const later = (minutes: number) => new Date(Date.parse(at) + minutes * 60_000)

  it('awards XP and badges once per case practised', () => {
    const [first, second, ...rest] = [...caseIds]
    const start = emptyProgress(new Date(at))
    const one = recordBoardCreated(start, first, later(30))
    expect(one.whiteboard).toEqual({ firstBoard: later(30).toISOString(), practised: { [first]: later(30).toISOString() } })
    expect(recordBoardCreated(one, first, later(90))).toBe(one)
    expect(recordBoardCreated(one)).toBe(one)
    const xp = (progress: typeof start) => gameStats(progress, later(200)).xp
    expect(xp(one) - xp(start)).toBe(30)
    const two = recordBoardCreated(one, second, later(60))
    expect(xp(two) - xp(one)).toBe(20)
    const badge = (progress: typeof start, id: string) => gameStats(progress, later(200)).badges.find(item => item.id === id)?.earned
    expect(badge(start, 'first-practice')).toBe(false)
    expect(badge(one, 'first-practice')).toBe(true)
    expect(badge(two, 'practice-5')).toBe(false)
    const five = rest.slice(0, 3).reduce((progress, id, index) => recordBoardCreated(progress, id, later(100 + index)), two)
    expect(badge(five, 'practice-5')).toBe(true)
    expect(gameStats(five, later(200)).streak.activeToday).toBe(true)
    expect(gameStats(start, later(200)).streak.activeToday).toBe(false)
  })

  it('keeps practised cases through a backup and rejects bad ones', () => {
    const [first] = [...caseIds]
    const one = recordBoardCreated(recordBoardCreated(emptyProgress(new Date(at)), undefined, new Date(at)), first, later(30))
    expect(parseBackup(serializeBackup(one))).toEqual(one)
    const bad = (practised: unknown) => JSON.stringify({ ...one, whiteboard: { firstBoard: at, practised } })
    expect(() => parseBackup(bad({ 'no-such-case': at }))).toThrow('unknown case study')
    expect(() => parseBackup(bad({ [first]: 'soon' }))).toThrow('invalid timestamp')
    expect(() => parseBackup(bad([]))).toThrow()
  })

  it('round-trips attempts and scratchpads with their boards', () => {
    const [first] = [...caseIds]
    const attempt = tick(finish(newPractice(35, Date.parse(at)), Date.parse(at) + 31 * 60_000), 3, true)
    const running = newPractice(45, Date.parse(at))
    const boards = [
      board('p1', { kind: 'practice', caseId: first, practice: attempt }),
      board('p2', { kind: 'practice', caseId: first, practice: running }),
      board('s1', { kind: 'scratch', problemId: 'count-pair-sums' }),
    ]
    const parsed = parseFullBackup(serializeFullBackup(emptyProgress(new Date(at)), boards))
    expect(parsed.boards).toEqual(boards)
    expect(() => parseFullBackup(withBoards([board('a', { practice: attempt })]))).toThrow('is not a practice board')
    expect(() => parseFullBackup(withBoards([board('a', { kind: 'practice', caseId: first, practice: { ...attempt, minutes: 20 } as never })]))).toThrow('whiteboard “Board a” practice has an unknown time limit')
  })
})