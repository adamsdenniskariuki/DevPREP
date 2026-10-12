// Aggregates content/<track>/*.json into src/generated/curriculum.json so the app,
// Vitest and Playwright (plain Node) all load the same data with one JSON import.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const TRACK_ORDER = ['dsa', 'system-design', 'ml', 'behavioral']
const read = path => JSON.parse(readFileSync(path, 'utf8'))

export function buildCurriculum(root = 'content') {
  const tracks = []
  const lessons = []
  for (const id of TRACK_ORDER) {
    const info = read(join(root, id, 'track.json'))
    const files = new Set(readdirSync(join(root, id)).filter(name => name.endsWith('.json') && name !== 'track.json'))
    for (const lessonId of info.lessons) {
      if (!files.delete(`${lessonId}.json`)) throw new Error(`content/${id}/track.json lists ${lessonId} but the file is missing`)
      lessons.push(read(join(root, id, `${lessonId}.json`)))
    }
    if (files.size) throw new Error(`content/${id} has lessons not listed in track.json: ${[...files].join(', ')}`)
    tracks.push({ id: info.id, title: info.title, description: info.description })
  }
  return { tracks, lessons }
}

export const OUTPUT = 'src/generated/curriculum.json'

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const text = JSON.stringify(buildCurriculum()) + '\n'
  if (!existsSync(OUTPUT) || readFileSync(OUTPUT, 'utf8') !== text) {
    mkdirSync('src/generated', { recursive: true })
    writeFileSync(OUTPUT, text)
  }
}