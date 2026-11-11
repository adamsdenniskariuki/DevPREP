import { test, expect, render, screen, click, keyDown } from './testing'
import { Tabs } from './App'

const TABS = [
  { label: 'One', content: 'First panel' },
  { label: 'Two', content: 'Second panel' },
  { label: 'Three', content: 'Third panel' },
]

test('renders a labelled tablist with the first tab selected', async () => {
  await render(<Tabs label="Numbers" tabs={TABS} />)
  expect(screen.getByRole('tablist', { name: 'Numbers' })).toBeInTheDocument()
  const tabs = screen.getAllByRole('tab')
  expect(tabs).toHaveLength(3)
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  expect(tabs[0]).toHaveAttribute('tabindex', '0')
  expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
  expect(tabs[1]).toHaveAttribute('tabindex', '-1')
  expect(screen.getByRole('tabpanel')).toHaveTextContent('First panel')
})

test('each tab controls its panel', async () => {
  await render(<Tabs label="Numbers" tabs={TABS} />)
  const panel = screen.getByRole('tabpanel')
  expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-controls', panel.id)
})

test('clicking selects a tab and shows its panel', async () => {
  await render(<Tabs label="Numbers" tabs={TABS} />)
  await click(screen.getByRole('tab', { name: 'Two' }))
  expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Second panel')
})

test('arrow keys move selection and focus, wrapping around', async () => {
  await render(<Tabs label="Numbers" tabs={TABS} />)
  await keyDown(screen.getByRole('tab', { name: 'One' }), 'ArrowLeft')
  expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus()
  expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true')
  await keyDown(screen.getByRole('tab', { name: 'Three' }), 'ArrowRight')
  expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus()
})
