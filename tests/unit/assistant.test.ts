
import { LlmStream, LlmCompletionOpts, Message } from '../../src/index.d'
import { vi, beforeEach, expect, test } from 'vitest'
import { store } from '../../src/services/store'
import defaults from '../../defaults/settings.json'
import Assistant from '../../src/services/assistant'
import Chat from '../../src/models/chat'
import LlmMock from '../mocks/llm'

// mock config
vi.mock('../../src/main/config.ts', async () => {
  return {
    settingsFilePath: () => '',
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
  let done = false
  let content = ''
  const callback = (chunk: LlmStream) => {
    done = chunk?.done
    content += chunk?.text || ''
  }
  
  // call and wait
  await assistant.prompt(prompt, { ...opts, save: false }, callback)
  await vi.waitUntil(async () => done)

  // return
  return content

}

beforeEach(() => {

  // init store
  store.config = defaults
  store.config.llm.engine = 'mock'
  store.config.instructions = {
    default: 'You are a chat assistant',
    routing: 'You are a routing assistant',
    titling: 'You are a titling assistant'
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

test('Assistant Image', async () => {
  const content = await prompt('Create an image of a dragon')
  expect(content).toBe('local_file.png')
  expect(assistant.chat.lastMessage().type).toBe('image')
  expect(assistant.chat.lastMessage().content).toBe('file://local_file.png')
  expect(assistant.chat.messages.length).toBe(3)
})

test('Assistant Attachment', async () => {
  assistant.setChat(new Chat())
  await assistant.attach({
    type: 'image',
    url: 'clipboard://',
    format: 'png',
    contents: 'image_content',
    downloaded: false 
  })
  expect(assistant.chat.lastMessage().attachment).toStrictEqual({
    type: 'image',
    url: 'clipboard://',
    format: 'png',
    contents: 'image_content',
    downloaded: false 
  })
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