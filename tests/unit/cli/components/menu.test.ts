import { expect, test, describe } from 'vitest'
import { Menu } from '../../../../src/cli/components/menu'

describe('Menu', () => {

  const sampleItems = [
    { name: '/help', value: 'help', description: 'Show help' },
    { name: '/quit', value: 'quit', description: 'Exit the app' },
    { name: '/clear', value: 'clear', description: 'Clear history' },
  ]

  describe('constructor', () => {
    test('default id is "menu"', () => {
      const menu = new Menu()
      expect(menu.id).toBe('menu')
    })

    test('custom id', () => {
      const menu = new Menu('custom-menu')
      expect(menu.id).toBe('custom-menu')
    })
  })

  describe('title', () => {
    test('setTitle updates title', () => {
      const menu = new Menu()
      menu.setTitle('Select command')
      expect(menu.getTitle()).toBe('Select command')
    })

    test('setTitle marks dirty', () => {
      const menu = new Menu()
      menu.clearDirty()

      menu.setTitle('New title')

      expect(menu.isDirty()).toBe(true)
    })

    test('setTitle same value does not mark dirty', () => {
      const menu = new Menu()
      menu.setTitle('Same')
      menu.clearDirty()

      menu.setTitle('Same')

      expect(menu.isDirty()).toBe(false)
    })
  })

  describe('items', () => {
    test('setItems updates items', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      expect(menu.getItems()).toEqual(sampleItems)
    })

    test('setItems resets selection to 0', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      menu.setSelectedIndex(2)
      menu.setItems([...sampleItems])
      expect(menu.getSelectedIndex()).toBe(0)
    })

    test('setItems marks dirty', () => {
      const menu = new Menu()
      menu.clearDirty()

      menu.setItems(sampleItems)

      expect(menu.isDirty()).toBe(true)
    })
  })

  describe('selection', () => {
    test('setSelectedIndex changes selection', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)

      menu.setSelectedIndex(1)

      expect(menu.getSelectedIndex()).toBe(1)
    })

    test('setSelectedIndex marks dirty', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      menu.clearDirty()

      menu.setSelectedIndex(1)

      expect(menu.isDirty()).toBe(true)
    })

    test('setSelectedIndex same value does not mark dirty', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      menu.clearDirty()

      menu.setSelectedIndex(0)

      expect(menu.isDirty()).toBe(false)
    })

    test('setSelectedIndex clamps to valid range', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)

      menu.setSelectedIndex(-1)
      expect(menu.getSelectedIndex()).toBe(0)

      menu.setSelectedIndex(100)
      expect(menu.getSelectedIndex()).toBe(0)
    })

    test('getSelectedItem returns selected item', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      menu.setSelectedIndex(1)

      expect(menu.getSelectedItem()).toEqual(sampleItems[1])
    })

    test('getSelectedItem returns null when empty', () => {
      const menu = new Menu()
      expect(menu.getSelectedItem()).toBeNull()
    })
  })

  describe('height calculation', () => {
    test('empty menu returns 1 (title only)', () => {
      const menu = new Menu()
      expect(menu.calculateHeight(80)).toBe(1)
    })

    test('height is title + items', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      // 1 title + 3 items = 4
      expect(menu.calculateHeight(80)).toBe(4)
    })

    test('respects maxVisibleItems', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      menu.setMaxVisibleItems(2)
      // 1 title + 2 visible items = 3
      expect(menu.calculateHeight(80)).toBe(3)
    })
  })

  describe('rendering', () => {
    test('renders title line', () => {
      const menu = new Menu()
      menu.setTitle('Pick one')
      const lines = menu.render(80)

      expect(lines[0]).toContain('Pick one')
    })

    test('renders items', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      const lines = menu.render(80)

      expect(lines.length).toBe(4) // title + 3 items
    })

    test('selected item has different prefix', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      menu.setSelectedIndex(1)
      const lines = menu.render(80)

      // Selected item should have › prefix
      expect(lines[2]).toContain('›')
      // Non-selected should not
      expect(lines[1]).not.toContain('›')
      expect(lines[3]).not.toContain('›')
    })

    test('includes description when present', () => {
      const menu = new Menu()
      menu.setItems(sampleItems)
      const lines = menu.render(80)

      expect(lines[1]).toContain('Show help')
    })

    test('truncates long items', () => {
      const menu = new Menu()
      menu.setItems([
        { name: '/longcommand', value: 'long', description: 'a'.repeat(200) }
      ])
      const lines = menu.render(50)

      // Should be truncated with ellipsis
      expect(lines[1].length).toBeLessThanOrEqual(56) // 50 - 6 margin + prefix
    })
  })
})
