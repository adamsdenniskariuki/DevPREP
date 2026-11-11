export type PermissionStatus = 'granted' | 'limited' | 'denied' | 'blocked' | 'undetermined' | 'unavailable'
export type Step = 'proceed' | 'request' | 'showRationale' | 'openSettings' | 'unavailable'
export interface StepInput { status: PermissionStatus; platform: 'ios' | 'android'; canAskAgain: boolean; rationaleShown: boolean }
export interface PermissionApi {
  check(): Promise<{ status: PermissionStatus; canAskAgain: boolean }>
  request(): Promise<void>
  showRationale(): Promise<void>
  openSettings(): Promise<void>
}

export function nextPermissionStep(input: StepInput): Step {
  if (input.status === 'granted') return 'proceed'
  return 'request'
}

export async function runPermissionFlow(api: PermissionApi, platform: 'ios' | 'android'): Promise<Step> {
  // TODO: loop over check and the next step
  await api.request()
  return 'proceed'
}
