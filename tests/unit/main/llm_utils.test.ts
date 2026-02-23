import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { defaultCapabilities } from 'multi-llm-ts'
import { useWindowMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { store } from '@services/store'
import LlmUtils from '@services/llm_utils'
import Message from '@models/message'
import LlmMock, { installMockModels } from '@tests/mocks/llm'
import LlmManager from '@services/llms/manager'

vi.mock('@services/llms/manager.ts', async () => {
  const LlmManager = vi.fn()
  LlmManager.prototype.initModels = vi.fn()
  LlmManager.prototype.isEngineReady = vi.fn(() => true)
  LlmManager.prototype.isEngineConfigured = vi.fn(() => true)
  LlmManager.prototype.getEngineName = () => 'mock'
  LlmManager.prototype.getCustomEngines = () => []
  LlmManager.prototype.getFavoriteId = () => 'favid'
  LlmManager.prototype.getChatModels = vi.fn(() => [{ id: 'chat', name: 'chat', ...defaultCapabilities }])
  LlmManager.prototype.getChatModel = vi.fn((engine: string, model: string) => {
    if (model === 'chat') return { id: 'chat', name: 'chat', ...defaultCapabilities }
    if (model === 'gpt-5-nano') return { id: 'gpt-5-nano', name: 'GPT-5 nano', ...defaultCapabilities }
    if (model === 'claude-haiku-4-5') return { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', ...defaultCapabilities }
    return null
  })
  LlmManager.prototype.getDefaultChatModel = vi.fn(() => 'chat')
  LlmManager.prototype.getChatEngineModel = () => ({ engine: 'mock', model: 'chat' })
  LlmManager.prototype.igniteEngine = vi.fn(() => new LlmMock(store.config.engines.mock))
  LlmManager.prototype.isComputerUseModel = vi.fn(() => false)
  LlmManager.prototype.checkModelsCapabilities = vi.fn()
  LlmManager.prototype.loadTools = vi.fn()
  return { default: LlmManager }
})

vi.mock('@services/i18n', async () => {
  return createI18nMock(() => ({
    locale: store.config.llm.locale
  }))
})

let llmUtils: LlmUtils

beforeAll(() => {
  useWindowMock({ noAdditionalInstructions: true })
  store.loadExperts()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  store.loadSettings()
  store.config.general.locale = 'en-US'
  store.config.llm.locale = 'fr-FR'
  store.config.llm.forceLocale = false
  store.config.llm.engine = 'mock'
  store.config.llm.instructions = 'standard'
  // @ts-expect-error mocking
  store.config.instructions = {}
  installMockModels()

  // disable all additional instructions
  for (const key of Object.keys(store.config.llm.additionalInstructions)) {
    // @ts-expect-error partial mock
    store.config.llm.additionalInstructions[key] = false
  }

  // Reset LlmManager mocks to default behavior
  vi.mocked(LlmManager).prototype.isEngineReady = vi.fn(() => true)
  vi.mocked(LlmManager).prototype.getChatModel = vi.fn((engine: string, model: string) => {
    if (model === 'chat') return { id: 'chat', name: 'chat', ...defaultCapabilities }
    if (model === 'gpt-5-nano') return { id: 'gpt-5-nano', name: 'GPT-5 nano', ...defaultCapabilities }
    if (model === 'claude-haiku-4-5') return { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', ...defaultCapabilities }
    return null
  })

  llmUtils = new LlmUtils(store.config)
})

// ============================================================================
// parseJson Tests
// ============================================================================

test('LlmUtils.parseJson with valid content', () => {
  const validJson = '{"sections": [{"title": "Test"}]}'
  const result = LlmUtils.parseJson(validJson)
  expect(result).toEqual({ sections: [{ title: 'Test' }] })
})

test('LlmUtils.parseJson with extra content before and after', () => {
  const jsonWithExtra = 'Some text before {"sections": [{"title": "Test"}]} some text after'
  const result = LlmUtils.parseJson(jsonWithExtra)
  expect(result).toEqual({ sections: [{ title: 'Test' }] })
})

test('LlmUtils.parseJson with invalid content', () => {
  const invalidJson = 'No JSON here'
  expect(() => LlmUtils.parseJson(invalidJson)).toThrow('No JSON object found in content')
})

test('LlmUtils.parseJson with no opening brace', () => {
  const noOpening = 'some text without opening brace }'
  expect(() => LlmUtils.parseJson(noOpening)).toThrow('No JSON object found in content')
})

test('LlmUtils.parseJson with no closing brace', () => {
  const noClosing = '{ "key": "value" without closing'
  expect(() => LlmUtils.parseJson(noClosing)).toThrow('No JSON object found in content')
})

test('LlmUtils.parseJson with nested objects', () => {
  const nested = 'prefix {"outer": {"inner": {"value": 42}}} suffix'
  const result = LlmUtils.parseJson(nested)
  expect(result).toEqual({ outer: { inner: { value: 42 } } })
})

// ============================================================================
// getSystemInstructions Tests
// ============================================================================

test('getSystemInstructions with default standard instructions', () => {
  store.config.llm.locale = ''
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.chat.standard_en-US')
  expect(instructions).not.toContain('instructions.utils.setLang')
})

test('getSystemInstructions with structured instructions', () => {
  store.config.llm.instructions = 'structured'
  store.config.llm.locale = ''
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.chat.structured_en-US')
})

test('getSystemInstructions with custom parameter', () => {
  const custom = 'You are a helpful assistant'
  const instructions = llmUtils.getSystemInstructions(custom)
  expect(instructions).toBe(custom)
})

test('getSystemInstructions with custom instruction ID', () => {
  store.config.llm.customInstructions = [
    {
      id: 'custom1',
      label: 'Custom Instruction',
      instructions: 'You are a test assistant'
    }
  ]
  store.config.llm.instructions = 'custom1'
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toBe('You are a test assistant')
})

test('getSystemInstructions with non-existent custom instruction ID', () => {
  store.config.llm.customInstructions = []
  store.config.llm.instructions = 'custom1'
  store.config.llm.locale = ''
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.chat.custom1_en-US')
})

test('getSystemInstructions with noMarkdown modifier', () => {
  store.config.llm.locale = ''
  const instructions = llmUtils.getSystemInstructions(undefined, { noMarkdown: true })
  expect(instructions).toContain('instructions.chat.standard_en-US')
  expect(instructions).toContain('instructions.capabilities.noMarkdown_en-US')
})

test('getSystemInstructions with forceLocale enabled', () => {
  store.config.llm.locale = 'fr-FR'
  store.config.llm.forceLocale = true
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.chat.standard_fr-FR')
  expect(instructions).toContain('instructions.utils.setLang_fr-FR')
})

test('getSystemInstructions with forceLocale but unknown locale', () => {
  store.config.llm.locale = 'xx-XX'
  store.config.llm.forceLocale = true
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.chat.standard_xx-XX')
  // Unknown locales return empty string, so no setLang added
  expect(instructions).not.toContain('instructions.utils.setLang')
})

test('getSystemInstructions with toolRetry capability', () => {
  store.config.llm.additionalInstructions.toolRetry = true
  store.config.llm.locale = ''
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.chat.standard_en-US')
  expect(instructions).toContain('instructions.capabilities.toolRetry_en-US')
})

test('getSystemInstructions with mermaid capability', () => {
  store.config.llm.additionalInstructions.mermaid = true
  store.config.llm.locale = ''
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.chat.standard_en-US')
  expect(instructions).toContain('instructions.capabilities.mermaid_en-US')
})

test('getSystemInstructions with artifacts capability', () => {
  store.config.llm.additionalInstructions.artifacts = true
  store.config.llm.locale = ''
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.chat.standard_en-US')
  expect(instructions).toContain('instructions.capabilities.artifacts_en-US')
})

test('getSystemInstructions with datetime capability', () => {
  store.config.llm.additionalInstructions.datetime = true
  store.config.llm.locale = ''
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.chat.standard_en-US')
  expect(instructions).toContain('instructions.utils.setDate_en-US')
})

test('getSystemInstructions with multiple capabilities', () => {
  store.config.llm.additionalInstructions.mermaid = true
  store.config.llm.additionalInstructions.artifacts = true
  store.config.llm.additionalInstructions.datetime = true
  store.config.llm.locale = ''
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('instructions.capabilities.mermaid_en-US')
  expect(instructions).toContain('instructions.capabilities.artifacts_en-US')
  expect(instructions).toContain('instructions.utils.setDate_en-US')
})

test('getSystemInstructions with all modifiers', () => {
  store.config.llm.forceLocale = true
  store.config.llm.locale = 'fr-FR'
  store.config.llm.additionalInstructions.toolRetry = true
  store.config.llm.additionalInstructions.mermaid = true
  store.config.llm.additionalInstructions.artifacts = true
  store.config.llm.additionalInstructions.datetime = true
  const instructions = llmUtils.getSystemInstructions(undefined, { noMarkdown: true })
  expect(instructions).toContain('instructions.chat.standard_fr-FR')
  expect(instructions).toContain('instructions.capabilities.noMarkdown_fr-FR')
  expect(instructions).toContain('instructions.utils.setLang_fr-FR')
  expect(instructions).toContain('instructions.capabilities.toolRetry_fr-FR')
  expect(instructions).toContain('instructions.capabilities.mermaid_fr-FR')
  expect(instructions).toContain('instructions.capabilities.artifacts_fr-FR')
  expect(instructions).toContain('instructions.utils.setDate_fr-FR')
})

test('getSystemInstructions with custom instruction and modifiers', () => {
  store.config.llm.customInstructions = [
    {
      id: 'custom1',
      label: 'Custom',
      instructions: 'Custom instructions'
    }
  ]
  store.config.llm.instructions = 'custom1'
  store.config.llm.forceLocale = true
  store.config.llm.locale = 'fr-FR'
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toContain('Custom instructions')
  expect(instructions).toContain('instructions.utils.setLang_fr-FR')
})

test('getSystemInstructions with user-defined instructions from config', () => {
  store.config.instructions = {
    chat: {
      standard: 'User defined standard instructions',
    },
    utils: {},
    scratchpad: {},
  }
  const instructions = llmUtils.getSystemInstructions()
  expect(instructions).toBe('User defined standard instructions')
})

test('getSystemInstructions parameter overrides everything', () => {
  store.config.llm.customInstructions = [{ id: 'custom1', label: 'Custom', instructions: 'Custom' }]
  store.config.llm.instructions = 'custom1'
  const override = 'Override instructions'
  const instructions = llmUtils.getSystemInstructions(override)
  expect(instructions).toBe(override)
})

// ============================================================================
// getEngineModelForTask Tests
// ============================================================================

test('getEngineModelForTask with simple complexity and preferred engine', () => {
  const result = llmUtils.getEngineModelForTask('simple', 'mock', 'chat')
  expect(result).toEqual({ engine: 'mock', model: 'chat' })
})

test('getEngineModelForTask with simple complexity finds gpt-5-nano', () => {
  // Configure openai engine as ready
  vi.mocked(LlmManager).prototype.isEngineReady = vi.fn((engine: string) => engine === 'openai')
  const result = llmUtils.getEngineModelForTask('simple', 'openai')
  expect(result).toEqual({ engine: 'openai', model: 'gpt-5-nano' })
})

test('getEngineModelForTask with normal complexity', () => {
  // Normal complexity tries openai first, which succeeds in test
  vi.mocked(LlmManager).prototype.isEngineReady = vi.fn((engine: string) => engine === 'openai' || engine === 'mock')
  const result = llmUtils.getEngineModelForTask('normal', 'mock', 'chat')
  // With mock engine ready and model available, should return mock
  expect(result.engine).toBe('mock')
  expect(result.model).toBe('chat')
})

test('getEngineModelForTask with complex complexity', () => {
  const result = llmUtils.getEngineModelForTask('complex', 'mock', 'chat')
  expect(result).toEqual({ engine: 'mock', model: 'chat' })
})

test('getEngineModelForTask with preferred engine not ready', () => {
  vi.mocked(LlmManager).prototype.isEngineReady = vi.fn(() => false)
  const result = llmUtils.getEngineModelForTask('simple', 'openai')
  // Should fallback to getChatEngineModel
  expect(result).toEqual({ engine: 'mock', model: 'chat' })
})

test('getEngineModelForTask with preferred model not available but has default', () => {
  // When the hierarchy model isn't available, but engine has a default model
  vi.mocked(LlmManager).prototype.getChatModel = vi.fn((engine: string, model: string) => {
    // Return null for hierarchy model, triggering fallback to default
    if (model === 'gpt-5-nano') return null
    if (model === 'chat') return { id: 'chat', name: 'chat', ...defaultCapabilities }
    return null
  })
  vi.mocked(LlmManager).prototype.getDefaultChatModel = vi.fn(() => 'chat')
  const freshUtils = new LlmUtils(store.config)
  const result = freshUtils.getEngineModelForTask('simple', 'mock')
  // Falls back to default chat model
  expect(result).toEqual({ engine: 'mock', model: 'chat' })
})

test('getEngineModelForTask uses fallback model when model not found', () => {
  // Create new instance with fresh mocks
  vi.mocked(LlmManager).prototype.getChatModel = vi.fn(() => null)
  vi.mocked(LlmManager).prototype.getDefaultChatModel = vi.fn(() => null)
  const freshUtils = new LlmUtils(store.config)
  const result = freshUtils.getEngineModelForTask('simple', 'mock', 'fallback-model')
  expect(result).toEqual({ engine: 'mock', model: 'fallback-model' })
})

test('getEngineModelForTask without preferred engine', () => {
  const result = llmUtils.getEngineModelForTask('simple')
  // Should check engines in hierarchy order - anthropic is first for 'simple'
  // and it's ready in our mock, so it returns claude-haiku-4-5
  expect(result).toEqual({ engine: 'anthropic', model: 'claude-haiku-4-5' })
})

test('getEngineModelForTask fallback to configured engine', () => {
  vi.mocked(LlmManager).prototype.isEngineReady = vi.fn(() => false)
  vi.mocked(LlmManager).prototype.getChatModel = vi.fn(() => null)
  const freshUtils = new LlmUtils(store.config)
  const result = freshUtils.getEngineModelForTask('simple')
  // When no engines are ready, falls back to getChatEngineModel
  expect(result).toEqual({ engine: 'mock', model: 'chat' })
})

// ============================================================================
// getTitle Tests
// ============================================================================

test('getTitle returns cleaned title', async () => {
  // Mock the chat method to return a simple title
  vi.spyOn(LlmMock.prototype, 'chat').mockResolvedValue({
    type: 'text',
    content: 'Test Title',
  })
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', 'Response')
  ]
  const title = await llmUtils.getTitle('mock', 'chat', messages)
  expect(title).toBe('Test Title')
})

test('getTitle removes HTML tags', async () => {
  vi.spyOn(LlmMock.prototype, 'chat').mockResolvedValue({
    type: 'text',
    content: '<b>Bold Title</b>',
  })
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', 'Response')
  ]
  const title = await llmUtils.getTitle('mock', 'chat', messages)
  expect(title).toBe('Bold Title')
})

test('getTitle removes markdown', async () => {
  vi.spyOn(LlmMock.prototype, 'chat').mockResolvedValue({
    type: 'text',
    content: '# Heading Title',
  })
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', 'Response')
  ]
  const title = await llmUtils.getTitle('mock', 'chat', messages)
  expect(title).toBe('Heading Title')
})

test('getTitle removes Title: prefix', async () => {
  vi.spyOn(LlmMock.prototype, 'chat').mockResolvedValue({
    type: 'text',
    content: 'Title: The Real Title',
  })
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', 'Response')
  ]
  const title = await llmUtils.getTitle('mock', 'chat', messages)
  expect(title).toBe('The Real Title')
})

test('getTitle removes surrounding quotes', async () => {
  vi.spyOn(LlmMock.prototype, 'chat').mockResolvedValue({
    type: 'text',
    content: '"Quoted Title"',
  })
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', 'Response')
  ]
  const title = await llmUtils.getTitle('mock', 'chat', messages)
  expect(title).toBe('Quoted Title')
})

test('getTitle removes thinking tags', async () => {
  vi.spyOn(LlmMock.prototype, 'chat').mockResolvedValue({
    type: 'text',
    content: '<think>reasoning...</think>Clean Title',
  })
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', 'Response')
  ]
  const title = await llmUtils.getTitle('mock', 'chat', messages)
  expect(title).toBe('Clean Title')
})

test('getTitle handles empty response', async () => {
  vi.spyOn(LlmMock.prototype, 'chat').mockResolvedValue({
    type: 'text',
    content: '',
  })
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'User message'),
    new Message('assistant', 'Response')
  ]
  const title = await llmUtils.getTitle('mock', 'chat', messages)
  expect(title).toBe('User message')
})

test('getTitle handles error and returns null', async () => {
  vi.spyOn(LlmMock.prototype, 'chat').mockRejectedValue(new Error('API error'))
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', 'Response')
  ]
  const title = await llmUtils.getTitle('mock', 'chat', messages)
  expect(title).toBeNull()
})

// ============================================================================
// generateStatusUpdate Tests
// ============================================================================

test('generateStatusUpdate returns status text', async () => {
  const status = await llmUtils.generateStatusUpdate('mock', 'chat', 'Test prompt')
  expect(status).toBeDefined()
  expect(typeof status).toBe('string')
  expect(status.length).toBeGreaterThan(0)
})

test('generateStatusUpdate calls chat method', async () => {
  const chatSpy = vi.spyOn(LlmMock.prototype, 'chat')
  await llmUtils.generateStatusUpdate('mock', 'chat', 'Progress update')
  expect(chatSpy).toHaveBeenCalled()
  const [, messages] = chatSpy.mock.calls[0]
  expect(messages[0].role).toBe('system')
  // Message content can be string or array depending on contentForModel
  const systemContent = Array.isArray(messages[0].content) ? messages[0].content[0].text : messages[0].content
  expect(systemContent).toContain('status update generator')
  expect(systemContent).toContain('concise')
  expect(messages[1].role).toBe('user')
  const userContent = Array.isArray(messages[1].content) ? messages[1].content[0].text : messages[1].content
  expect(userContent).toBe('Progress update')
})
