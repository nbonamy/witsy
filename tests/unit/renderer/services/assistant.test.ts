
import { defaultCapabilities, LlmChunk } from 'multi-llm-ts'
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { store } from '@services/store'
import Assistant, { AssistantCompletionOpts } from '@services/assistant'
import Attachment from '@models/attachment'
import LlmMock, { installMockModels } from '@tests/mocks/llm'
import LlmUtils from '@services/llm_utils'

vi.mock('@services/llms/manager.ts', async () => {
  const LlmManager = vi.fn()
  LlmManager.prototype.initModels = vi.fn()
  LlmManager.prototype.isEngineReady = vi.fn(() => true)
  LlmManager.prototype.isEngineConfigured = vi.fn(() => true)
  LlmManager.prototype.getEngineName = () => 'mock'
  LlmManager.prototype.getCustomEngines = (): string[] => []
  LlmManager.prototype.getFavoriteId = () => 'favid'
  LlmManager.prototype.getChatModels = vi.fn(() => [{ id: 'chat', name: 'chat', ...defaultCapabilities }])
  LlmManager.prototype.getChatModel = vi.fn(() => ({ id: 'chat', name: 'chat', ...defaultCapabilities }))
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

vi.mock('@services/download.ts', async () => {
  return {
    saveFileContents: vi.fn(() => 'local_file.png'),
  }
})

const spyMockStream = vi.spyOn(LlmMock.prototype, 'stream')

let assistant: Assistant|null = null

const prompt = async (prompt: string, opts: AssistantCompletionOpts = { model: 'chat' }): Promise<string> => {

  // callback
  let content = ''
  const callback = (chunk: LlmChunk) => {
    if (chunk?.type === 'content') {
      content += chunk?.text || ''
    }
  }
  
  // call and wait
  await assistant!.prompt(prompt, opts, callback)
  await vi.waitUntil(async () => !assistant!.chat.lastMessage()?.transient)

  // return
  return content

}

beforeAll(async () => {
  useWindowMock({ noAdditionalInstructions: true })
  store.loadExperts()
})

beforeEach(() => {

  // clear mock
  vi.clearAllMocks()

  // init store
  store.loadSettings()
  store.config.general.locale = 'en-US'
  store.config.llm.locale = 'fr-FR'
  store.config.llm.forceLocale = false
  store.config.llm.engine = 'mock'
  // @ts-expect-error mocking
  store.config.instructions = {}
  installMockModels()

  // disable all additional instructions
  for (const key of Object.keys(store.config.llm.additionalInstructions)) {
    // @ts-expect-error partial mock
    store.config.llm.additionalInstructions[key] = false
  }

  // spy on getTitle
  vi.spyOn(LlmUtils.prototype, 'getTitle').mockResolvedValue('Mock Title')

  // init assistant
  assistant = new Assistant(store.config)
  assistant!.setLlm(new LlmMock({}))
  assistant.initLlm = () => {}
})

test('Assistant Creation', () => {
  expect(assistant).not.toBeNull()
  expect(assistant!.hasLlm()).toBe(true)
})

test('Assistant parameters', async () => {
  await prompt('Hello LLM')
  const params: AssistantCompletionOpts = spyMockStream.mock.calls[0][2] as AssistantCompletionOpts
  expect(params).toMatchObject({
    titling: true,
    engine: 'mock',
    model: 'chat',
    instructions: null,
    attachments: [],
    docrepos: null,
    expert: null,
    sources: true,
    streaming: true,
    visionFallbackModel: {
      id: 'vision',
      meta: {},
      capabilities: {
        tools: true,
        vision: true,
        reasoning: false,
      }
    },
    citations: true,
    caching: true,
    usage: true,
  })
})

test('Assistant instructions', async () => {
  store.config.llm.locale = ''
  await prompt('Hello LLM')
  const instructions1 = await assistant!.chat.messages[0].content
  expect(instructions1).toContain('instructions.chat.standard_en-US')
  expect(instructions1).not.toContain('instructions.utils.setLang_en-US')
  store.config.llm.instructions = 'structured'
  await prompt('Hello LLM')
  const instructions2 = await assistant!.chat.messages[0].content
  expect(instructions2).toContain('instructions.chat.structured_en-US')
  expect(instructions2).not.toContain('instructions.utils.setLang_en-US')
  store.config.llm.instructions = 'standard'
})

test('Assistant language default', async () => {
  store.config.llm.locale = ''
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toContain('instructions.chat.standard_en-US')
  expect(instructions).not.toContain('instructions.utils.setLang_en-US')
})

test('Assistant language override', async () => {
  store.config.llm.locale = 'fr-FR'
  store.config.llm.forceLocale = true
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toContain('instructions.chat.standard_fr-FR')
  expect(instructions).toContain('instructions.utils.setLang_fr-FR')
})

test('Assistant language unknown', async () => {
  store.config.llm.locale = 'xx-XX'
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toContain('instructions.chat.standard_xx-XX')
  expect(instructions).not.toContain('instructions.utils.setLang_fr-FR')
})

test('User-defined instructions', async () => {
  store.config.instructions = {
    chat: {
      standard: 'You are a standard assistant',
      structured: 'You are a structured assistant',
      docquery: '{context} / {query}'
    },
    utils: {
      titling: 'You are a titling assistant',
      titlingUser: 'Provide a title',
    },
    scratchpad: {},
  }
  store.config.llm.forceLocale = true
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toBe('You are a standard assistant\n\ninstructions.utils.setLang_fr-FR')
  expect(assistant!.chat.title).toBe('Mock Title')
})

test('NoMarkdown modifier', async () => {
  store.config.llm.locale = ''
  // Test without noMarkdown
  await prompt('Hello LLM', { model: 'chat' })
  const instructions1 = await assistant!.chat.messages[0].content
  expect(instructions1).toContain('instructions.chat.standard_en-US')
  expect(instructions1).not.toContain('instructions.capabilities.noMarkdown_en-US')

  // Test with noMarkdown
  await prompt('Hello LLM', { model: 'chat', noMarkdown: true })
  const instructions2 = await assistant!.chat.messages[0].content
  expect(instructions2).toContain('instructions.chat.standard_en-US')
  expect(instructions2).toContain('instructions.capabilities.noMarkdown_en-US')
})

test('Assistant Chat Streaming', async () => {
  const content = await prompt('Hello LLM')
  expect(content).toBe('[{"role":"system","content":"instructions.chat.standard_fr-FR"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(assistant!.chat.lastMessage().type).toBe('text')
  expect(assistant!.chat.lastMessage().content).toBe(content)
  expect(assistant!.chat.messages.length).toBe(3)
  expect(assistant!.chat.title).toBe('Mock Title')
})

test('Assistant Chat No Streaming 1', async () => {
  const content = await prompt('Hello LLM', { model: 'chat', streaming: false })
  expect(content).toBe('<think>Reasoning...</think># <b>instructions.chat.standard_fr-FR:\n"Title"</b>')
  expect(assistant!.chat.lastMessage().type).toBe('text')
  expect(assistant!.chat.lastMessage().content).toBe(content)
  expect(assistant!.chat.messages.length).toBe(3)
  expect(assistant!.chat.title).toBe('Mock Title')
})

test('Assistant Chat No Streaming 2', async () => {
  assistant!.initChat()
  assistant!.chat.disableStreaming = true
  const content = await prompt('Hello LLM')
  expect(content).toBe('<think>Reasoning...</think># <b>instructions.chat.standard_fr-FR:\n"Title"</b>')
  expect(assistant!.chat.lastMessage().type).toBe('text')
  expect(assistant!.chat.lastMessage().content).toBe(content)
  expect(assistant!.chat.messages.length).toBe(3)
  expect(assistant!.chat.title).toBe('Mock Title')
})

test('Assistant Attachment', async () => {

  await assistant!.attach(new Attachment('image_content', 'image/png', 'clipboard://', false))
  expect(assistant!.chat.lastMessage().attachments[0].content).toStrictEqual('image_content')
  expect(assistant!.chat.lastMessage().attachments[0].mimeType).toStrictEqual('image/png')
  expect(assistant!.chat.lastMessage().attachments[0].url).toStrictEqual('clipboard://')
  expect(assistant!.chat.lastMessage().attachments[0].saved).toStrictEqual(false)

  await assistant!.attach(new Attachment('file_content', 'text/plain', 'clipboard://', false))
  expect(assistant!.chat.lastMessage().attachments[1].content).toStrictEqual('file_content')
  expect(assistant!.chat.lastMessage().attachments[1].mimeType).toStrictEqual('text/plain')
  expect(assistant!.chat.lastMessage().attachments[1].url).toStrictEqual('clipboard://')
  expect(assistant!.chat.lastMessage().attachments[1].saved).toStrictEqual(false)

})

test('Assistant sends attachment', async () => {
  const content = await prompt('Hello LLM', { model: 'chat', attachments: [
    new Attachment('image_content', 'image/png', 'clipboard://', false),
    new Attachment('file_content', 'text/plain', 'clipboard://', false)
  ]})
  expect(assistant!.chat.messages[1].attachments).toHaveLength(2)
  expect(content).toBe('[{"role":"system","content":"instructions.chat.standard_fr-FR"},{"role":"user","content":"Hello LLM (image_content) (file_content)"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Assistant sends attachment with empty prompt', async () => {
  const content = await prompt('', { model: 'chat', attachments: [
    new Attachment('image_content', 'image/png', 'clipboard://', false),
    new Attachment('file_content', 'text/plain', 'clipboard://', false)
  ]})
  expect(assistant!.chat.messages[1].attachments).toHaveLength(2)
  expect(content).toBe('[{"role":"system","content":"instructions.chat.standard_fr-FR"},{"role":"user","content":" (image_content) (file_content)"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Assistant ignores empty prompt', async () => {
  const content = await prompt('')
  expect(content).toBe('')
})

test('Assistant System Expert', async () => {
  const content = await prompt('Hello LLM', { expert: store.experts[0], docrepos: undefined } as AssistantCompletionOpts)
  expect(content).toBe('[{"role":"system","content":"instructions.chat.standard_fr-FR"},{"role":"user","content":"expert_uuid1_prompt\\nHello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Assistant User Expert', async () => {
  const content = await prompt('Hello LLM', { expert: store.experts[2], docrepos: undefined } as AssistantCompletionOpts)
  expect(content).toBe('[{"role":"system","content":"instructions.chat.standard_fr-FR"},{"role":"user","content":"prompt3\\nHello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Assistant DocRepo', async () => {
  const content = await prompt('Hello LLM', { docrepos: ['docrepo'] } as AssistantCompletionOpts)
  expect(window.api.docrepo?.query).toHaveBeenLastCalledWith('docrepo', 'Hello LLM')
  expect(content).toBe('[{"role":"system","content":"instructions.chat.standard_fr-FR"},{"role":"user","content":"instructions.chat.docquery_fr-FR"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]\n\nSources:\n\n- [title](url)')
})

// test('Assistant Locale Override', async () => {
//   assistant!.chat.locale = 'es-ES'
//   const content = await prompt('Hello LLM')
//   expect(content).toBe('[{"role":"system","content":"instructions.chat.standard.es-ES instructions.utils.setLang.es-ES"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
// })

test('Assistant prompt override', async () => {
  assistant!.chat.instructions = 'UserInstructions'
  const content = await prompt('Hello LLM')
  expect(content).toBe('[{"role":"system","content":"UserInstructions"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Custom instructions with valid ID', async () => {
  // Add custom instructions to store
  store.config.llm.customInstructions = [
    {
      id: 'custom1',
      label: 'Test Custom Instruction',
      instructions: 'You are a test assistant with custom behavior'
    },
    {
      id: 'custom2', 
      label: 'Another Custom Instruction',
      instructions: 'You are another custom assistant'
    }
  ]
  
  // Set LLM to use custom instruction
  store.config.llm.instructions = 'custom1'
  store.config.llm.forceLocale = true
  
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toBe('You are a test assistant with custom behavior\n\ninstructions.utils.setLang_fr-FR')
})

test('Custom instructions with second valid ID', async () => {
  // Add custom instructions to store
  store.config.llm.customInstructions = [
    {
      id: 'custom1',
      label: 'Test Custom Instruction',
      instructions: 'You are a test assistant with custom behavior'
    },
    {
      id: 'custom2', 
      label: 'Another Custom Instruction',
      instructions: 'You are another custom assistant'
    }
  ]
  
  // Set LLM to use second custom instruction
  store.config.llm.instructions = 'custom2'
  store.config.llm.forceLocale = true
  
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toBe('You are another custom assistant\n\ninstructions.utils.setLang_fr-FR')
})

test('Custom instructions fallback to default when ID not found', async () => {
  // Add custom instructions to store
  store.config.llm.customInstructions = [
    {
      id: 'custom1',
      label: 'Test Custom Instruction', 
      instructions: 'You are a test assistant with custom behavior'
    }
  ]
  
  // Set LLM to use non-existent custom instruction
  store.config.llm.instructions = 'custom999'
  store.config.llm.forceLocale = true
  
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  // Should fallback to i18n default since custom ID not found
  expect(instructions).toBe('instructions.chat.custom999_fr-FR\n\ninstructions.utils.setLang_fr-FR')
})

test('Custom instructions with empty array', async () => {
  // Set empty custom instructions array
  store.config.llm.customInstructions = []
  
  // Set LLM to use custom instruction ID that doesn't exist
  store.config.llm.instructions = 'custom1'
  store.config.llm.forceLocale = true
  
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  // Should fallback to i18n since no custom instructions exist
  expect(instructions).toBe('instructions.chat.custom1_fr-FR\n\ninstructions.utils.setLang_fr-FR')
})

test('Custom instructions without force locale', async () => {
  // Add custom instructions to store
  store.config.llm.customInstructions = [
    {
      id: 'custom1',
      label: 'Test Custom Instruction',
      instructions: 'You are a test assistant with custom behavior'
    }
  ]
  
  // Disable force locale
  store.config.llm.forceLocale = false
  store.config.llm.instructions = 'custom1'
  
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  // Should not include language instruction
  expect(instructions).toBe('You are a test assistant with custom behavior')
})

test('Custom instructions mixed with defaults', async () => {
  // Add custom instructions to store
  store.config.llm.customInstructions = [
    {
      id: 'custom1',
      label: 'Test Custom Instruction',
      instructions: 'You are a test assistant with custom behavior'
    }
  ]
  
  store.config.llm.forceLocale = true
  
  // Test with default instruction first
  store.config.llm.instructions = 'structured'
  await prompt('Hello LLM')
  let instructions = await assistant!.chat.messages[0].content
  expect(instructions).toBe('instructions.chat.structured_fr-FR\n\ninstructions.utils.setLang_fr-FR')
  
  // Switch to custom instruction
  store.config.llm.instructions = 'custom1'
  await prompt('Hello LLM')
  instructions = await assistant!.chat.messages[0].content  
  expect(instructions).toBe('You are a test assistant with custom behavior\n\ninstructions.utils.setLang_fr-FR')
  
  // Switch back to default
  store.config.llm.instructions = 'standard'
  await prompt('Hello LLM')
  instructions = await assistant!.chat.messages[0].content
  expect(instructions).toBe('instructions.chat.standard_fr-FR\n\ninstructions.utils.setLang_fr-FR')
})

test('Custom instructions with chat override', async () => {
  // Add custom instructions to store
  store.config.llm.customInstructions = [
    {
      id: 'custom1',
      label: 'Test Custom Instruction',
      instructions: 'You are a test assistant with custom behavior'
    }
  ]
  
  // Set LLM to use custom instruction
  store.config.llm.instructions = 'custom1'
  
  // Override with chat-specific instructions
  assistant!.chat.instructions = 'Chat override instructions'
  
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  // Chat override should take precedence over custom instructions
  expect(instructions).toBe('Chat override instructions')
})

test('Assistant instructions with capabilities', async () => {
  store.config.llm.additionalInstructions.mermaid = true
  store.config.llm.instructions = 'standard'
  store.config.llm.locale = ''
  await prompt('Hello LLM')
  const instructions1 = await assistant!.chat.messages[0].content
  expect(instructions1.toLowerCase()).toContain('mermaid')
})

