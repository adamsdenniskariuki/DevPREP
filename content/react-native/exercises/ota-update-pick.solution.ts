export interface Device { runtimeVersion: string; channel: string; currentUpdateId: string | null; installId: string }
export interface Update { id: string; runtimeVersion: string; channel: string; createdAt: number; rolloutPercent: number; rolledBack?: boolean }

export function bucket(installId: string, updateId: string): number {
  let hash = 0
  for (const ch of installId + ':' + updateId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hash % 100
}

export function pickUpdate(device: Device, updates: Update[]): Update | { id: 'embedded' } | null {
  const eligible = updates.filter(update =>
    update.runtimeVersion === device.runtimeVersion &&
    update.channel === device.channel &&
    !update.rolledBack &&
    bucket(device.installId, update.id) < update.rolloutPercent)
  const newest = eligible.reduce<Update | null>((best, update) => !best || update.createdAt > best.createdAt ? update : best, null)
  if (newest) return newest.id === device.currentUpdateId ? null : newest
  const current = updates.find(update => update.id === device.currentUpdateId)
  return current?.rolledBack ? { id: 'embedded' } : null
}
