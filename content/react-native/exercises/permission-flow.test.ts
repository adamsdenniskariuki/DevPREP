import { nextPermissionStep, runPermissionFlow } from './index'
import type { PermissionStatus } from './index'

const base = { platform: 'android' as const, canAskAgain: true, rationaleShown: false }

export function testTerminalStates() {
  assertEqual(nextPermissionStep({ ...base, status: 'granted' }), 'proceed')
  assertEqual(nextPermissionStep({ ...base, status: 'limited' }), 'proceed')
  assertEqual(nextPermissionStep({ ...base, status: 'unavailable' }), 'unavailable')
  assertEqual(nextPermissionStep({ ...base, status: 'blocked' }), 'openSettings')
  assertEqual(nextPermissionStep({ ...base, status: 'denied', canAskAgain: false }), 'openSettings')
}

export function testAsking() {
  assertEqual(nextPermissionStep({ ...base, status: 'undetermined' }), 'request')
  assertEqual(nextPermissionStep({ ...base, status: 'denied' }), 'showRationale')
  assertEqual(nextPermissionStep({ ...base, status: 'denied', rationaleShown: true }), 'request')
  assertEqual(nextPermissionStep({ ...base, platform: 'ios', status: 'denied' }), 'openSettings')
}

function fakeApi(statuses: PermissionStatus[]) {
  const calls: string[] = []
  let i = 0
  return {
    calls,
    async check() { calls.push('check'); const status = statuses[Math.min(i, statuses.length - 1)]; return { status, canAskAgain: status !== 'blocked' } },
    async request() { calls.push('request'); i++ },
    async showRationale() { calls.push('rationale') },
    async openSettings() { calls.push('settings') },
  }
}

export async function testFlowGranted() {
  const api = fakeApi(['undetermined', 'granted'])
  assertEqual(await runPermissionFlow(api, 'ios'), 'proceed')
  assertEqual(api.calls, ['check', 'request', 'check'])
}

export async function testFlowWithRationale() {
  const api = fakeApi(['denied', 'blocked'])
  assertEqual(await runPermissionFlow(api, 'android'), 'openSettings')
  assertEqual(api.calls, ['check', 'rationale', 'check', 'request', 'check', 'settings'])
}
