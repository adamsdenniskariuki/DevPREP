import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ACCENT_KEY, accents } from '../src/accent-preference'
import { GROUPS, groupFor } from '../src/nav-model'
import type { NavIndex } from '../src/nav-model'
import { ALIASES, ROUTES } from '../src/routes'
import { textContrast } from './contrast'
import { isDesktop, itemName, navTo, sectionButton, sheet, siteTree, treeItem } from './nav'

const index: NavIndex = JSON.parse(readFileSync(new URL('../src/generated/nav-index.json', import.meta.url), 'utf8'))
const NOT_FOUND = 'This page isn’t on the roadmap.'
const NAV_KEY = 'devprep.nav.v1'
const groupLabel = (route: string) => GROUPS.find(group => group.id === groupFor({ route: route as never }))!.label

const crumbs = (page: Page) => page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('listitem')
const heading = (page: Page) => page.getByRole('heading', { level: 1 })
/** Axe results as rule ids and targets. CodeMirror's own scroller is a third-party widget outside the nav. */
const axe = async (page: Page) => (await new AxeBuilder({ page }).exclude('.cm-scroller').analyze()).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target.join(' ')) }))

async function open(page: Page, hash: string) {
  await page.goto(`./${hash}`)
  await expect(heading(page)).toBeVisible()
  await expect(heading(page)).not.toHaveText(/^Loading/)
}

test.describe('route compatibility', () => {
  test('every route, alias and sample sub-page opens its screen with breadcrumbs from the right group', async ({ page }) => {
    test.slow()
    for (const route of ROUTES) {
      await open(page, `#${route}`)
      await expect(heading(page), route).not.toHaveText(NOT_FOUND)
      await expect(crumbs(page).first(), route).toHaveText(groupLabel(route))
    }
    for (const [alias, route] of Object.entries(ALIASES)) {
      await open(page, `#${route}`)
      const title = await heading(page).textContent()
      await open(page, `#${alias}`)
      await expect(heading(page), alias).toHaveText(title!)
      await expect(crumbs(page).first(), alias).toHaveText(groupLabel(route))
    }
    const [track] = index.tracks
    const [problem] = index.problems
    const [sql] = index.sql
    const [item] = index.cases
    const [guide] = index.guides
    const pattern = index.patterns.find(([, , parent]) => parent)!
    const [company] = index.companies
    const leaves: [hash: string, group: string, title: string][] = [
      [`#tracks/${track[0]}`, 'Learn', track[1]],
      [`#code/${problem[0]}`, 'Practise', problem[1]],
      [`#sql/${sql[0]}`, 'Practise', sql[1]],
      [`#design/${item[0]}`, 'Design', item[1]],
      [`#guide/${guide[0]}`, 'Learn', guide[1]],
      [`#patterns/${pattern[0]}`, 'Learn', pattern[1]],
      ['#patterns/pick', 'Learn', 'Pattern picker'],
      ['#patterns/cheatsheet', 'Learn', 'Cheat sheet'],
      [`#company/${company[0]}`, 'Interview', company[1]],
      [`#mock/${company[0]}`, 'Interview', `${company[1]} mock loop`],
    ]
    for (const [hash, group, title] of leaves) {
      await open(page, hash)
      await expect(heading(page), hash).not.toHaveText(NOT_FOUND)
      await expect(crumbs(page).first(), hash).toHaveText(group)
      await expect(crumbs(page).last().locator('[aria-current="page"]'), hash).toHaveText(title)
    }
    for (const hash of ['#nope', `#code/not-a-problem`, '#tracks/nope', `#guide/${guide[0]}/extra`]) {
      await open(page, hash)
      await expect(heading(page), hash).toHaveText(NOT_FOUND)
      await expect(crumbs(page), hash).toHaveText(['Not found'])
    }
  })

  test('breadcrumb links go up the tree', async ({ page }) => {
    const [problem] = index.problems
    await open(page, `#code/${problem[0]}`)
    await expect(crumbs(page)).toHaveText(['Practise', 'Coding problems', problem[2], problem[1]])
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Practise' }).click()
    await expect(page).toHaveURL(/#practice$/)
    await expect(heading(page)).toHaveText('Practise')
    await expect(crumbs(page)).toHaveText(['Practise'])
  })
})

test('the Practise hub groups every practice tool by goal', async ({ page }) => {
  await open(page, '#practice')
  for (const [group, tools] of Object.entries({
    Drills: ['Coding problems', 'SQL problems', 'Flashcards', 'Patterns'],
    Design: ['Design cases', 'Whiteboard'],
    Interview: ['Company prep', 'Mock interviews', 'Story bank', 'Study plan'],
  })) {
    const section = page.getByRole('region', { name: group })
    await expect(section.getByRole('heading', { level: 3 })).toHaveText(tools)
  }
  await page.getByRole('link', { name: /^SQL problems/ }).click()
  await expect(page).toHaveURL(/#sql$/)
})

test.describe('desktop tree', () => {
  test.beforeEach(({ page }) => test.skip(!isDesktop(page), 'The tree sidebar is for wide screens'))

  test('follows the ARIA tree keyboard pattern and remembers what is open', async ({ page }) => {
    await open(page, '#home')
    const tree = siteTree(page)
    const learn = treeItem(page, 'Learn')
    await expect(learn).toHaveAttribute('aria-level', '1')
    await expect(learn).toHaveAttribute('aria-setsize', '5')
    await expect(learn).toHaveAttribute('aria-posinset', '1')
    await expect(learn).toHaveAttribute('aria-expanded', 'true')
    await expect(treeItem(page, 'Today')).toHaveAttribute('aria-current', 'page')
    await expect(tree.locator('[tabindex="0"]')).toHaveCount(1)
    await expect(tree.locator('[tabindex="0"]')).toHaveAccessibleName(itemName('Today'))

    await treeItem(page, 'Today').focus()
    await page.keyboard.press('Home')
    await expect(learn).toBeFocused()
    await expect(learn).toHaveAttribute('tabindex', '0')
    await page.keyboard.press('End')
    await expect(treeItem(page, 'Settings')).toBeFocused()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowDown')
    await expect(treeItem(page, 'Tracks')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(learn).toBeFocused()

    await page.keyboard.press('ArrowLeft')
    await expect(learn).toHaveAttribute('aria-expanded', 'false')
    await expect(treeItem(page, 'Tracks')).toHaveCount(0)
    await page.keyboard.press('ArrowRight')
    await expect(learn).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('ArrowRight')
    const tracks = treeItem(page, 'Tracks')
    await expect(tracks).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(tracks).toHaveAttribute('aria-expanded', 'true')
    const firstTrack = treeItem(page, index.tracks[0][1])
    await expect(firstTrack).toHaveAttribute('aria-level', '3')
    await expect(firstTrack).toHaveAttribute('aria-setsize', String(index.tracks.length))
    await page.keyboard.press('ArrowRight')
    await expect(firstTrack).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(tracks).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(tracks).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('ArrowLeft')
    await expect(learn).toBeFocused()

    await page.keyboard.press('p')
    await expect(treeItem(page, 'Patterns')).toBeFocused()
    // Type-ahead keeps a 500ms buffer, so wait for it to clear before a new search.
    await page.waitForTimeout(600)
    await page.keyboard.type('sq')
    await expect(treeItem(page, 'SQL problems')).toBeFocused()

    const design = treeItem(page, 'Design')
    await design.focus()
    await page.keyboard.press('Enter')
    await expect(design).toHaveAttribute('aria-expanded', 'false')
    await expect(treeItem(page, 'Whiteboard')).toHaveCount(0)

    await treeItem(page, 'SQL problems').focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#sql$/)
    await expect(heading(page)).toBeFocused()
    await expect(treeItem(page, 'SQL problems')).toHaveAttribute('aria-current', 'page')

    await page.reload()
    await expect(treeItem(page, 'Design')).toHaveAttribute('aria-expanded', 'false')
    await expect(treeItem(page, 'Learn')).toHaveAttribute('aria-expanded', 'true')
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), NAV_KEY)
    expect(saved.expanded).not.toContain('design')

    await treeItem(page, 'Tracks').focus()
    await page.keyboard.press('*')
    for (const label of ['Tracks', 'Patterns', 'Field Guide']) await expect(treeItem(page, label)).toHaveAttribute('aria-expanded', 'true')
  })

  test('opens the branch for a deep link and marks the page and its path', async ({ page }) => {
    const [id, title, pattern] = index.problems[0]
    await open(page, `#code/${id}`)
    const row = treeItem(page, title)
    await expect(row).toHaveAttribute('aria-current', 'page')
    await expect(row).toHaveAttribute('aria-level', '4')
    await expect(row).toBeInViewport()
    await expect(treeItem(page, 'Coding problems')).toHaveAttribute('aria-expanded', 'true')
    await expect(treeItem(page, 'Coding problems')).toHaveClass(/\bin-path\b/)
    await expect(treeItem(page, pattern)).toHaveClass(/\bin-path\b/)
    await expect(treeItem(page, 'Practise')).toHaveClass(/\bin-path\b/)
    await expect(siteTree(page).locator('[tabindex="0"]')).toHaveAccessibleName(itemName(title))
    await row.click()
    await expect(page).toHaveURL(new RegExp(`#code/${id}$`))
  })

  test('clicking a chevron toggles a branch without navigating, and the sidebar collapses to a rail', async ({ page }) => {
    await open(page, '#home')
    const code = treeItem(page, 'Coding problems')
    await code.locator('.tree-chevron').click()
    await expect(code).toHaveAttribute('aria-expanded', 'true')
    await expect(page).toHaveURL(/#home$/)
    await expect(siteTree(page).getByRole('treeitem', { name: itemName(index.problems[0][2]) })).toBeVisible()

    const hide = page.getByRole('button', { name: 'Hide menu' })
    await expect(hide).toHaveAttribute('aria-expanded', 'true')
    await hide.click()
    await expect(siteTree(page)).toHaveCount(0)
    const show = page.getByRole('button', { name: 'Show menu' })
    await expect(show).toHaveAttribute('aria-expanded', 'false')
    await expect(show).toBeFocused()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Show menu' })).toBeVisible()
    expect(await page.evaluate(() => document.querySelector('main')!.getBoundingClientRect().left)).toBeLessThan(120)
    await page.getByRole('button', { name: 'Show menu' }).click()
    await expect(siteTree(page)).toBeVisible()
    await expect(treeItem(page, 'Coding problems')).toHaveAttribute('aria-expanded', 'true')
  })
})

test.describe('mobile sheets', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a group opens a modal sheet that traps focus and closes with Escape, backdrop or a link', async ({ page }) => {
    await open(page, '#home')
    await expect(siteTree(page)).toBeHidden()
    const me = sectionButton(page, 'Me')
    await expect(me).toHaveClass(/\bactive\b/)
    await expect(me).toHaveAccessibleName('Me, current section')
    const learn = sectionButton(page, 'Learn')
    await expect(learn).toHaveAttribute('aria-expanded', 'false')
    await learn.click()
    const dialog = sheet(page, 'Learn')
    await expect(dialog).toBeVisible()
    await expect(learn).toHaveAttribute('aria-expanded', 'true')
    await expect(dialog.getByRole('treeitem', { name: itemName('Tracks') })).toBeFocused()
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    }
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press('Shift+Tab')
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(learn).toBeFocused()
    await expect(learn).toHaveAttribute('aria-expanded', 'false')

    await learn.click()
    await expect(dialog).toBeVisible()
    await page.mouse.click(195, 20)
    await expect(dialog).toBeHidden()
    await expect(learn).toBeFocused()

    await sectionButton(page, 'Interview').click()
    await sheet(page, 'Interview').getByRole('button', { name: 'Close' }).click()
    await expect(sheet(page, 'Interview')).toBeHidden()
    await expect(sectionButton(page, 'Interview')).toBeFocused()

    await navTo(page, 'Practise')
    await expect(page).toHaveURL(/#practice$/)
    await expect(heading(page)).toHaveText('Practise')
    await expect(sectionButton(page, 'Practise')).toHaveClass(/\bactive\b/)

    const [id, title, pattern] = index.problems[0]
    await sectionButton(page, 'Practise').click()
    const practise = sheet(page, 'Practise')
    const code = practise.getByRole('treeitem', { name: itemName('Coding problems') })
    await code.focus()
    await page.keyboard.press('ArrowRight')
    await expect(code).toHaveAttribute('aria-expanded', 'true')
    await practise.getByRole('treeitem', { name: itemName(pattern) }).click()
    await practise.getByRole('treeitem', { name: itemName(title) }).click()
    await expect(practise).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`#code/${id}$`))
    await expect(heading(page)).toHaveText(title)
    await expect(crumbs(page).last()).toHaveText(title)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
})

test.describe('accessibility', () => {
  for (const width of [360, 768, 1440]) {
    for (const theme of ['light', 'dark']) {
      test(`axe finds no violations in the nav at ${width}px ${theme}`, async ({ page }) => {
        test.slow()
        await page.setViewportSize({ width, height: 900 })
        const [id] = index.problems[0]
        for (const hash of ['#home', '#practice', `#code/${id}`]) {
          await page.goto(`./?scoutTheme=${theme}${hash}`)
          await expect(heading(page)).toBeVisible()
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
          expect(await axe(page), `${hash} at ${width} ${theme}`).toEqual([])
        }
        if (width < 1024) {
          await sectionButton(page, 'Practise').click()
          const practise = sheet(page, 'Practise')
          await expect(practise).toBeVisible()
          await expect(practise.getByRole('treeitem', { name: itemName('Coding problems') })).toHaveAttribute('aria-expanded', 'true')
          // Axe's skip-link heuristic treats every in-page hash link as a skip link, so route rows scrolled
          // below the fold of a fixed-position modal sheet look like "off-screen skip links". They are routes.
          const sheetViolations = (await axe(page)).filter(violation => !(violation.id === 'skip-link' && violation.targets.every(target => /^a\[href\$="#[\w/:-]+"\]\[aria-level=/.test(target))))
          expect(sheetViolations, `sheet at ${width} ${theme}`).toEqual([])
        }
      })
    }
  }
})

test.describe('nav contrast', () => {
  for (const theme of ['light', 'dark']) {
    for (const accent of accents) {
      test(`nav text is readable in ${theme} ${accent.label}`, async ({ page }) => {
        await page.addInitScript(({ key, id }) => localStorage.setItem(key, id), { key: ACCENT_KEY, id: accent.id })
        const [id] = index.problems[0]
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 900 })
          await page.goto(`./?scoutTheme=${theme}#code/${id}`)
          await expect(heading(page)).toBeVisible()
          const checks = isDesktop(page)
            ? [siteTree(page).locator('.tree-row.active'), siteTree(page).locator('.tree-row.in-path').first(), siteTree(page).locator('.tree-row:not(.active):not(.in-path)').first(), siteTree(page).locator('.tree-count').first()]
            : [page.locator('.bottom-bar .nav-item.active'), page.locator('.bottom-bar .nav-item:not(.active)').first()]
          checks.push(page.locator('.breadcrumbs a').first(), page.locator('.breadcrumbs [aria-current="page"]'))
          for (const check of checks) expect(await textContrast(check), `${width} ${await check.evaluate(element => element.className || element.textContent)}`).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }
})
