import { describe, expect, it } from 'vitest'
import { checkBeforeRelaunch, registerBusy, registerSaveCheck } from './relaunch-guard'

describe('relaunch guard', () => {
  it('passes with nothing registered', async () => {
    expect(await checkBeforeRelaunch()).toEqual({ blocked: [], busy: [] })
  })

  it('runs every save check and reports the ones that could not save', async () => {
    const saved: string[] = []
    const remove = [
      registerSaveCheck(async () => { saved.push('board') }),
      registerSaveCheck(() => { saved.push('draft'); return 'The draft could not be saved.' }),
      registerSaveCheck(async () => { throw new Error('Storage is full.') }),
    ]
    expect(await checkBeforeRelaunch()).toEqual({ blocked: ['The draft could not be saved.', 'Storage is full.'], busy: [] })
    expect(saved.sort()).toEqual(['board', 'draft'])
    for (const item of remove) item()
    expect(await checkBeforeRelaunch()).toEqual({ blocked: [], busy: [] })
  })

  it('reports timed activities in progress until they unregister', async () => {
    const stop = registerBusy('A timed mock interview')
    const again = registerBusy('A timed mock interview')
    expect((await checkBeforeRelaunch()).busy).toEqual(['A timed mock interview'])
    stop()
    again()
    expect((await checkBeforeRelaunch()).busy).toEqual([])
  })
})
