import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { LlmChunk } from 'multi-llm-ts'
import { useWindowMock } from '../mocks/window'
import Generator from '../../src/services/generator'
import { store } from '../../src/services/store'
import Message from '../../src/models/message'

let llmMock: any

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.loadSettings()

  // Add mock engine config
  store.config.engines.mock = {
    models: {
      chat: [
        { id: 'chat', name: 'Chat Model', capabilities: { tools: true, vision: false, reasoning: false } }
      ]
    }
  }

  llmMock = {
    getId: vi.fn(() => 'mock'),
    getName: vi.fn(() => 'Mock'),
    plugins: [],
    complete: vi.fn(),
    generate: vi.fn(),
    stop: vi.fn()
  }
})

test('Generator creates AbortController on generate()', async () => {
  const generator = new Generator(store.config)
  expect(generator.abortController).toBeNull()

  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  // Mock streaming response
  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Hi', done: false } as LlmChunk
    yield { type: 'content', text: '', done: true } as LlmChunk
  })())

  await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  // Should be cleaned up after generation
  expect(generator.abortController).toBeNull()
})

test('Generator.stop() calls abortController.abort()', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  let callCount = 0
  const maxCalls = 5

  // Create a stream that simulates long generation and throws AbortError when aborted
  llmMock.generate.mockImplementation((model, conv, opts) => {
    return (async function* () {
      while (callCount < maxCalls) {
        // Check abort signal like real engines do
        if (opts.abortSignal?.aborted) {
          const error = new Error('Aborted')
          error.name = 'AbortError'
          throw error
        }
        yield { type: 'content', text: 'text', done: false } as LlmChunk
        callCount++
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      yield { type: 'content', text: '', done: true } as LlmChunk
    })()
  })

  const generatePromise = generator.generate(llmMock, messages, { model: 'chat', streaming: true }, () => {
    // After second chunk, stop generation
    if (callCount === 2) {
      generator.stop()
    }
  })

  const result = await generatePromise
  expect(result).toBe('stopped')
  expect(callCount).toBeLessThan(maxCalls) // Should have stopped early
})

test('Generator passes abortSignal to llm.complete()', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.complete.mockResolvedValue({
    type: 'text',
    content: 'Response'
  })

  await generator.generate(llmMock, messages, { model: 'chat', streaming: false })

  expect(llmMock.complete).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({
      abortSignal: expect.any(AbortSignal)
    })
  )
})

test('Generator passes abortSignal to llm.generate()', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Hi', done: true } as LlmChunk
  })())

  await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(llmMock.generate).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({
      abortSignal: expect.any(AbortSignal)
    })
  )
})

test('Generator cleanup sets abortController to null in finally', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Hi', done: true } as LlmChunk
  })())

  await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  // Should be cleaned up
  expect(generator.abortController).toBeNull()
  expect(generator.stream).toBeNull()
})

test('Generator reuses AbortController if already created', async () => {
  const generator = new Generator(store.config)

  // Manually create abortController (simulating Assistant.prompt() scenario)
  const existingController = new AbortController()
  generator.abortController = existingController

  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Hi', done: false } as LlmChunk

    // Capture the abort signal that was passed
    const callArgs = llmMock.generate.mock.calls[0]
    const opts = callArgs[2]

    // Should be the same signal from the existing controller
    expect(opts.abortSignal).toBe(existingController.signal)

    yield { type: 'content', text: '', done: true } as LlmChunk
  })())

  await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  // Verify it used the existing controller's signal
  expect(llmMock.generate).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({
      abortSignal: existingController.signal
    })
  )
})
