
import { LlmChunk } from 'multi-llm-ts'
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Assistant, { AssistantCompletionOpts } from '../../src/services/assistant'
import Generator from '../../src/services/generator'
import Attachment from '../../src/models/attachment'
import Message from '../../src/models/message'
import LlmMock from '../mocks/llm'

// mock config
vi.mock('../../src/main/config.ts', async () => {
  return {
    loadSettings: () => JSON.parse(JSON.stringify(defaults)),
  }
})

// mock download
vi.mock('../../src/services/download.ts', async () => {
  return {
    saveFileContents: vi.fn(() => 'local_file.png'),
  }
})  

// mock i18n
vi.mock('../../src/services/i18n', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    t: (key: string) => `${key}.${store.config.general.locale}`,
    localeToLangName: (code: string) => code == 'xx-XX' ? '' : code,
    i18nInstructions: (config: any, key: string) => {

      // get instructions
      const instructions = key.split('.').reduce((obj, token) => obj?.[token], config)
      if (typeof instructions === 'string' && (instructions as string)?.length) {
        return instructions
      }

      // default
      return `${key}.${store.config.llm.locale || store.config.general.locale}`

    },
  }
})

beforeAll(() => {
  Generator.addDateAndTimeToSystemInstr = false
  useWindowMock()
  store.loadExperts()
})

const spy = vi.spyOn(LlmMock.prototype, 'stream')

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
  store.config = defaults
  store.config.general.locale = 'en-US'
  store.config.llm.locale = 'fr-FR'
  store.config.llm.forceLocale = false
  store.config.llm.engine = 'mock'
  store.config.instructions = {}
  store.config.engines.mock = {
    models: { chat: [ 'chat1', 'chat2' ] },
    model: { chat: 'chat'  }
  }

  // init assistant
  assistant = new Assistant(store.config)
  assistant!.setLlm(new LlmMock(store.config))
})

test('Assistant Creation', () => {
  expect(assistant).not.toBeNull()
  expect(assistant!.hasLlm()).toBe(true)
})

test('Assistant parameters', async () => {
  await prompt('Hello LLM')
  const params: AssistantCompletionOpts = spy.mock.calls[0][2] as AssistantCompletionOpts
  expect(params).toStrictEqual({
    titling: true,
    engine: 'mock',
    model: 'chat',
    attachment: null,
    docrepo: null,
    expert: null,
    sources: true,
    models: [ 'chat1', 'chat2' ],
    autoSwitchVision: true,
    citations: true,
    usage: true,
  })
})

test('Asistant language default', async () => {
  store.config.llm.locale = ''
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toContain('instructions.default.en-US')
  expect(instructions).not.toContain('instructions.setLang.en-US')
})

test('Asistant language override', async () => {
  store.config.llm.locale = 'fr-FR'
  store.config.llm.forceLocale = true
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toContain('instructions.default.fr-FR')
  expect(instructions).toContain('instructions.setLang.fr-FR')
})

test('Asistant language unknown', async () => {
  store.config.llm.locale = 'xx-XX'
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toContain('instructions.default.xx-XX')
  expect(instructions).not.toContain('instructions.setLang.fr-FR')
})

test('User-defined instructions', async () => {
  store.config.instructions = {
    default: 'You are a chat assistant',
    titling: 'You are a titling assistant',
    titllingUser: 'Provide a title',
    docquery: '{context} / {query}'
  }
  store.config.llm.forceLocale = true
  await prompt('Hello LLM')
  const instructions = await assistant!.chat.messages[0].content
  expect(instructions).toBe('You are a chat assistant')
  expect(assistant!.chat.title).toBe('You are a titling assistant:\n"Title"')
})

test('Assistant Chat', async () => {
  const content = await prompt('Hello LLM')
  expect(content).toBe('[{"role":"system","content":"instructions.default.fr-FR"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(assistant!.chat.lastMessage().type).toBe('text')
  expect(assistant!.chat.lastMessage().content).toBe(content)
  expect(assistant!.chat.messages.length).toBe(3)
  expect(assistant!.chat.title).toBe('instructions.titling.fr-FR:\n"Title"')
})

test('Assistant Attachment', async () => {
  await assistant!.attach(new Attachment('image_content', 'image/png', 'clipboard://', false))
  expect(assistant!.chat.lastMessage().attachment.content).toStrictEqual('image_content')
  expect(assistant!.chat.lastMessage().attachment.mimeType).toStrictEqual('image/png')
  expect(assistant!.chat.lastMessage().attachment.url).toStrictEqual('clipboard://')
  expect(assistant!.chat.lastMessage().attachment.saved).toStrictEqual(false)
})

test('Assistant System Expert', async () => {
  const content = await prompt('Hello LLM', { expert: store.experts[0], docrepo: undefined } as AssistantCompletionOpts)
  expect(content).toBe('[{"role":"system","content":"instructions.default.fr-FR"},{"role":"user","content":"experts.experts.uuid1.prompt\\nHello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Assistant User Expert', async () => {
  const content = await prompt('Hello LLM', { expert: store.experts[2], docrepo: undefined } as AssistantCompletionOpts)
  expect(content).toBe('[{"role":"system","content":"instructions.default.fr-FR"},{"role":"user","content":"prompt3\\nHello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Asistant DocRepo', async () => {
  const content = await prompt('Hello LLM', { docrepo: 'docrepo' } as AssistantCompletionOpts)
  expect(window.api.docrepo?.query).toHaveBeenLastCalledWith('docrepo', 'Hello LLM')
  expect(content).toBe('[{"role":"system","content":"instructions.default.fr-FR"},{"role":"user","content":"instructions.docquery.fr-FR"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]\n\nSources:\n\n- [title](url)')
})

// test('Assistant Locale Override', async () => {
//   assistant!.chat.locale = 'es-ES'
//   const content = await prompt('Hello LLM')
//   expect(content).toBe('[{"role":"system","content":"instructions.default.es-ES instructions.setLang.es-ES"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
// })

test('Assistant prompt override', async () => {
  assistant!.chat.prompt = 'UserPrompt'
  const content = await prompt('Hello LLM')
  expect(content).toBe('[{"role":"system","content":"UserPrompt"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
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
  expect(content).toBe('generator.errors.missingApiKey.en-US')
})

test('Low balance', async () => {
  await prompt('no credit left')
  const content = assistant!.chat.lastMessage().content
  expect(content).toBe('generator.errors.outOfCredits.en-US')
})

test('Quota exceeded', async () => {
  await prompt('quota exceeded')
  const content = assistant!.chat.lastMessage().content
  expect(content).toBe('generator.errors.quotaExceeded.en-US')
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
