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

test('Generator uses abortSignal from opts', async () => {
  const generator = new Generator(store.config)
  const abortController = new AbortController()

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

  await generator.generate(llmMock, messages, { model: 'chat', streaming: true, abortSignal: abortController.signal })

  // Should have received the signal
  expect(llmMock.generate).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({
      abortSignal: abortController.signal
    })
  )
})

test('Generator stops when abortSignal is aborted', async () => {
  const generator = new Generator(store.config)
  const abortController = new AbortController()
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

  const generatePromise = generator.generate(llmMock, messages, { model: 'chat', streaming: true, abortSignal: abortController.signal }, () => {
    // After second chunk, abort via controller
    if (callCount === 2) {
      abortController.abort()
    }
  })

  const result = await generatePromise
  expect(result).toBe('stopped')
  expect(callCount).toBeLessThan(maxCalls) // Should have stopped early
})

test('Generator passes abortSignal to llm.complete()', async () => {
  const generator = new Generator(store.config)
  const abortController = new AbortController()
  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.complete.mockResolvedValue({
    type: 'text',
    content: 'Response'
  })

  await generator.generate(llmMock, messages, { model: 'chat', streaming: false, abortSignal: abortController.signal })

  expect(llmMock.complete).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({
      abortSignal: abortController.signal
    })
  )
})

test('Generator passes abortSignal to llm.generate()', async () => {
  const generator = new Generator(store.config)
  const abortController = new AbortController()
  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Hi', done: true } as LlmChunk
  })())

  await generator.generate(llmMock, messages, { model: 'chat', streaming: true, abortSignal: abortController.signal })

  expect(llmMock.generate).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({
      abortSignal: abortController.signal
    })
  )
})

test('Generator completes successfully with abortSignal', async () => {
  const generator = new Generator(store.config)
  const abortController = new AbortController()
  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Hi', done: true } as LlmChunk
  })())

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true, abortSignal: abortController.signal })

  expect(result).toBe('success')
})

test('Generator works without abortSignal (optional)', async () => {
  const generator = new Generator(store.config)

  const messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Hi', done: false } as LlmChunk
    yield { type: 'content', text: '', done: true } as LlmChunk
  })())

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(result).toBe('success')
  expect(llmMock.generate).toHaveBeenCalled()
})

// ============================================================================
// Conversation Management Tests
// ============================================================================

test('Generator getConversation with length 1', () => {
  const generator = new Generator(store.config)
  store.config.llm.conversationLength = 1

  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello 1'),
    new Message('assistant', 'Response 1'),
    new Message('user', 'Hello 2'),
    new Message('assistant', 'Response 2'),
  ]

  const conversation = generator.getConversation(messages)

  // getConversation excludes last message with slice(-conversationLength * 2, -1)
  // With length=1, it gets last 2 messages (1 pair) excluding the very last
  expect(conversation).toHaveLength(2) // system + 'Hello 2' (excludes 'Response 2')
  expect(conversation.map((m: Message) => m.role)).toEqual(['system', 'user'])
  expect(conversation[1].content).toBe('Hello 2')
})

test('Generator getConversation with length 2', () => {
  const generator = new Generator(store.config)
  store.config.llm.conversationLength = 2

  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello 1'),
    new Message('assistant', 'Response 1'),
    new Message('user', 'Hello 2'),
    new Message('assistant', 'Response 2'),
  ]

  const conversation = generator.getConversation(messages)

  // With length=2, it gets last 4 messages (2 pairs) excluding the very last
  expect(conversation).toHaveLength(4) // system + last 3 chat messages
  expect(conversation.map((m: Message) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
})

test('Generator getConversation preserves system message', () => {
  const generator = new Generator(store.config)
  store.config.llm.conversationLength = 1

  const messages = [
    new Message('system', 'Important system instructions'),
    new Message('user', 'Hello 1'),
    new Message('assistant', 'Response 1'),
    new Message('user', 'Hello 2'),
    new Message('assistant', 'Response 2'),
  ]

  const conversation = generator.getConversation(messages)

  expect(conversation[0].role).toBe('system')
  expect(conversation[0].content).toBe('Important system instructions')
})

test('Generator getConversation with more messages than length', () => {
  const generator = new Generator(store.config)
  store.config.llm.conversationLength = 1

  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello 1'),
    new Message('assistant', 'Response 1'),
    new Message('user', 'Hello 2'),
    new Message('assistant', 'Response 2'),
    new Message('user', 'Hello 3'),
    new Message('assistant', 'Response 3'),
  ]

  const conversation = generator.getConversation(messages)

  // With length=1, should only include system + last pair (excluding very last message)
  expect(conversation).toHaveLength(2) // system + 'Hello 3' (excludes 'Response 3')
  expect(conversation[1].content).toBe('Hello 3')
})

// ============================================================================
// Error Handling Tests
// ============================================================================

test('Generator handles missing API key error', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'no api key'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockImplementation(() => {
    const error: any = new Error('Missing apiKey')
    error.name = 'NoApiKeyError'
    error.status = 401
    throw error
  })

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(result).toBe('missing_api_key')
  expect(messages[2].content).toContain('generator.errors.missingApiKey')
})

test('Generator handles out of credits error', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'no credit left'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockImplementation(() => {
    const error: any = new Error('Your balance is too low')
    error.name = 'LowBalanceError'
    error.status = 402
    throw error
  })

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(result).toBe('out_of_credits')
  expect(messages[2].content).toContain('generator.errors.outOfCredits')
})

test('Generator handles quota exceeded error', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'quota exceeded'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockImplementation(() => {
    const error: any = new Error('You have exceeded your quota')
    error.name = 'QuotaExceededError'
    error.status = 429
    throw error
  })

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(result).toBe('quota_exceeded')
  expect(messages[2].content).toContain('generator.errors.quotaExceeded')
})

test('Generator handles network error', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockImplementation(() => {
    const error: any = new Error('Network error')
    error.name = 'NetworkError'
    error.cause = { stack: 'proxy error' }
    throw error
  })

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(result).toBe('error')
  expect(messages[2].content).toContain('generator.errors.networkError')
})

test('Generator handles generic error', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockImplementation(() => {
    throw new Error('Generic error')
  })

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(result).toBe('error')
  expect(messages[2].content).toContain('generator.errors.couldNotGenerate')
})

// ============================================================================
// Streaming Tests
// ============================================================================

test('Generator streaming mode accumulates content', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Hello', done: false } as LlmChunk
    yield { type: 'content', text: ' World', done: false } as LlmChunk
    yield { type: 'content', text: '!', done: false } as LlmChunk
    yield { type: 'content', text: '', done: true } as LlmChunk
  })())

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(result).toBe('success')
  expect(messages[2].content).toBe('Hello World!')
})

test('Generator non-streaming mode sets content directly', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.complete.mockResolvedValue({
    type: 'text',
    content: 'Complete response'
  })

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: false })

  expect(result).toBe('success')
  expect(messages[2].content).toBe('Complete response')
})

test('Generator handles streaming not supported error', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockImplementation(() => {
    const error: any = new Error("'stream' does not support true")
    error.status = 400
    throw error
  })

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  // Generator returns 'streaming_not_supported' for this specific error
  expect(result).toBe('streaming_not_supported')
})

// ============================================================================
// Tool Calls and Content Processing Tests
// ============================================================================

test('Generator handles tool calls in streaming', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'What is the weather?'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'tool', id: 'tool1', name: 'get_weather', call: { params: { location: 'NYC' }, result: null }, done: false } as LlmChunk
    yield { type: 'tool', id: 'tool1', name: 'get_weather', call: { params: { location: 'NYC' }, result: '72°F' }, done: true } as LlmChunk
    yield { type: 'content', text: 'The weather is 72°F', done: true } as LlmChunk
  })())

  const chunks: LlmChunk[] = []
  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true }, (chunk) => {
    if (chunk) chunks.push(chunk)
  })

  expect(result).toBe('success')
  expect(chunks.some(c => c.type === 'tool')).toBe(true)
  expect(messages[2].toolCalls).toHaveLength(1)
  expect(messages[2].toolCalls[0].name).toBe('get_weather')
})

test('Generator tracks usage information', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } } as LlmChunk
    yield { type: 'content', text: 'Response', done: true } as LlmChunk
  })())

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true, usage: true })

  expect(result).toBe('success')
  expect(messages[2].usage).toBeDefined()
  expect(messages[2].usage.inputTokens).toBe(10)
  expect(messages[2].usage.outputTokens).toBe(20)
})

test('Generator handles transient messages', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Thinking...', done: false } as LlmChunk
    yield { type: 'content', text: 'Final response', done: true } as LlmChunk
  })())

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(result).toBe('success')
  expect(messages[2].transient).toBe(false)
  expect(messages[2].content).toContain('Final response')
})

test('Generator finalizes message correctly', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Response', done: true } as LlmChunk
  })())

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true })

  expect(result).toBe('success')
  expect(messages[2].type).toBe('text')
  expect(messages[2].transient).toBe(false)
})
