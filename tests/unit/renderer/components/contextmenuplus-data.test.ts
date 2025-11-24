import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import ContextMenuPlus from '@components/ContextMenuPlus.vue'
import type { MenuItem } from '@/types/menu'

// Helper to mount and wait for menu to render
async function mountMenu(items: MenuItem[]) {
  const wrapper = mount(ContextMenuPlus, {
    props: {
      items,
      mouseX: 100,
      mouseY: 100,
    },
    attachTo: document.body,
  })
  await nextTick()
  await nextTick() // Extra tick for position calculation
  return wrapper
}

describe('ContextMenuPlus - Data-Driven Mode', () => {

  let wrapper: any

  beforeEach(() => {
    // Clean up DOM before each test
    document.body.innerHTML = '<div id="app"></div>'
  })

  afterEach(() => {
    // Clean up after each test
    if (wrapper) {
      wrapper.unmount()
    }
  })

  it('renders simple menu items from data', async () => {
    const items: MenuItem[] = [
      { id: 'item1', label: 'First Item', onClick: () => {} },
      { id: 'item2', label: 'Second Item', onClick: () => {} },
    ]

    wrapper = await mountMenu(items)

    const menuItems = document.querySelectorAll('.context-menu .item')
    expect(menuItems.length).toBe(2)
    expect(menuItems[0].textContent).toContain('First Item')
    expect(menuItems[1].textContent).toContain('Second Item')
  })

  it('renders separator items', async () => {
    const items: MenuItem[] = [
      { id: 'item1', label: 'First Item', onClick: () => {} },
      { id: 'sep', type: 'separator' },
      { id: 'item2', label: 'Second Item', onClick: () => {} },
    ]

    wrapper = await mountMenu(items)

    const separators = document.querySelectorAll('.context-menu .separator')
    expect(separators.length).toBe(1)
  })

  it('renders checkbox items', async () => {
    const items: MenuItem[] = [
      { id: 'check1', label: 'Checkbox Item', type: 'checkbox', checked: true, onClick: () => {} },
      { id: 'check2', label: 'Unchecked Item', type: 'checkbox', checked: false, onClick: () => {} },
    ]

    wrapper = await mountMenu(items)

    const checkboxes = document.querySelectorAll('.context-menu input[type="checkbox"]')
    expect(checkboxes.length).toBe(2)
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true)
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false)
  })

  it('navigates to submenu when clicking item with submenu', async () => {
    const items: MenuItem[] = [
      {
        id: 'parent',
        label: 'Parent Item',
        submenu: [
          { id: 'child1', label: 'Child 1', onClick: () => {} },
          { id: 'child2', label: 'Child 2', onClick: () => {} },
        ],
      },
    ]

    wrapper = await mountMenu(items)

    // Should show parent item initially
    const contextMenu = document.querySelector('.context-menu')
    expect(contextMenu?.textContent).toContain('Parent Item')

    // Click the parent item
    const parentItem = document.querySelector('.context-menu .item') as HTMLElement
    parentItem.click()
    await nextTick()

    // Should now show submenu items
    expect(contextMenu?.textContent).toContain('Child 1')
    expect(contextMenu?.textContent).toContain('Child 2')
    expect(contextMenu?.textContent).not.toContain('Parent Item')
  })

  it('shows back button when in submenu', async () => {
    const items: MenuItem[] = [
      {
        id: 'parent',
        label: 'Parent Item',
        submenu: [
          { id: 'child1', label: 'Child 1', onClick: () => {} },
        ],
      },
    ]

    wrapper = await mountMenu(items)

    // No back button initially
    expect(document.querySelector('.context-menu .back-button')).toBeNull()

    // Navigate to submenu
    const parentItem = document.querySelector('.context-menu .item') as HTMLElement
    parentItem.click()
    await nextTick()

    // Back button should appear
    expect(document.querySelector('.context-menu .back-button')).not.toBeNull()
  })

  it('navigates back when clicking back button', async () => {
    const items: MenuItem[] = [
      {
        id: 'parent',
        label: 'Parent Item',
        submenu: [
          { id: 'child1', label: 'Child 1', onClick: () => {} },
        ],
      },
    ]

    wrapper = await mountMenu(items)

    const contextMenu = document.querySelector('.context-menu')

    // Navigate to submenu
    const parentItem = document.querySelector('.context-menu .item') as HTMLElement
    parentItem.click()
    await nextTick()

    expect(contextMenu?.textContent).toContain('Child 1')

    // Click back button
    const backButton = document.querySelector('.context-menu .back-button') as HTMLElement
    backButton.click()
    await nextTick()

    // Should be back to parent menu
    expect(contextMenu?.textContent).toContain('Parent Item')
    expect(contextMenu?.textContent).not.toContain('Child 1')
  })

  it('calls onClick handler when clicking regular item', async () => {
    let clicked = false
    const items: MenuItem[] = [
      {
        id: 'item1',
        label: 'Click Me',
        onClick: () => { clicked = true },
      },
    ]

    wrapper = await mountMenu(items)

    const item = document.querySelector('.context-menu .item') as HTMLElement
    item.click()
    await nextTick()

    expect(clicked).toBe(true)
  })

  it('renders footer items for submenus', async () => {
    const items: MenuItem[] = [
      {
        id: 'parent',
        label: 'Parent Item',
        submenu: [
          { id: 'child1', label: 'Child 1', onClick: () => {} },
        ],
        footer: [
          { id: 'footer1', label: 'Select All', onClick: () => {} },
          { id: 'footer2', label: 'Unselect All', onClick: () => {} },
        ],
      },
    ]

    wrapper = await mountMenu(items)

    // Navigate to submenu
    const parentItem = document.querySelector('.context-menu .item') as HTMLElement
    parentItem.click()
    await nextTick()

    // Check footer items appear
    const footer = document.querySelector('.context-menu .footer')
    expect(footer).not.toBeNull()
    expect(footer?.textContent).toContain('Select All')
    expect(footer?.textContent).toContain('Unselect All')
  })

  it('supports multi-level nesting', async () => {
    const items: MenuItem[] = [
      {
        id: 'level1',
        label: 'Level 1',
        submenu: [
          {
            id: 'level2',
            label: 'Level 2',
            submenu: [
              { id: 'level3', label: 'Level 3', onClick: () => {} },
            ],
          },
        ],
      },
    ]

    wrapper = await mountMenu(items)

    const contextMenu = document.querySelector('.context-menu')

    // Navigate through levels
    let item = document.querySelector('.context-menu .item') as HTMLElement
    item.click()
    await nextTick()
    expect(contextMenu?.textContent).toContain('Level 2')

    item = document.querySelector('.context-menu .item') as HTMLElement
    item.click()
    await nextTick()
    expect(contextMenu?.textContent).toContain('Level 3')

    // Navigate back twice
    let backButton = document.querySelector('.context-menu .back-button') as HTMLElement
    backButton.click()
    await nextTick()
    expect(contextMenu?.textContent).toContain('Level 2')

    backButton = document.querySelector('.context-menu .back-button') as HTMLElement
    backButton.click()
    await nextTick()
    expect(contextMenu?.textContent).toContain('Level 1')
  })

})

describe('ContextMenuPlus - Backward Compatibility (Slot-based)', () => {

  let wrapper: any

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  it('still works with slot-based rendering', async () => {
    wrapper = mount(ContextMenuPlus, {
      props: {
        mouseX: 100,
        mouseY: 100,
      },
      slots: {
        default: '<div class="item">Slot Item 1</div><div class="item">Slot Item 2</div>',
      },
      attachTo: document.body,
    })

    await nextTick()
    await nextTick() // Extra tick for position calculation

    const contextMenu = document.querySelector('.context-menu')
    expect(contextMenu?.textContent).toContain('Slot Item 1')
    expect(contextMenu?.textContent).toContain('Slot Item 2')
  })

})
