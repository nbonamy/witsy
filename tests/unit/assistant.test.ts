
import { Message } from '../../src/types/index.d'
import { LlmStream, LlmCompletionOpts } from '../../src/types/llm.d'
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Assistant from '../../src/services/assistant'
import Attachment from '../../src/models/attachment'
import Chat from '../../src/models/chat'
import LlmMock from '../mocks/llm'

window.api = {
  file: {
    extractText: (contents) => contents
  },
  docrepo: {
    query: vi.fn(() => [
      {
        content: 'content',
        score: 1,
        metadata: {
          uuid: 1,
          type: 'type',
          title: 'title',
          url: 'url'
        }
      }
    ])
  }
}

// mock config
vi.mock('../../src/main/config.ts', async () => {
  return {
    loadSettings: () => defaults,
  }
})

// mock download
vi.mock('../../src/services/download.ts', async () => {
  return {
    saveFileContents: vi.fn(() => 'local_file.png'),
  }
})  

let assistant: Assistant = null

const prompt = async (prompt: string, opts: LlmCompletionOpts = {}): Promise<string> => {

  // callback
  let content = ''
  const callback = (chunk: LlmStream) => {
    content += chunk?.text || ''
  }
  
  // call and wait
  await assistant.prompt(prompt, { ...opts, save: false }, callback)
  await vi.waitUntil(async () => !assistant.chat.lastMessage().transient)

  // return
  return content

}

beforeEach(() => {

  // init store
  store.config = defaults
  store.config.llm.engine = 'mock'
  store.config.instructions = {
    default: 'You are a chat assistant',
    titling: 'You are a titling assistant',
    docquery: '{context} / {query}'
  }
  store.config.engines.mock = {
    model: { chat: 'chat'  }
  }
  store.config.getActiveModel = () => 'chat'

  // init assistant
  assistant = new Assistant(store.config)
  assistant.setLlm('mock', new LlmMock(store.config))
})

test('Assistant Creation', () => {
  expect(assistant).not.toBeNull()
  expect(assistant.hasLlm()).toBe(true)
})

test('Assistant Chat', async () => {
  const content = await prompt('Hello LLM')
  expect(content).toBe('[{"role":"system","content":"You are a chat assistant"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(assistant.chat.lastMessage().type).toBe('text')
  expect(assistant.chat.lastMessage().content).toBe(content)
  expect(assistant.chat.messages.length).toBe(3)
  expect(assistant.chat.title).toBe('[{"role":"system","content":"You are a titling assistant"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"[{\\"role\\":\\"system\\",\\"content\\":\\"You are a chat assistant\\"},{\\"role\\":\\"user\\",\\"content\\":\\"Hello LLM\\"},{\\"role\\":\\"assistant\\",\\"content\\":\\"Be kind. Don\'t mock me\\"}]"},{"role":"user"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Assistant Attachment', async () => {
  assistant.setChat(new Chat())
  await assistant.attach(new Attachment('clipboard://', 'image/png', 'image_content', false))
  expect(assistant.chat.lastMessage().attachment.contents).toStrictEqual('image_content')
  expect(assistant.chat.lastMessage().attachment.mimeType).toStrictEqual('image/png')
  expect(assistant.chat.lastMessage().attachment.url).toStrictEqual('clipboard://')
  expect(assistant.chat.lastMessage().attachment.downloaded).toStrictEqual(false)
})

test('Asistant DocRepo', async () => {
  const content = await prompt('Hello LLM', { docrepo: 'docrepo' })
  expect(window.api.docrepo.query).toHaveBeenCalledWith('docrepo', 'Hello LLM')
  expect(content).toBe('[{"role":"system","content":"You are a chat assistant"},{"role":"user","content":"content / Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]\n\nSources:\n\n- [title](url)')
  expect(assistant.chat.lastMessage().type).toBe('text')
  expect(assistant.chat.lastMessage().content).toBe(content)
  expect(assistant.chat.messages.length).toBe(3)
  expect(assistant.chat.title).toBe('[{"role":"system","content":"You are a titling assistant"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"[{\\"role\\":\\"system\\",\\"content\\":\\"You are a chat assistant\\"},{\\"role\\":\\"user\\",\\"content\\":\\"content / Hello LLM\\"},{\\"role\\":\\"assistant\\",\\"content\\":\\"Be kind. Don\'t mock me\\"}]\\n\\nSources:\\n\\n- [title](url)"},{"role":"user"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
})

test('Conversaton Length 1', async () => {
  store.config.llm.conversationLength = 1
  await prompt('Hello LLM1')
  await prompt('Hello LLM2')
  const thread = JSON.parse(assistant.chat.lastMessage().content)
  expect(assistant.chat.messages.length).toBe(5)
  expect(thread).toHaveLength(3)
  expect(thread.map((m: Message) => m.role)).toEqual(['system', 'user', 'assistant'])
})

test('Conversaton Length 2', async () => {
  store.config.llm.conversationLength = 2
  await prompt('Hello LLM1')
  await prompt('Hello LLM2')
  const thread = JSON.parse(assistant.chat.lastMessage().content)
  expect(thread).toHaveLength(5)
  expect(thread.map((m: Message) => m.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant'])
})

test('Conversation language', async () => {
  store.config.general.language = 'fr'
  await prompt('Hello LLM')
  const instructions = await assistant.chat.messages[0].content
  expect(instructions).toMatch(/French/)

})

test('No API Key', async () => {
  await prompt('no api key')
  const content = assistant.chat.lastMessage().content
  expect(content).toBe('You need to enter your API key in the Models tab of <a href="#settings_models">Settings</a> in order to chat.')
})

test('Low balance', async () => {
  await prompt('no credit left')
  const content = assistant.chat.lastMessage().content
  expect(content).toBe('Sorry, it seems you have run out of credits. Check the balance of your LLM provider account.')
})

test('Quota exceeded', async () => {
  await prompt('quota exceeded')
  const content = assistant.chat.lastMessage().content
  expect(content).toBe('Sorry, it seems you have reached the rate limit of your LLM provider account. Try again later.')
})
