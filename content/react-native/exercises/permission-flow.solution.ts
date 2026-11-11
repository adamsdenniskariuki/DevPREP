export type PermissionStatus = 'granted' | 'limited' | 'denied' | 'blocked' | 'undetermined' | 'unavailable'
export type Step = 'proceed' | 'request' | 'showRationale' | 'openSettings' | 'unavailable'
export interface StepInput { status: PermissionStatus; platform: 'ios' | 'android'; canAskAgain: boolean; rationaleShown: boolean }
export interface PermissionApi {
  check(): Promise<{ status: PermissionStatus; canAskAgain: boolean }>
  request(): Promise<void>
  showRationale(): Promise<void>
  openSettings(): Promise<void>
}

export function nextPermissionStep({ status, platform, canAskAgain, rationaleShown }: StepInput): Step {
  if (status === 'granted' || status === 'limited') return 'proceed'
  if (status === 'unavailable') return 'unavailable'
  if (status === 'undetermined') return 'request'
  if (status === 'blocked' || !canAskAgain) return 'openSettings'
  if (platform === 'ios') return 'openSettings'
  return rationaleShown ? 'request' : 'showRationale'
}

export async function runPermissionFlow(api: PermissionApi, platform: 'ios' | 'android'): Promise<Step> {
  let rationaleShown = false
  for (let i = 0; i < 5; i++) {
    const { status, canAskAgain } = await api.check()
    const step = nextPermissionStep({ status, platform, canAskAgain, rationaleShown })
    if (step === 'request') await api.request()
    else if (step === 'showRationale') { await api.showRationale(); rationaleShown = true }
    else {
      if (step === 'openSettings') await api.openSettings()
      return step
    }
  }
  await api.openSettings()
  return 'openSettings'
}
