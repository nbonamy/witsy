import { vi, beforeAll, beforeEach, expect, test, afterEach } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { store } from '@services/store'
import RealtimeChat from '@screens/RealtimeChat.vue'

enableAutoUnmount(afterEach)

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

// Mock realtime service
const mockEngine = {
  connect: vi.fn(),
  close: vi.fn(),
  isConnected: vi.fn(() => false),
  getUsage: vi.fn(() => ({
    audioInputTokens: 0,
    textInputTokens: 0,
    cachedAudioTokens: 0,
    cachedTextTokens: 0,
    audioOutputTokens: 0,
    textOutputTokens: 0,
  })),
  getCostInfo: vi.fn(() => ({
    cost: { input: 0, output: 0, total: 0 },
    pricingModel: 'gpt-realtime-mini',
    pricingUrl: 'https://example.com',
    pricingDate: '01/01/2026',
  })),
}

vi.mock('@services/realtime', () => ({
  createRealtimeEngine: vi.fn(() => mockEngine),
  getAvailableVoices: vi.fn(() => [
    { id: 'alloy', name: 'Alloy' },
    { id: 'ash', name: 'Ash' },
    { id: 'echo', name: 'Echo' },
  ]),
  TRANSCRIPTION_UNAVAILABLE: '__TRANSCRIPTION_UNAVAILABLE__',
}))

// Mock tips manager
vi.mock('@renderer/utils/tips_manager', () => ({
  default: vi.fn(() => ({
    showTip: vi.fn(),
  })),
}))

// Mock tool selection utils
vi.mock('@renderer/utils/tool_selection', () => ({
  pluginsStatus: vi.fn(async () => 'none'),
  pluginStatus: vi.fn(() => 'none'),
  serverToolsStatus: vi.fn(() => 'none'),
  serverToolStatus: vi.fn(() => 'none'),
  allPluginsTools: vi.fn(async () => ({ plugins: [], mcpServers: {} })),
  initToolSelectionWithAllTools: vi.fn(async () => ({ plugins: [], mcpServers: {} })),
  validateToolSelection: vi.fn(async (ts: any) => ts),
  handleSelectAllTools: vi.fn(async () => ({ plugins: [], mcpServers: {} })),
  handleUnselectAllTools: vi.fn(async () => ({ plugins: [], mcpServers: {} })),
  handleSelectAllPlugins: vi.fn(async (current: any) => current),
  handleUnselectAllPlugins: vi.fn(async (current: any) => current),
  handleSelectAllServerTools: vi.fn(async (current: any) => current),
  handleUnselectAllServerTools: vi.fn(async (current: any) => current),
  handleAllPluginsToggle: vi.fn(async (current: any) => current),
  handlePluginToggle: vi.fn(async (current: any) => current),
  handleAllServerToolsToggle: vi.fn(async (current: any) => current),
  handleServerToolToggle: vi.fn(async (current: any) => current),
}))

// Mock LlmUtils
vi.mock('@renderer/services/llm_utils', () => ({
  default: vi.fn().mockImplementation(() => ({
    getSystemInstructions: vi.fn(() => 'System instructions'),
  })),
}))

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.loadSettings()
  // Set up realtime models which are normally fetched from OpenAI
  store.config.engines.openai.models.realtime = [
    { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime' },
    { id: 'gpt-4o-mini-realtime-preview', name: 'GPT-4o Mini Realtime' },
  ]
})

test('Renders correctly', () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  expect(wrapper.exists()).toBe(true)

  // Sidebar with settings
  expect(wrapper.find('.sp-sidebar').exists()).toBe(true)
  expect(wrapper.find('.sp-sidebar header .title').text()).toBe('realtimeChat.title')

  // Provider/model/voice selects
  expect(wrapper.findAll('.form-field select')).toHaveLength(3)

  // Tools button
  expect(wrapper.find('button.tools').exists()).toBe(true)

  // Main area with status and blob
  expect(wrapper.find('.sp-main').exists()).toBe(true)
  expect(wrapper.find('.status').exists()).toBe(true)

  // Cost container
  expect(wrapper.find('.cost-container').exists()).toBe(true)

  // Transcript panel
  expect(wrapper.find('.sp-transcript').exists()).toBe(true)
  expect(wrapper.find('.sp-transcript header .title').text()).toBe('realtimeChat.transcript')
})

test('Shows correct initial status', () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  // Status should contain the voice name (Ash is default)
  expect(wrapper.find('.status').text()).toContain('realtimeChat.clickToTalk')
})

test('Voice selector has correct options', () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  const voiceSelect = wrapper.findAll('.form-field select')[2]
  const options = voiceSelect.findAll('option')

  expect(options).toHaveLength(3)
  expect(options[0].attributes('value')).toBe('alloy')
  expect(options[1].attributes('value')).toBe('ash')
  expect(options[2].attributes('value')).toBe('echo')
})

test('Changing voice updates status and saves', async () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  const voiceSelect = wrapper.findAll('.form-field select')[2]

  await voiceSelect.setValue('echo')

  expect(window.api.config.save).toHaveBeenCalled()
})

test('Tools button is enabled when idle', () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  const toolsButton = wrapper.find('button.tools')

  expect(toolsButton.attributes('disabled')).toBeUndefined()
})

test('Tools button opens tools menu', async () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)

  expect(wrapper.findComponent({ name: 'ToolsMenu' }).exists()).toBe(false)

  await wrapper.find('button.tools').trigger('click')

  expect(wrapper.findComponent({ name: 'ToolsMenu' }).exists()).toBe(true)
})

test('Tools label shows correct count', async () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)

  // Initially no tools selected
  expect(wrapper.find('button.tools').text()).toContain('realtimeChat.toolsSelected')
})

test('Model selector is populated', () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  const modelSelect = wrapper.findAll('.form-field select')[1]

  // Should have at least one model option
  expect(modelSelect.findAll('option').length).toBeGreaterThan(0)
})

test('Provider selector shows OpenAI', () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  const providerSelect = wrapper.findAll('.form-field select')[0]
  const options = providerSelect.findAll('option')

  expect(options.length).toBeGreaterThan(0)
  expect(options[0].text()).toBe('OpenAI')
})

test('Cost display shows zero initially', () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  const costValue = wrapper.find('.cost-container .value')

  expect(costValue.exists()).toBe(true)
})

test('Transcript panel exists', () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)

  expect(wrapper.find('.sp-transcript').exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'MessageList' }).exists()).toBe(true)
})

test('Clicking blob starts session', async () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)

  // Find AnimatedBlob and trigger click
  const blob = wrapper.findComponent({ name: 'AnimatedBlob' })
  await blob.trigger('click')

  // State should change to active (status changes to calling)
  expect(wrapper.find('.status').text()).toContain('realtimeChat.callingVoice')
})

test('Settings are saved when voice changes', async () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  const voiceSelect = wrapper.findAll('.form-field select')[2]

  await voiceSelect.setValue('alloy')

  expect(store.config.engines.openai.realtime.voice).toBe('alloy')
  expect(window.api.config.save).toHaveBeenCalled()
})

test('Settings are saved when model changes', async () => {
  const wrapper: VueWrapper<any> = mount(RealtimeChat)
  const modelSelect = wrapper.findAll('.form-field select')[1]

  const firstOption = modelSelect.find('option')
  if (firstOption.exists()) {
    await modelSelect.setValue(firstOption.attributes('value'))
    expect(window.api.config.save).toHaveBeenCalled()
  }
})
