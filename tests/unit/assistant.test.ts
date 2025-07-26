
import { LlmChunk } from 'multi-llm-ts'
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Assistant, { AssistantCompletionOpts } from '../../src/services/assistant'
import Generator from '../../src/services/generator'
import Attachment from '../../src/models/attachment'
import Message from '../../src/models/message'
import LlmMock, { installMockModels } from '../mocks/llm'

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock(() => ({
    locale: store.config.llm.locale
  }))
})

vi.mock('../../src/main/config.ts', async () => {
  return {
    loadSettings: () => JSON.parse(JSON.stringify(defaults)),
  }
})

vi.mock('../../src/services/download.ts', async () => {
  return {
    saveFileContents: vi.fn(() => 'local_file.png'),
  }
})  

beforeAll(() => {
  Generator.addCapabilitiesToSystemInstr = false
  Generator.addDateAndTimeToSystemInstr = false
  useWindowMock()
  store.loadExperts()
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
  await vi.waitUntil(async () => !assistant!.chat.lastMessage().transient)

  // return
  return content

}

beforeEach(() => {

  // clear mock
  vi.clearAllMocks()

  // init store
  // @ts-expect-error mocking
  store.config = defaults
  store.config.general.locale = 'en-US'
  store.config.llm.locale = 'fr-FR'
  store.config.llm.forceLocale = false
  store.config.llm.engine = 'mock'
  // @ts-expect-error mocking
  store.config.instructions = {}
  installMockModels()

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
  expect(params).toStrictEqual({
    titling: true,
    engine: 'mock',
    model: 'chat',
    instructions: null,
    attachments: [],
    docrepo: null,
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
  expect(assistant!.chat.title).toBe('You are a titling assistant:\n"Title"')
})

test('Assistant Chat Streaming', async () => {
  const content = await prompt('Hello LLM')
  expect(content).toBe('[{"role":"system","content":"instructions.chat.standard_fr-FR"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(assistant!.chat.lastMessage().type).toBe('text')
  expect(assistant!.chat.lastMessage().content).toBe(content)
  expect(assistant!.chat.messages.length).toBe(3)
  expect(assistant!.chat.title).toBe('instructions.utils.titling_fr-FR:\n"Title"')
})

test('Assistant Chat No Streaming 1', async () => {
  const content = await prompt('Hello LLM', { model: 'chat', streaming: false })
  expect(content).toBe('<think>Reasoning...</think># <b>instructions.chat.standard_fr-FR:\n"Title"</b>')
  expect(assistant!.chat.lastMessage().type).toBe('text')
  expect(assistant!.chat.lastMessage().content).toBe(content)
  expect(assistant!.chat.messages.length).toBe(3)
  expect(assistant!.chat.title).toBe('instructions.utils.titling_fr-FR:\n"Title"')
})

test('Assistant Chat No Streaming 2', async () => {
  assistant!.initChat()
  assistant!.chat.disableStreaming = true
  const content = await prompt('Hello LLM')
  expect(content).toBe('<think>Reasoning...</think># <b>instructions.chat.standard_fr-FR:\n"Title"</b>')
  expect(assistant!.chat.lastMessage().type).toBe('text')
  expect(assistant!.chat.lastMessage().content).toBe(content)
  expect(assistant!.chat.messages.length).toBe(3)
  expect(assistant!.chat.title).toBe('instructions.utils.titling_fr-FR:\n"Title"')
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

test('Assistant System Expert', async () => {
  const content = await prompt('Hello LLM', { expert: store.experts[0], docrepo: undefined } as AssistantCompletionOpts)
  expect(content).toBe('[{"role":"system","content":"instructions.chat.standard_fr-FR"},{"role":"user","content":"expert_uuid1_prompt\\nHello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Assistant User Expert', async () => {
  const content = await prompt('Hello LLM', { expert: store.experts[2], docrepo: undefined } as AssistantCompletionOpts)
  expect(content).toBe('[{"role":"system","content":"instructions.chat.standard_fr-FR"},{"role":"user","content":"prompt3\\nHello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Assistant DocRepo', async () => {
  const content = await prompt('Hello LLM', { docrepo: 'docrepo' } as AssistantCompletionOpts)
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

test('Conversaton Length 1', async () => {
  store.config.llm.conversationLength = 1
  await prompt('Hello LLM1')
  await prompt('Hello LLM2')
  const thread = JSON.parse(assistant!.chat.lastMessage().content)
  expect(assistant!.chat.messages.length).toBe(5)
  expect(thread).toHaveLength(3)
  expect(thread.map((m: Message) => m.role)).toEqual(['system', 'user', 'assistant'])
})

test('Conversaton Length 2', async () => {
  store.config.llm.conversationLength = 2
  await prompt('Hello LLM1')
  await prompt('Hello LLM2')
  const thread = JSON.parse(assistant!.chat.lastMessage().content)
  expect(thread).toHaveLength(5)
  expect(thread.map((m: Message) => m.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant'])
})

test('No API Key', async () => {
  await prompt('no api key')
  const content = assistant!.chat.lastMessage().content
  expect(content).toBe('generator.errors.missingApiKey_en-US')
})

test('Low balance', async () => {
  await prompt('no credit left')
  const content = assistant!.chat.lastMessage().content
  expect(content).toBe('generator.errors.outOfCredits_en-US')
})

test('Quota exceeded', async () => {
  await prompt('quota exceeded')
  const content = assistant!.chat.lastMessage().content
  expect(content).toBe('generator.errors.quotaExceeded_en-US')
})

test('Stop generation', async () => {
  const start = Date.now()
  await assistant!.prompt('infinite', { model: 'chat' }, () => {
    if (Date.now() > start + 250) {
      assistant!.stop()
    } else {
      expect(assistant!.chat.lastMessage().transient).toBe(true)
    }
  })
  expect(assistant!.chat.lastMessage().transient).toBe(false)
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
  Generator.addCapabilitiesToSystemInstr = true
  store.config.llm.instructions = 'standard'
  store.config.llm.locale = ''
  await prompt('Hello LLM')
  const instructions1 = await assistant!.chat.messages[0].content
  expect(instructions1).toBe('instructions.chat.standard_en-US\n\nIf you output a Mermaid chart, it will be rendered as a diagram to the user.')
})

