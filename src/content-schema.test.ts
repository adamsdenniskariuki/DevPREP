import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateLesson, validateTrack, TRACK_IDS } from './content-schema'
import { lessons } from './curriculum'

const root = 'content'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown

describe('content schema', () => {
  it('has a directory for every track and no stray directories', () => {
    const dirs = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    expect(dirs).toEqual([...TRACK_IDS, 'problems'].sort())
  })

  for (const track of TRACK_IDS) {
    describe(track, () => {
      const dir = join(root, track)
      const info = read(join(dir, 'track.json')) as { lessons: string[] }
      const files = readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'track.json')

      it('track.json is valid and lists exactly the lesson files', () => {
        expect(validateTrack(info, `${track}/track.json`)).toEqual([])
        expect([...info.lessons].sort()).toEqual(files.map(name => name.replace(/\.json$/, '')).sort())
      })

      it.each(files)('%s is a valid lesson whose id matches its file and track', name => {
        const lesson = read(join(dir, name)) as { id: string; track: string }
        expect(validateLesson(lesson, `${track}/${name}`)).toEqual([])
        expect(lesson.id).toBe(name.replace(/\.json$/, ''))
        expect(lesson.track).toBe(track)
      })
    })
  }

  it('rejects malformed lessons with readable errors', () => {
    expect(validateLesson({ id: 'Bad Id', track: 'nope', extra: 1 })).toEqual(expect.arrayContaining([
      'lesson.id: expected kebab-case id',
      'lesson.track: unknown track',
      'lesson: unknown key "extra"',
      'lesson: missing "title"',
    ]))
  })

  it('generated curriculum matches the content directory', async () => {
    // @ts-expect-error plain JS build script
    const { buildCurriculum } = await import('../scripts/build-content.mjs')
    expect(JSON.parse(readFileSync('src/generated/curriculum.json', 'utf8'))).toEqual(buildCurriculum())
  })

  it('loads every lesson file into the bundled curriculum in track order', () => {
    expect(lessons.map(lesson => lesson.track)).toEqual([...lessons.map(lesson => lesson.track)].sort((a, b) => TRACK_IDS.indexOf(a) - TRACK_IDS.indexOf(b)))
    expect(new Set(lessons.map(lesson => lesson.id)).size).toBe(lessons.length)
  })
})
