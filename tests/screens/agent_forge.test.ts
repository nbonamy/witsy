import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, beforeEach, expect, test, vi } from 'vitest'
import Dialog from '../../src/composables/dialog'
import AgentForge from '../../src/screens/AgentForge.vue'
import { store } from '../../src/services/store'
import { useWindowMock } from '../mocks/window'

// Mock the i18n service
vi.mock('../../src/services/i18n', () => ({
  t: (key: string) => key
}))

// Mock Dialog
vi.mock('../../src/composables/dialog', () => ({
  default: {
    show: vi.fn(),
    waitUntilClosed: vi.fn()
  }
}))

// Mock components
vi.mock('../../src/agent/List.vue', () => ({
  default: {
    name: 'List',
    props: ['agents'],
    emits: ['create', 'view', 'edit', 'run', 'delete', 'export', 'importA2A', 'importJson'],
    template: '<div class="list-mock"></div>'
  }
}))

vi.mock('../../src/agent/Editor.vue', () => ({
  default: {
    name: 'Editor',
    props: ['mode', 'agent'],
    emits: ['cancel', 'save'],
    template: '<div class="editor-mock"></div>'
  }
}))

vi.mock('../../src/agent/View.vue', () => ({
  default: {
    name: 'View',
    props: ['agent'],
    emits: ['run', 'edit', 'delete', 'close'],
    template: '<div class="view-mock"></div>'
  }
}))

vi.mock('../../src/components/PromptBuilder.vue', () => ({
  default: {
    name: 'PromptBuilder',
    props: ['title'],
    template: '<div class="prompt-builder-mock"></div>',
    methods: {
      show: vi.fn()
    }
  }
}))

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.agents = []
  store.loadAgents()

  // Override base64.decode to strip "_decoded" suffix that the mock adds
  window.api.base64.decode = (s: string) => {
    const result = `${s}_decoded`
    return result.endsWith('_decoded') ? result.slice(0, -8) : result
  }
})

test('Export agent calls file.save with correct JSON', async () => {
  const wrapper = mount(AgentForge)
  const agent = store.agents[0]

  // Trigger export
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('export', agent)
  await flushPromises()

  // Check that file.save was called
  expect(window.api.file.save).toHaveBeenCalled()
  const saveCall = vi.mocked(window.api.file.save).mock.calls[0][0]

  // Verify it's base64 encoded (mock appends "_encoded")
  expect(saveCall.contents).toMatch(/_encoded$/)

  // Decode and parse
  const jsonContent = saveCall.contents.replace(/_encoded$/, '')
  const exportedAgent = JSON.parse(jsonContent)

  // Verify exported data
  expect(exportedAgent.uuid).toBe(agent.uuid)
  expect(exportedAgent.name).toBe(agent.name)
  expect(exportedAgent.description).toBe(agent.description)
  expect(saveCall.properties.filename).toBe(`${agent.name}.json`)
  expect(saveCall.properties.prompt).toBe(true)
})

test('Import agent without conflict saves with original UUID', async () => {
  const wrapper = mount(AgentForge)

  // Create a new agent that doesn't exist - use JSON.parse(JSON.stringify()) to remove functions
  const newAgent = JSON.parse(JSON.stringify({
    uuid: 'new-unique-uuid',
    name: 'New Agent',
    description: 'A new agent',
    type: 'runnable',
    engine: 'openai',
    model: 'gpt-4',
    steps: [{ tools: [], agents: [] }]
  }))

  // Mock file picker to return this agent
  const fileContents = {
    url: 'file://test.json',
    mimeType: 'application/json',
    contents: JSON.stringify(newAgent)
  }
  vi.mocked(window.api.file.pickFile).mockReturnValue(fileContents)

  // Trigger import
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('importJson')
  await flushPromises()

  // Verify agent was saved with original UUID
  expect(window.api.agents.save).toHaveBeenCalled()
  const savedAgent = vi.mocked(window.api.agents.save).mock.calls[0][1]
  expect(savedAgent.uuid).toBe('new-unique-uuid')
  expect(savedAgent.name).toBe('New Agent')
})

test('Import agent with conflict shows dialog', async () => {
  const wrapper = mount(AgentForge)

  // Use existing agent UUID
  const existingAgent = store.agents[0]
  const importAgent = JSON.parse(JSON.stringify({
    uuid: existingAgent.uuid, // Same UUID - conflict!
    name: 'Imported Agent',
    description: 'Test',
    type: 'runnable',
    engine: 'openai',
    model: 'gpt-4',
    steps: [{ tools: [], agents: [] }]
  }))

  // Mock file picker
  const fileContents = {
    url: 'file://test.json',
    mimeType: 'application/json',
    contents: JSON.stringify(importAgent)
  }
  vi.mocked(window.api.file.pickFile).mockReturnValue(fileContents)

  // Mock user canceling the dialog
  vi.mocked(Dialog.show).mockResolvedValue({ isDismissed: true, isConfirmed: false, isDenied: false, value: null })

  // Trigger import
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('importJson')
  await flushPromises()

  // Verify dialog was shown
  expect(Dialog.show).toHaveBeenCalled()
  const dialogCall = vi.mocked(Dialog.show).mock.calls[0][0]
  expect(dialogCall.title).toBe('agent.forge.import.conflict.title')
  expect(dialogCall.showDenyButton).toBe(true)
  expect(dialogCall.showCancelButton).toBe(true)

  // Verify agent was NOT saved (user canceled)
  expect(window.api.agents.save).not.toHaveBeenCalled()
})

test('Import agent with conflict - user chooses overwrite', async () => {
  const wrapper = mount(AgentForge)

  // Use existing agent UUID
  const existingAgent = store.agents[0]
  const importAgent = JSON.parse(JSON.stringify({
    uuid: existingAgent.uuid,
    name: 'Imported Agent',
    description: 'Overwrite test',
    type: 'runnable',
    engine: 'openai',
    model: 'gpt-4',
    steps: [{ tools: [], agents: [] }]
  }))

  // Mock file picker
  const fileContents = {
    url: 'file://test.json',
    mimeType: 'application/json',
    contents: JSON.stringify(importAgent)
  }
  vi.mocked(window.api.file.pickFile).mockReturnValue(fileContents)

  // Mock user choosing overwrite (isConfirmed = true)
  vi.mocked(Dialog.show).mockResolvedValue({ isDismissed: false, isConfirmed: true, isDenied: false, value: null })

  // Trigger import
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('importJson')
  await flushPromises()

  // Verify agent was saved with SAME UUID
  expect(window.api.agents.save).toHaveBeenCalled()
  const savedAgent = vi.mocked(window.api.agents.save).mock.calls[0][1]
  expect(savedAgent.uuid).toBe(existingAgent.uuid) // Same UUID
  expect(savedAgent.name).toBe('Imported Agent')
  expect(savedAgent.description).toBe('Overwrite test')
})

test('Import agent with conflict - user chooses create new', async () => {
  const wrapper = mount(AgentForge)

  // Use existing agent UUID
  const existingAgent = store.agents[0]
  const importAgent = JSON.parse(JSON.stringify({
    uuid: existingAgent.uuid,
    name: 'Imported Agent',
    description: 'Test',
    type: 'runnable',
    engine: 'openai',
    model: 'gpt-4',
    createdAt: 1000,
    updatedAt: 1000,
    steps: [{ tools: [], agents: [] }]
  }))

  // Mock file picker
  const fileContents = {
    url: 'file://test.json',
    mimeType: 'application/json',
    contents: JSON.stringify(importAgent)
  }
  vi.mocked(window.api.file.pickFile).mockReturnValue(fileContents)

  // Mock user choosing create new (isDenied = true)
  vi.mocked(Dialog.show).mockResolvedValue({ isDismissed: false, isConfirmed: false, isDenied: true, value: null })

  // Trigger import
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('importJson')
  await flushPromises()

  // Verify agent was saved with NEW UUID
  expect(window.api.agents.save).toHaveBeenCalled()
  const savedAgent = vi.mocked(window.api.agents.save).mock.calls[0][1]
  expect(savedAgent.uuid).not.toBe(existingAgent.uuid) // Different UUID
  expect(savedAgent.name).toBe('Imported Agent')
  expect(savedAgent.createdAt).toBeGreaterThan(1000) // New timestamp
  expect(savedAgent.updatedAt).toBeGreaterThan(1000) // New timestamp
})

test('Import invalid JSON shows error dialog', async () => {
  const wrapper = mount(AgentForge)

  // Mock file picker with invalid JSON
  const fileContents = {
    url: 'file://test.json',
    mimeType: 'application/json',
    contents: '{ invalid json }'
  }
  vi.mocked(window.api.file.pickFile).mockReturnValue(fileContents)

  // Trigger import
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('importJson')
  await flushPromises()

  // Verify error dialog was shown
  expect(Dialog.show).toHaveBeenCalled()
  const dialogCall = vi.mocked(Dialog.show).mock.calls[0][0]
  expect(dialogCall.title).toBe('agent.forge.import.error.title')

  // Verify agent was NOT saved
  expect(window.api.agents.save).not.toHaveBeenCalled()
})

test('Import canceled when user dismisses file picker', async () => {
  const wrapper = mount(AgentForge)

  // Mock file picker returning null (user canceled)
  vi.mocked(window.api.file.pickFile).mockReturnValue(null)

  // Trigger import
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('importJson')
  await flushPromises()

  // Verify no dialogs shown and no agent saved
  expect(Dialog.show).not.toHaveBeenCalled()
  expect(window.api.agents.save).not.toHaveBeenCalled()
})
