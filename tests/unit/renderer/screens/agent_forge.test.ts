import { flushPromises, mount, VueWrapper } from '@vue/test-utils'
import { beforeAll, beforeEach, expect, test, vi } from 'vitest'
import Dialog from '@renderer/utils/dialog'
import AgentForge from '@screens/AgentForge.vue'
import { store } from '@services/store'
import { useWindowMock } from '@tests/mocks/window'

// Mock the i18n service
vi.mock('@services/i18n', () => ({
  t: (key: string) => {
    if (key === 'agent.copySuffix') return 'Copy'
    return key
  }
}))

// Mock Dialog
vi.mock('@renderer/utils/dialog', () => ({
  default: {
    show: vi.fn(),
    waitUntilClosed: vi.fn()
  }
}))

// Mock components
vi.mock('@renderer/agent/List.vue', () => ({
  default: {
    name: 'List',
    props: ['agents'],
    emits: ['create', 'view', 'edit', 'run', 'delete', 'duplicate', 'export', 'importA2A', 'importJson'],
    template: '<div class="list-mock"></div>'
  }
}))

vi.mock('@renderer/agent/Editor.vue', () => ({
  default: {
    name: 'Editor',
    props: ['mode', 'agent'],
    emits: ['cancel', 'save'],
    template: '<div class="editor-mock"></div>'
  }
}))

vi.mock('@renderer/agent/View.vue', () => ({
  default: {
    name: 'View',
    props: ['agent'],
    emits: ['run', 'edit', 'delete', 'close'],
    template: '<div class="view-mock"></div>'
  }
}))

vi.mock('@components/PromptBuilder.vue', () => ({
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
  const wrapper: VueWrapper<any> = mount(AgentForge)
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
  expect(saveCall?.properties?.filename).toBe(`${agent.name}.json`)
  expect(saveCall?.properties?.prompt).toBe(true)
})

test('Import agent without conflict saves with original UUID', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)

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
  const wrapper: VueWrapper<any> = mount(AgentForge)

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
  const wrapper: VueWrapper<any> = mount(AgentForge)

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
  const wrapper: VueWrapper<any> = mount(AgentForge)

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
  const wrapper: VueWrapper<any> = mount(AgentForge)

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
  const wrapper: VueWrapper<any> = mount(AgentForge)

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

test('Duplicates agent when duplicate event is emitted', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const originalAgent = store.agents[0]
  const originalUuid = originalAgent.uuid
  const originalName = originalAgent.name

  // Trigger duplicate from list
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('duplicate', originalAgent)
  await flushPromises()

  // Verify save was called with duplicated agent
  expect(window.api.agents.save).toHaveBeenCalledTimes(1)
  const savedAgent = vi.mocked(window.api.agents.save).mock.calls[0][1]

  // Verify duplicated agent has different UUID
  expect(savedAgent.uuid).not.toBe(originalUuid)

  // Verify duplicated agent has " - Copy" suffix
  expect(savedAgent.name).toBe(`${originalName} - Copy`)

  // Verify other properties are copied
  expect(savedAgent.description).toBe(originalAgent.description)
  expect(savedAgent.type).toBe(originalAgent.type)
  expect(savedAgent.engine).toBe(originalAgent.engine)
  expect(savedAgent.model).toBe(originalAgent.model)

  // Verify store.loadAgents was called
  expect(store.agents.length).toBeGreaterThan(0)
})

test('Duplicated agent has new timestamps', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const originalAgent = store.agents[0]
  const originalCreatedAt = originalAgent.createdAt

  // Wait a bit to ensure different timestamps
  await new Promise(resolve => setTimeout(resolve, 10))

  // Trigger duplicate from list
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('duplicate', originalAgent)
  await flushPromises()

  // Verify save was called
  const savedAgent = vi.mocked(window.api.agents.save).mock.calls[0][1]

  // Verify timestamps are different (or at least not older)
  expect(savedAgent.createdAt).toBeGreaterThanOrEqual(originalCreatedAt)
  expect(savedAgent.updatedAt).toBeGreaterThanOrEqual(originalCreatedAt)
})

test('Duplicated agent has no runs attached', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const originalAgent = store.agents[0]

  // Mock getRuns to return runs for original agent
  vi.mocked(window.api.agents.getRuns).mockImplementation((workspaceId: string, agentId: string) => {
    if (agentId === originalAgent.uuid) {
      return [{
        uuid: 'run-1',
        agentId: originalAgent.uuid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        trigger: 'manual',
        status: 'success',
        prompt: 'Test prompt',
        messages: [],
        toolCalls: []
      }]
    }
    return []
  })

  // Verify original agent has runs
  const originalRuns = window.api.agents.getRuns(store.config.workspaceId, originalAgent.uuid)
  expect(originalRuns).toHaveLength(1)

  // Trigger duplicate from list
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('duplicate', originalAgent)
  await flushPromises()

  // Get the duplicated agent
  const savedAgent = vi.mocked(window.api.agents.save).mock.calls[0][1]

  // Verify duplicated agent has different UUID
  expect(savedAgent.uuid).not.toBe(originalAgent.uuid)

  // Verify duplicated agent has no runs (getRuns returns empty array for new UUID)
  const duplicatedRuns = window.api.agents.getRuns(store.config.workspaceId, savedAgent.uuid)
  expect(duplicatedRuns).toHaveLength(0)
})

test('Create agent transitions to create mode', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  expect(wrapper.vm.mode).toBe('list')

  // Trigger create
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('create')
  await flushPromises()

  expect(wrapper.vm.mode).toBe('create')
  expect(wrapper.vm.selected).not.toBeNull()
  expect(wrapper.vm.selected.type).toBe('runnable')
})

test('Create agent uses workspace model if available', async () => {
  // Setup workspace with models
  store.workspace.models = [{ engine: 'anthropic', id: 'claude-3', model: 'claude-3' }]

  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  // Trigger create
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('create')
  await flushPromises()

  expect(wrapper.vm.selected.engine).toBe('anthropic')
  expect(wrapper.vm.selected.model).toBe('claude-3')

  // Cleanup
  store.workspace.models = []
})

test('View agent transitions to view mode', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const agent = store.agents[0]

  // Trigger view
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('view', agent)
  await flushPromises()

  expect(wrapper.vm.mode).toBe('view')
  expect(wrapper.vm.selected).toBe(agent)
})

test('Edit agent transitions to edit mode', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const agent = store.agents[0]

  // Trigger edit
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('edit', agent)
  await flushPromises()

  expect(wrapper.vm.mode).toBe('edit')
  expect(wrapper.vm.selected).toBe(agent)
})

test('Delete agent shows confirmation dialog', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const agent = store.agents[0]

  // Mock dialog to cancel
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true, value: null })

  // Trigger delete
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('delete', agent)
  await flushPromises()

  // Dialog should be shown
  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    title: 'agent.forge.confirmDelete',
    showCancelButton: true
  }))

  // Agent should NOT be deleted (user cancelled)
  expect(window.api.agents.delete).not.toHaveBeenCalled()
})

test('Delete agent confirms and deletes', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const agent = store.agents[0]

  // Mock dialog to confirm
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false, value: null })

  // Trigger delete
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('delete', agent)
  await flushPromises()

  // Agent should be deleted
  expect(window.api.agents.delete).toHaveBeenCalledWith(store.config.workspaceId, agent.uuid)
})

test('Editor cancel returns to list mode', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  // Go to create mode first
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('create')
  await flushPromises()

  expect(wrapper.vm.mode).toBe('create')

  // Cancel from editor
  const editorComponent = wrapper.findComponent({ name: 'Editor' })
  editorComponent.vm.$emit('cancel')
  await flushPromises()

  expect(wrapper.vm.mode).toBe('list')
})

test('Editor save reloads agents and returns to list', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  // Go to create mode first
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('create')
  await flushPromises()

  // Save from editor
  const editorComponent = wrapper.findComponent({ name: 'Editor' })
  editorComponent.vm.$emit('save')
  await flushPromises()

  expect(wrapper.vm.mode).toBe('list')
})

test('View close returns to list mode', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const agent = store.agents[0]

  // Go to view mode
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('view', agent)
  await flushPromises()

  expect(wrapper.vm.mode).toBe('view')

  // Close view
  const viewComponent = wrapper.findComponent({ name: 'View' })
  viewComponent.vm.$emit('close')
  await flushPromises()

  expect(wrapper.vm.mode).toBe('list')
})

test('View edit transitions to edit mode', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const agent = store.agents[0]

  // Go to view mode
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('view', agent)
  await flushPromises()

  // Edit from view
  const viewComponent = wrapper.findComponent({ name: 'View' })
  viewComponent.vm.$emit('edit', agent)
  await flushPromises()

  expect(wrapper.vm.mode).toBe('edit')
})

test('View delete shows dialog and returns to list', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  await flushPromises()

  const agent = store.agents[0]

  // Go to view mode
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('view', agent)
  await flushPromises()

  // Mock dialog to confirm
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false, value: null })

  // Delete from view
  const viewComponent = wrapper.findComponent({ name: 'View' })
  viewComponent.vm.$emit('delete', agent)
  await flushPromises()

  expect(window.api.agents.delete).toHaveBeenCalled()
  expect(wrapper.vm.mode).toBe('list')
})

test('Import with warnings shows warning dialog', async () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)

  // Create agent with MCP tools that will trigger warnings
  const agentWithMcpTools = JSON.parse(JSON.stringify({
    uuid: 'new-uuid-with-tools',
    name: 'Agent With Tools',
    description: 'Test',
    type: 'runnable',
    engine: 'openai',
    model: 'gpt-4',
    steps: [{
      tools: ['unknown_tool___server1'],
      agents: []
    }]
  }))

  // Mock file picker
  const fileContents = {
    url: 'file://test.json',
    mimeType: 'application/json',
    contents: JSON.stringify(agentWithMcpTools)
  }
  vi.mocked(window.api.file.pickFile).mockReturnValue(fileContents)

  // Mock Dialog.show to track calls
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false, value: null })

  // Trigger import
  const listComponent = wrapper.findComponent({ name: 'List' })
  listComponent.vm.$emit('importJson')
  await flushPromises()

  // Agent should be saved
  expect(window.api.agents.save).toHaveBeenCalled()
})

test('Running agent creates AbortController', () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  const agent = store.agents[0]

  // Initially no abort controller
  expect(wrapper.vm.abortController).toBeNull()

  // Start running agent
  wrapper.vm.runAgent(agent, {})

  // AbortController should be created
  expect(wrapper.vm.abortController).not.toBeNull()
  expect(wrapper.vm.abortController).toBeInstanceOf(AbortController)
})

test('Stop agent calls abort and clears state', () => {
  const wrapper: VueWrapper<any> = mount(AgentForge)
  const agent = store.agents[0]

  // Start running agent
  wrapper.vm.runAgent(agent, {})
  expect(wrapper.vm.running).toBe(agent)
  expect(wrapper.vm.abortController).not.toBeNull()

  const abortSpy = vi.spyOn(wrapper.vm.abortController, 'abort')

  // Stop agent
  wrapper.vm.stopAgent()

  // Should call abort
  expect(abortSpy).toHaveBeenCalled()

  // Should clear state
  expect(wrapper.vm.running).toBeNull()
  expect(wrapper.vm.abortController).toBeNull()
})
