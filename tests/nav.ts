import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** The nav group each second-level item sits in, used to open the right sheet on small screens. */
const GROUP_OF: Record<string, string> = {
  Learn: 'Learn', Tracks: 'Learn', Patterns: 'Learn', 'Field Guide': 'Learn',
  Practise: 'Practise', 'Coding problems': 'Practise', 'SQL problems': 'Practise', Flashcards: 'Practise',
  Design: 'Design', 'Design cases': 'Design', Whiteboard: 'Design',
  Interview: 'Interview', 'Company prep': 'Interview', 'Mock interviews': 'Interview', 'Story bank': 'Interview',
  Me: 'Me', Today: 'Me', Plan: 'Me', Progress: 'Me', Settings: 'Me',
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Tree rows add ", done" or ", 3 due" to their names, so match the label at the start. */
export const itemName = (label: string) => new RegExp(`^${escape(label)}\\s*(,|$)`)

/** The desktop sidebar tree is used from 1024px up; below that the bottom bar and its sheets. */
export const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024

export const siteTree = (page: Page) => page.getByRole('tree', { name: 'Site' })
export const treeItem = (page: Page, label: string) => siteTree(page).getByRole('treeitem', { name: itemName(label) })
export const sectionButton = (page: Page, group: string) => page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: itemName(group) })
export const sheet = (page: Page, group: string) => page.getByRole('dialog', { name: group })

export function groupOf(label: string): string {
  const group = GROUP_OF[label]
  if (!group) throw new Error(`No nav group for ${label}`)
  return group
}

/** Opens a page from the nav: the sidebar tree on desktop, or the bottom bar and its sheet on small screens. */
export async function navTo(page: Page, label: string, how: 'click' | 'tap' = 'click') {
  const press = (target: Locator) => how === 'tap' ? target.tap() : target.click()
  if (isDesktop(page)) {
    await press(treeItem(page, label))
    return
  }
  const group = groupOf(label)
  await press(sectionButton(page, group))
  const open = sheet(page, group)
  await expect(open).toBeVisible()
  await press(label === group ? open.getByRole('link', { name: `${group} hub` }) : open.getByRole('treeitem', { name: itemName(label) }))
  await expect(open).toBeHidden()
}

/** The nav marks this item as the current page: its group on the bottom bar, and the row in the tree. */
export async function expectCurrent(page: Page, label: string) {
  if (isDesktop(page)) await expect(treeItem(page, label)).toHaveAttribute('aria-current', 'page')
  else await expect(sectionButton(page, groupOf(label))).toHaveClass(/\bactive\b/)
}

/** The current page sits inside this group, e.g. a single problem under Practise. */
export async function expectInGroup(page: Page, group: string) {
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('listitem').first()).toHaveText(group)
  if (isDesktop(page)) await expect(treeItem(page, group)).toHaveClass(/\bin-path\b|\bactive\b/)
  else await expect(sectionButton(page, group)).toHaveClass(/\bactive\b/)
}
