import { describe, expect, it } from 'vitest'
import { editorPrefs, emptyProgress, parseBackup, serializeBackup, updateEditorPrefs } from './progress'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }

const now = new Date('2026-09-17T12:00:00.000Z')

describe('code editor preferences', () => {
  it('defaults old backups to the rich editor with interview mode off', () => {
    const restored = parseBackup(JSON.stringify(legacyBackup))
    expect(restored.editor).toBeUndefined()
    expect(editorPrefs(restored)).toEqual({ kind: 'rich', interview: false })
    expect(editorPrefs(emptyProgress(now))).toEqual({ kind: 'rich', interview: false })
  })

  it('saves only choices that differ from the defaults and round-trips them', () => {
    const plain = updateEditorPrefs(emptyProgress(now), { kind: 'plain' }, now)
    expect(plain.editor).toEqual({ kind: 'plain' })
    const both = updateEditorPrefs(plain, { interview: true }, now)
    expect(both.editor).toEqual({ kind: 'plain', interview: true })
    const restored = parseBackup(serializeBackup(both))
    expect(editorPrefs(restored)).toEqual({ kind: 'plain', interview: true })
    const reset = updateEditorPrefs(updateEditorPrefs(restored, { kind: 'rich' }, now), { interview: false }, now)
    expect(reset).not.toHaveProperty('editor')
  })

  it('drops default values on import and rejects unknown values', () => {
    const base = { ...emptyProgress(now) }
    expect(parseBackup(JSON.stringify({ ...base, editor: { kind: 'rich', interview: false } })).editor ?? {}).toEqual({})
    expect(() => parseBackup(JSON.stringify({ ...base, editor: { kind: 'vim' } }))).toThrow(/unknown code editor/)
    expect(() => parseBackup(JSON.stringify({ ...base, editor: { interview: 'yes' } }))).toThrow(/interview mode/)
    expect(() => parseBackup(JSON.stringify({ ...base, editor: { theme: 'dark' } }))).toThrow(/unexpected/)
  })
})