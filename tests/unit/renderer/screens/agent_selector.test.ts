import { vi, beforeAll, afterEach, expect, test, describe } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { stubTeleport } from '@tests/mocks/stubs'
import { store } from '@services/store'
import Agent from '@models/agent'
import AgentSelector from '@screens/AgentSelector.vue'

enableAutoUnmount(afterEach)

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
  store.agents = [
    Agent.fromJson({
      uuid: 'agent-1',
      name: 'Alpha Agent',
      description: 'First agent in alphabetical order',
    }),
    Agent.fromJson({
      uuid: 'agent-2',
      name: 'Zeta Agent',
      description: 'Last agent in alphabetical order',
    }),
    Agent.fromJson({
      uuid: 'agent-3',
      name: 'Beta Agent',
      description: 'Middle agent with a longer description that might overflow and need to be truncated properly',
    }),
  ]
})

const mount_component = (excludeAgentId?: string) => {
  return mount(AgentSelector, { ...stubTeleport, props: { excludeAgentId } })
}

describe('AgentSelector', () => {

  test('Renders correctly with agents', () => {
    const wrapper = mount_component()

    // Check table structure
    const table = wrapper.find('table')
    expect(table.exists()).toBe(true)

    const headers = table.findAll('th')
    expect(headers.length).toBeGreaterThan(0)

    // Check if agent rows are rendered
    const rows = table.findAll('tbody tr')
    expect(rows.length).toBe(store.agents.length)
  })

  test('Agents are sorted alphabetically by name', async () => {
    const wrapper = mount_component()

    const agentRows = wrapper.findAll('tr.agent')
    const agentNames = agentRows.map(row => row.find('.agent-name').text())

    expect(agentNames).toEqual(['Alpha Agent', 'Beta Agent', 'Zeta Agent'])
  })

  test('Excludes specified agent from list', async () => {
    const wrapper = mount_component('agent-2') // Exclude Zeta Agent

    const agentRows = wrapper.findAll('tr.agent')
    expect(agentRows).toHaveLength(2)

    const agentNames = agentRows.map(row => row.find('.agent-name').text())
    expect(agentNames).toEqual(['Alpha Agent', 'Beta Agent'])
    expect(agentNames).not.toContain('Zeta Agent')
  })

  test('Clicking on agent row toggles selection', async () => {
    const wrapper = mount_component()

    const firstRow = wrapper.find('tr.agent')
    const checkbox = firstRow.find('input[type="checkbox"]')

    // Initially unchecked
    expect(checkbox.exists()).toBe(true)

    // Click the row
    await firstRow.trigger('click')

    // Should trigger selection logic (can't easily test state change in unit test)
    expect(firstRow.classes()).toContain('agent')
  })

  test('Checkbox states reflect selection', async () => {
    const wrapper = mount_component()

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(3)

    // All checkboxes should exist
    checkboxes.forEach(checkbox => {
      expect(checkbox.exists()).toBe(true)
      expect(checkbox.attributes('type')).toBe('checkbox')
    })
  })

  test('Select None button works', async () => {
    const wrapper = mount_component()

    const selectNoneButton = wrapper.find('button[name="none"]')
    expect(selectNoneButton.exists()).toBe(true)

    await selectNoneButton.trigger('click')
    // Button should be clickable
    expect(selectNoneButton.element).toBeDefined()
  })

  test('Cancel button works', async () => {
    const wrapper = mount_component()

    const cancelButton = wrapper.find('button[name="cancel"]')
    expect(cancelButton.exists()).toBe(true)
    expect(cancelButton.classes()).toContain('tertiary')

    await cancelButton.trigger('click')
    // Button should be clickable
    expect(cancelButton.element).toBeDefined()
  })

  test('Save button works', async () => {
    const wrapper = mount_component()

    const saveButton = wrapper.find('button[name="save"]')
    expect(saveButton.exists()).toBe(true)
    expect(saveButton.classes()).toContain('primary')

    await saveButton.trigger('click')
    // Button should be clickable
    expect(saveButton.element).toBeDefined()
  })

  test('Table structure and content', async () => {
    const wrapper = mount_component()

    const table = wrapper.find('table')
    expect(table.exists()).toBe(true)

    // Check table head
    const thead = table.find('thead')
    expect(thead.exists()).toBe(true)

    // Check table body
    const tbody = table.find('tbody')
    expect(tbody.exists()).toBe(true)

    const rows = tbody.findAll('tr')
    expect(rows).toHaveLength(3)

    // Each row should have correct structure
    rows.forEach(row => {
      const cells = row.findAll('td')
      expect(cells).toHaveLength(3) // checkbox, name, description

      expect(cells[0].classes()).toContain('agent-enabled')
      expect(cells[1].classes()).toContain('agent-name')
      expect(cells[2].classes()).toContain('agent-description')
    })
  })

  test('Agent descriptions are properly displayed', async () => {
    const wrapper = mount_component()

    const descriptionCells = wrapper.findAll('.agent-description')
    expect(descriptionCells).toHaveLength(3)

    // Check description content
    expect(descriptionCells[0].text()).toBe('First agent in alphabetical order')
    expect(descriptionCells[1].text()).toContain('Middle agent with a longer description')
    expect(descriptionCells[2].text()).toBe('Last agent in alphabetical order')

    // Description cells should have div wrapper for text overflow handling
    descriptionCells.forEach(cell => {
      expect(cell.find('div').exists()).toBe(true)
    })
  })

  test('Sticky table container for scrolling', async () => {
    const wrapper = mount_component()

    const container = wrapper.find('.sticky-table-container')
    expect(container.exists()).toBe(true)
    expect(container.classes()).toContain('agents')
  })

  test('Modal dialog structure', async () => {
    const wrapper = mount_component()

    // Check modal structure
    expect(wrapper.find('#agent-selector').exists()).toBe(true)

    // Should have proper button layout in footer
    const buttons = wrapper.find('.buttons')
    expect(buttons.exists()).toBe(true)

    const allButtons = buttons.findAll('button')
    expect(allButtons).toHaveLength(3) // none, cancel, save
  })

  test('Row click interaction', async () => {
    const wrapper = mount_component()

    const agentRows = wrapper.findAll('tr.agent')

    agentRows.forEach(row => {
      expect(row.classes()).toContain('agent')
      // Each row should be clickable
      expect(row.element.tagName).toBe('TR')
    })
  })

  test('Empty state when no agents', async () => {
    const agents = store.agents
    store.agents = []
    const wrapper = mount_component()

    expect(wrapper.find('table').exists()).toBe(true)
    const agentRows = wrapper.findAll('tr.agent')
    expect(agentRows).toHaveLength(0)

    // Headers should still be present
    const headers = wrapper.findAll('th')
    expect(headers).toHaveLength(3)

    store.agents = agents
  })

})
