import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { LlmChunk } from 'multi-llm-ts'
import { useWindowMock } from '@tests/mocks/window'
import Generator from '@services/generator'
import { store } from '@services/store'
import Message from '@models/message'

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
        { id: 'chat', name: 'Chat Model', capabilities: { tools: true, vision: false, reasoning: false, caching: true } }
      ]
    },
    model: {
      chat: 'chat'
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
  llmMock.generate.mockImplementation((model: string, conv: any, opts: any) => {
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
  expect(messages[2].toolCalls[0].function).toBe('get_weather')
})

test('Generator tracks usage information', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'usage', usage: { prompt_tokens: 10, completion_tokens: 20 } } as LlmChunk
    yield { type: 'content', text: 'Response', done: true } as LlmChunk
  })())

  const result = await generator.generate(llmMock, messages, { model: 'chat', streaming: true, usage: true })

  expect(result).toBe('success')
  expect(messages[2].usage).toBeDefined()
  expect(messages[2].usage.prompt_tokens).toBe(10)
  expect(messages[2].usage.completion_tokens).toBe(20)
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

// ============================================================================
// Doc Repo Query Tests
// ============================================================================

test('Generator adds dummy tool call when doc repo is queried with results', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'What is the capital of France?'),
    new Message('assistant', '')
  ]

  // Mock doc repo list with a test repo
  const mockList = vi.fn().mockReturnValue([
    { uuid: 'test-repo-id', name: 'Geography Knowledge Base', workspaceId: store.config.workspaceId }
  ])
  window.api.docrepo.list = mockList

  // Mock doc repo query with results
  const mockQuery = vi.fn().mockResolvedValue([
    { content: 'Paris is the capital of France', metadata: { title: 'Geography', uuid: 'doc1' }, score: 0.95 },
    { content: 'France is in Europe', metadata: { title: 'European Countries', uuid: 'doc2' }, score: 0.85 }
  ])
  window.api.docrepo.query = mockQuery

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Paris', done: true } as LlmChunk
  })())

  const chunks: LlmChunk[] = []
  const result = await generator.generate(llmMock, messages, {
    model: 'chat',
    streaming: true,
    docrepo: 'test-repo-id'
  }, (chunk) => {
    if (chunk) chunks.push(chunk)
  })

  expect(result).toBe('success')
  expect(mockQuery).toHaveBeenCalledWith('test-repo-id', 'What is the capital of France?')

  // Check that tool calls were added
  expect(messages[2].toolCalls).toHaveLength(1)
  const toolCall = messages[2].toolCalls[0]
  expect(toolCall.function).toBe('search_knowledge_base')
  expect(toolCall.state).toBe('completed')
  expect(toolCall.args.query).toBe('What is the capital of France?')
  expect(toolCall.args.docRepoName).toBe('Geography Knowledge Base')
  expect(toolCall.result.count).toBe(2)
  expect(toolCall.result.sources).toHaveLength(2)
  // Check full source objects are included
  expect(toolCall.result.sources[0].content).toBe('Paris is the capital of France')
  expect(toolCall.result.sources[0].metadata.title).toBe('Geography')
  expect(toolCall.result.sources[0].score).toBe(0.95)
  expect(toolCall.result.sources[1].content).toBe('France is in Europe')
  expect(toolCall.result.sources[1].metadata.title).toBe('European Countries')
  expect(toolCall.result.sources[1].score).toBe(0.85)

  // Verify that callback was called with both running and completed tool calls
  const toolChunks = chunks.filter(c => c.type === 'tool')
  expect(toolChunks.length).toBeGreaterThanOrEqual(2) // at least running and completed
})

test('Generator adds dummy tool call when doc repo query returns no results', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'What is the capital of Mars?'),
    new Message('assistant', '')
  ]

  // Mock doc repo list
  const mockList = vi.fn().mockReturnValue([
    { uuid: 'test-repo-id', name: 'Space Facts', workspaceId: store.config.workspaceId }
  ])
  window.api.docrepo.list = mockList

  // Mock doc repo query with no results
  const mockQuery = vi.fn().mockResolvedValue([])
  window.api.docrepo.query = mockQuery

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'I dont know', done: true } as LlmChunk
  })())

  const result = await generator.generate(llmMock, messages, {
    model: 'chat',
    streaming: true,
    docrepo: 'test-repo-id'
  })

  expect(result).toBe('success')
  expect(mockQuery).toHaveBeenCalledWith('test-repo-id', 'What is the capital of Mars?')

  // Check that tool call was added with zero results
  expect(messages[2].toolCalls).toHaveLength(1)
  const toolCall = messages[2].toolCalls[0]
  expect(toolCall.function).toBe('search_knowledge_base')
  expect(toolCall.state).toBe('completed')
  expect(toolCall.result.count).toBe(0)
  expect(toolCall.result.sources).toHaveLength(0)
})

test('Generator respects noToolsInContent option for doc repo tool calls', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Query'),
    new Message('assistant', '')
  ]

  // Mock doc repo list
  const mockList = vi.fn().mockReturnValue([
    { uuid: 'test-repo-id', name: 'Test Repo', workspaceId: store.config.workspaceId }
  ])
  window.api.docrepo.list = mockList

  // Mock doc repo query
  const mockQuery = vi.fn().mockResolvedValue([
    { content: 'Result', metadata: { title: 'Doc', uuid: 'doc1' }, score: 0.9 }
  ])
  window.api.docrepo.query = mockQuery

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Response', done: true } as LlmChunk
  })())

  await generator.generate(llmMock, messages, {
    model: 'chat',
    streaming: true,
    docrepo: 'test-repo-id',
    noToolsInContent: true
  })

  // Tool call should be in toolCalls array
  expect(messages[2].toolCalls).toHaveLength(1)

  // But should not be in content (no <tool> placeholder)
  expect(messages[2].content).not.toContain('<tool')
})

test('Generator works without doc repo option', async () => {
  const generator = new Generator(store.config)
  const messages = [
    new Message('system', 'System'),
    new Message('user', 'Hello'),
    new Message('assistant', '')
  ]

  const mockQuery = vi.fn()
  window.api.docrepo.query = mockQuery

  llmMock.generate.mockReturnValue((async function* () {
    yield { type: 'content', text: 'Hi', done: true } as LlmChunk
  })())

  const result = await generator.generate(llmMock, messages, {
    model: 'chat',
    streaming: true
  })

  expect(result).toBe('success')
  expect(mockQuery).not.toHaveBeenCalled()
  expect(messages[2].toolCalls).toHaveLength(0)
})
