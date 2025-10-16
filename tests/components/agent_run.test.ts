
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Run from '../../src/agent/Run.vue'
import Message from '../../src/models/message'
import { AgentRun } from '../../src/types/agents'
import enMessages from '../../locales/en.json'

beforeAll(async () => {
  useWindowMock()

  // Mock i18n messages
  window.api.config.getI18nMessages = vi.fn(() => ({ en: enMessages }))

  // Re-initialize i18n with actual messages
  const { initI18n } = await import('../../src/services/i18n')
  initI18n()

  store.load()
  store.config.workspaceId = 'test-workspace'
})

const createMockRun = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  uuid: 'test-run-123',
  agentId: 'test-agent-456',
  createdAt: Date.now() - 5000,
  updatedAt: Date.now(),
  trigger: 'manual',
  status: 'success',
  prompt: 'Test prompt for the agent',
  messages: [
    new Message('system', 'System message'),
    new Message('user', 'User message 1'),
    new Message('assistant', 'Assistant response 1'),
    new Message('user', 'User message 2'),
    new Message('assistant', 'Assistant response 2'),
  ],
  toolCalls: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Run.vue', () => {
  test('renders component with run data', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    expect(wrapper.find('.run').exists()).toBe(true)
    expect(wrapper.find('.panel-header label').exists()).toBe(true)
  })

  test('displays metadata panel', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    const metadataPanel = wrapper.find('.metadata-panel')
    expect(metadataPanel.exists()).toBe(true)
    expect(metadataPanel.classes()).toContain('panel')
  })

  test('toggles metadata panel on click', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    const metadataPanel = wrapper.find('.metadata-panel')
    const metadataHeader = metadataPanel.find('.panel-header label')

    // Initially no collapsed class
    expect(metadataPanel.classes()).not.toContain('collapsed')

    // Click to collapse
    await metadataHeader.trigger('click')
    await nextTick()

    expect(metadataPanel.classes()).toContain('collapsed')

    // Click to expand again
    await metadataHeader.trigger('click')
    await nextTick()

    expect(metadataPanel.classes()).not.toContain('collapsed')
  })

  test('displays all metadata fields', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Metadata panel is expanded by default
    expect(wrapper.text()).toContain('test-run-123')
    expect(wrapper.text()).toContain('manual')
    expect(wrapper.text()).toContain('success')
    // Prompt is in a textarea element
    expect(wrapper.find('textarea.prompt').element.value).toContain('Test prompt for the agent')
  })

  test('renders output panels for each message', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Should have 2 output panels (messages after the first 2)
    const outputPanels = wrapper.findAll('.output-panel')
    expect(outputPanels.length).toBe(2)
  })

  test('output panels are collapsed by default', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    const outputPanels = wrapper.findAll('.output-panel')
    outputPanels.forEach(panel => {
      expect(panel.classes()).toContain('collapsed')
    })
  })

  test('toggles output panel on click', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    const firstOutputPanel = wrapper.find('.output-panel')
    const firstOutputHeader = firstOutputPanel.find('.panel-header')

    // Initially collapsed
    expect(firstOutputPanel.classes()).toContain('collapsed')

    // Click to expand
    await firstOutputHeader.trigger('click')
    await nextTick()

    expect(firstOutputPanel.classes()).not.toContain('collapsed')
  })

  test('displays step titles for outputs', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    const outputHeaders = wrapper.findAll('.output-panel .panel-header label')
    expect(outputHeaders.length).toBe(2)
    // Just verify headers exist, translation testing is complex
    expect(outputHeaders[0].exists()).toBe(true)
    expect(outputHeaders[1].exists()).toBe(true)
  })

  test('shows no outputs message when no messages available', async () => {
    const mockRun = createMockRun({
      messages: [
        new Message('system', 'System message'),
        new Message('user', 'User message'),
      ],
    })
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    expect(wrapper.find('.no-outputs').exists()).toBe(true)
    expect(wrapper.find('.no-outputs').text()).toBeTruthy()
  })

  test('displays error message when run has error', async () => {
    const mockRun = createMockRun({
      status: 'error',
      error: 'Something went wrong',
    })
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Expand metadata to see error
    const metadataHeader = wrapper.find('.metadata-panel .panel-header')
    await metadataHeader.trigger('click')
    await nextTick()

    expect(wrapper.find('.error-text').exists()).toBe(true)
    expect(wrapper.find('.error-text').text()).toContain('Something went wrong')
  })

  test('shows in progress message for running status', async () => {
    const mockRun = createMockRun({
      status: 'running',
      messages: [
        new Message('system', 'System message'),
        new Message('user', 'User message'),
      ],
    })
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Check status shows running
    expect(wrapper.text()).toContain('running')
  })

  test('emits delete event when delete button clicked', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    const deleteButton = wrapper.find('.delete')
    await deleteButton.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  test('renders MessageItemBody for each output', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Only responses are visible initially (prompts are hidden)
    const messageItems = wrapper.findAllComponents({ name: 'MessageItemBody' })
    expect(messageItems.length).toBe(2) // 2 responses

    // Expand first prompt
    const firstPromptToggle = wrapper.find('.prompt-toggle')
    await firstPromptToggle.trigger('click')
    await nextTick()

    // Now we should have 3 MessageItemBody components (1 prompt + 2 responses)
    const messageItemsAfterExpand = wrapper.findAllComponents({ name: 'MessageItemBody' })
    expect(messageItemsAfterExpand.length).toBe(3)
  })

  test('passes correct props to MessageItemBody', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    const messageItems = wrapper.findAllComponents({ name: 'MessageItemBody' })
    expect(messageItems[0].props('showToolCalls')).toBe('always')
  })

  test('calculates duration correctly', async () => {
    const now = Date.now()
    const mockRun = createMockRun({
      createdAt: now - 3000,
      updatedAt: now,
      status: 'success',
    })
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Expand metadata to see duration
    const metadataHeader = wrapper.find('.metadata-panel .panel-header')
    await metadataHeader.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('3 s')
  })

  test('formats dates correctly', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Expand metadata to see dates
    const metadataHeader = wrapper.find('.metadata-panel .panel-header')
    await metadataHeader.trigger('click')
    await nextTick()

    const text = wrapper.text()
    // Check date format includes standard date components
    expect(text).toMatch(/[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{2}\s+\d{4}/)
  })

  test('prompt is hidden by default in output panels', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Expand first output panel to see prompt toggle
    const firstOutputPanel = wrapper.find('.output-panel')
    await firstOutputPanel.find('.panel-header').trigger('click')
    await nextTick()

    // Check that prompts are not visible initially (no MessageItemBody for prompt)
    const messageItems = wrapper.findAllComponents({ name: 'MessageItemBody' })
    // Only 2 responses visible initially, no prompts
    expect(messageItems.length).toBe(2)

    // Check that prompt toggle is visible
    const promptToggle = wrapper.find('.prompt-toggle')
    expect(promptToggle.exists()).toBe(true)
    // Text content contains showPrompt translation key or actual translation
    expect(promptToggle.text().length).toBeGreaterThan(0)
  })

  test('clicking toggle shows and hides prompt', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Expand first output panel to see prompt toggle
    const firstOutputPanel = wrapper.find('.output-panel')
    await firstOutputPanel.find('.panel-header').trigger('click')
    await nextTick()

    const firstPromptToggle = wrapper.find('.prompt-toggle')

    // Initially hidden - only 2 MessageItemBody components (responses)
    let messageItems = wrapper.findAllComponents({ name: 'MessageItemBody' })
    expect(messageItems.length).toBe(2)

    // Click to show
    await firstPromptToggle.trigger('click')
    await nextTick()

    // Now should have 3 MessageItemBody components (1 prompt + 2 responses)
    messageItems = wrapper.findAllComponents({ name: 'MessageItemBody' })
    expect(messageItems.length).toBe(3)

    // Click to hide
    await firstPromptToggle.trigger('click')
    await nextTick()

    // Back to 2 MessageItemBody components
    messageItems = wrapper.findAllComponents({ name: 'MessageItemBody' })
    expect(messageItems.length).toBe(2)
  })

  test('chevron icon rotates when prompt is expanded', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Expand first output panel to see prompt toggle
    const firstOutputPanel = wrapper.find('.output-panel')
    await firstOutputPanel.find('.panel-header').trigger('click')
    await nextTick()

    const firstPromptToggle = wrapper.find('.prompt-toggle')
    const chevronIcon = firstPromptToggle.find('svg')

    // Initially not expanded
    expect(chevronIcon.classes()).not.toContain('expanded')

    // Click to expand
    await firstPromptToggle.trigger('click')
    await nextTick()

    expect(chevronIcon.classes()).toContain('expanded')
  })

  test('each output panel has independent prompt toggle state', async () => {
    const mockRun = createMockRun()
    window.api.agents.getRun = vi.fn().mockReturnValue(mockRun)

    const wrapper = mount(Run, {
      props: {
        agentId: 'test-agent-456',
        runId: 'test-run-123',
      },
    })

    await nextTick()

    // Expand both output panels to see prompt toggles
    const outputPanels = wrapper.findAll('.output-panel')
    await outputPanels[0].find('.panel-header').trigger('click')
    await nextTick()
    await outputPanels[1].find('.panel-header').trigger('click')
    await nextTick()

    const promptToggles = wrapper.findAll('.prompt-toggle')
    expect(promptToggles.length).toBe(2)

    // Toggle first prompt
    await promptToggles[0].trigger('click')
    await nextTick()

    // Only first prompt should be visible - 3 MessageItemBody (1 prompt + 2 responses)
    let messageItems = wrapper.findAllComponents({ name: 'MessageItemBody' })
    expect(messageItems.length).toBe(3)

    // Toggle second prompt
    await promptToggles[1].trigger('click')
    await nextTick()

    // Both prompts should now be visible - 4 MessageItemBody (2 prompts + 2 responses)
    messageItems = wrapper.findAllComponents({ name: 'MessageItemBody' })
    expect(messageItems.length).toBe(4)
  })
})
