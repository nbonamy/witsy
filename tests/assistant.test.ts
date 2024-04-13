
import { vi, beforeEach, expect, test } from 'vitest'
import { LlmStream, LlmCompletionOpts } from '../src/index.d'
import { store } from '../src/services/store'
import Assistant from '../src/services/assistant'
import LlmMock from './mocks/llm'
import defaults from '../defaults/settings.json'

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
  store.config.getActiveModel = () => 'chat'

  // init assistant
  assistant = new Assistant(store.config)
  assistant.setLlm('mock', new LlmMock())
})

test('Assistant Creation', () => {
  expect(assistant).not.toBeNull()
  expect(assistant.hasLlm()).toBe(true)
})

test('Assistant Completion', async () => {
  const content = await prompt('Hello LLM')
  expect(content).toBe('[{"role":"system","content":"You are a chat assistant"},{"role":"user","content":"Hello LLM"},{"role":"assistant","content":"Be kind. Don\'t mock me"}]')
  expect(assistant.chat.lastMessage().content).toBe(content)
  expect(assistant.chat.messages.length).toBe(3)
  expect(assistant.chat.title).toBe('Be kind. Don\'t mock me')
})

test('Conversaton Length 1', async () => {
  store.config.llm.conversationLength = 1
  await prompt('Hello LLM1')
  const content = await prompt('Hello LLM2')
  expect(assistant.chat.messages.length).toBe(5)
  const thread = JSON.parse(content)
  expect(thread).toHaveLength(3)
  expect(thread.map(m => m.role)).toEqual(['system', 'user', 'assistant'])
})

test('Conversaton Length 1', async () => {
  store.config.llm.conversationLength = 2
  await prompt('Hello LLM1')
  const content = await prompt('Hello LLM2')
  expect(assistant.chat.messages.length).toBe(5)
  const thread = JSON.parse(content)
  expect(thread).toHaveLength(5)
  expect(thread.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant'])
})
