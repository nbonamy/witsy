import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import A2AClient, { A2AChunk } from '../../src/services/a2a-client'
import Agent from '../../src/models/agent'

// Mock the A2A SDK
vi.mock('@a2a-js/sdk', () => ({
  MessageSendParams: vi.fn(),
  Task: vi.fn(),
  TaskArtifactUpdateEvent: vi.fn(),
  TaskStatusUpdateEvent: vi.fn(),
}))

// Create sendMessageStream mock
const mockSendMessageStream = vi.fn()

// Mock the A2A SDK client
vi.mock('@a2a-js/sdk/client', () => ({
  A2AClient: vi.fn(() => ({
    sendMessageStream: mockSendMessageStream
  }))
}))

// Import the mocked client to access it in tests
import { A2AClient as MockedA2AClient } from '@a2a-js/sdk/client'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

let a2aClient: A2AClient
const baseUrl = 'https://test-agent.example.com'

beforeAll(() => {
  // Mock crypto.randomUUID
  if (!global.crypto) {
    global.crypto = {} as any
  }
  (global.crypto as any).randomUUID = vi.fn(() => 'test-uuid-123')
})

beforeEach(() => {
  vi.clearAllMocks()
  a2aClient = new A2AClient(baseUrl)
})

test('A2AClient Creation', () => {
  expect(a2aClient).toBeDefined()
  expect(a2aClient.baseUrl).toBe(baseUrl)
})

test('getAgent - Success', async () => {
  const mockAgentResponse = {
    name: 'Test A2A Agent',
    description: 'A test agent from A2A service'
  }

  mockFetch.mockResolvedValueOnce({
    json: vi.fn().mockResolvedValue(mockAgentResponse)
  })

  const agent = await a2aClient.getAgent()

  expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/.well-known/agent.json`)
  expect(agent).toBeInstanceOf(Agent)
  expect(agent).not.toBeNull()
  expect(agent!.source).toBe('a2a')
  expect(agent!.name).toBe('Test A2A Agent')
  expect(agent!.description).toBe('A test agent from A2A service')
  expect(agent!.instructions).toBe(baseUrl)
})

test('getAgent - Fetch Error', async () => {
  mockFetch.mockRejectedValueOnce(new Error('Network error'))

  const agent = await a2aClient.getAgent()

  expect(agent).toBeNull()
})

test('getAgent - Invalid JSON', async () => {
  mockFetch.mockResolvedValueOnce({
    json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
  })

  const agent = await a2aClient.getAgent()

  expect(agent).toBeNull()
})

test('execute - Task Creation and Status Updates', async () => {
  const taskId = 'task-123'
  const contextId = 'context-456'
  const prompt = 'Test prompt for A2A agent'

  // Mock the stream events
  const mockEvents = [
    // Task creation event
    {
      kind: 'task',
      id: taskId,
      contextId: contextId,
    },
    // Status update event
    {
      kind: 'status-update',
      status: {
        state: 'processing',
        message: {
          parts: [{ kind: 'text', text: 'Processing your request' }]
        }
      },
      final: false
    },
    // Final status update
    {
      kind: 'status-update',
      status: {
        state: 'completed',
        message: {
          parts: [{ kind: 'text', text: 'Task completed successfully' }]
        }
      },
      final: true
    }
  ]

  // Mock the async iterator
  mockSendMessageStream.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const event of mockEvents) {
        yield event
      }
    }
  })

  const chunks: A2AChunk[] = []
  for await (const chunk of a2aClient.execute(prompt)) {
    chunks.push(chunk)
  }

  // Verify client was created with correct baseUrl
  expect(MockedA2AClient).toHaveBeenCalledWith(baseUrl)

  // Verify sendMessageStream was called with correct parameters
  expect(mockSendMessageStream).toHaveBeenCalledWith({
    message: {
      messageId: 'test-uuid-123',
      role: 'user',
      parts: [{ kind: 'text', text: prompt }],
      kind: 'message'
    }
  })

  // Task creation status
  expect(chunks[0]).toEqual({
    type: 'status',
    taskId: taskId,
    contextId: contextId,
  })

  // Processing status
  expect(chunks[1]).toEqual({
    type: 'content',
    text: 'Processing your request',
    done: false,
  })

  // Completion status
  expect(chunks[2]).toEqual({
    type: 'content',
    text: 'Task completed successfully',
    done: false,
  })

  // Final marker status
  expect(chunks[3]).toEqual({
    type: 'status',
  })

  // Final done chunk
  expect(chunks[4]).toEqual({
    type: 'content',
    text: '',
    done: true
  })
})

test('execute - Artifact Updates', async () => {
  const taskId = 'task-456'
  const artifactId = 'artifact-123'
  const prompt = 'Create a document'

  const mockEvents = [
    // Task creation
    {
      kind: 'task',
      id: taskId,
      status: { state: 'running' }
    },
    // Artifact update - first chunk
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: artifactId,
        name: 'Generated Document',
        parts: [{ kind: 'text', text: 'This is the first part of the document. ' }]
      },
      lastChunk: false
    },
    // Artifact update - second chunk
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: artifactId,
        name: 'Generated Document',
        parts: [{ kind: 'text', text: 'This is the second part.' }]
      },
      lastChunk: false
    },
    // Artifact update - file part
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: artifactId,
        name: 'Generated Document',
        parts: [{ kind: 'file', file: { name: 'attachment.pdf' } }]
      },
      lastChunk: false
    },
    // Artifact update - final chunk
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: artifactId,
        name: 'Generated Document',
        parts: [{ kind: 'text', text: ' Final part.' }]
      },
      lastChunk: true
    },
    // Final status
    {
      kind: 'status-update',
      status: { state: 'completed' },
      final: true
    }
  ]

  mockSendMessageStream.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const event of mockEvents) {
        yield event
      }
    }
  })

  const chunks: A2AChunk[] = []
  for await (const chunk of a2aClient.execute(prompt)) {
    chunks.push(chunk)
  }

  // Find the artifact chunk
  const artifactChunk = chunks.find(chunk => chunk.type === 'artifact')
  expect(artifactChunk).toEqual({
    type: 'artifact',
    name: 'Generated Document',
    content: 'This is the first part of the document. This is the second part.File: attachment.pdf Final part.'
  })
})

test('execute - Direct Message Response', async () => {
  const prompt = 'Simple question'

  const mockEvents = [
    // Direct message response (no task)
    {
      kind: 'message',
      role: 'assistant',
      content: 'Direct response from agent'
    }
  ]

  mockSendMessageStream.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const event of mockEvents) {
        yield event
      }
    }
  })

  const chunks: A2AChunk[] = []
  for await (const chunk of a2aClient.execute(prompt)) {
    chunks.push(chunk)
  }

  // Should have start chunk, direct message chunk, and done chunk
  expect(chunks).toHaveLength(2)

  // Check direct message chunk
  const messageChunk = chunks.find(chunk => 
    chunk.type === 'content' && 'text' in chunk && chunk.text.includes('Received message response')
  )
  expect(messageChunk).toBeDefined()
  if (messageChunk && 'text' in messageChunk) {
    expect(messageChunk.text).toContain('Direct response from agent')
  }
})

test('execute - Status Update Without Message', async () => {
  const taskId = 'task-789'
  const prompt = 'Test without message'

  const mockEvents = [
    {
      kind: 'task',
      id: taskId,
      status: { state: 'running' }
    },
    {
      kind: 'status-update',
      status: {
        state: 'processing'
        // No message field
      },
      final: false
    },
    {
      kind: 'status-update',
      status: { state: 'completed' },
      final: true
    }
  ]

  mockSendMessageStream.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const event of mockEvents) {
        yield event
      }
    }
  })

  const chunks: A2AChunk[] = []
  for await (const chunk of a2aClient.execute(prompt)) {
    chunks.push(chunk)
  }

  expect(chunks).toHaveLength(3)
  const statusChunks = chunks.filter(chunk => chunk.type === 'status')
  expect(statusChunks).toHaveLength(2)
})

test('execute - Artifact Without Name', async () => {
  const taskId = 'task-unnamed'
  const artifactId = 'artifact-unnamed'
  const prompt = 'Create unnamed artifact'

  const mockEvents = [
    {
      kind: 'task',
      id: taskId,
      status: { state: 'running' }
    },
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: artifactId,
        // No name field
        parts: [{ kind: 'text', text: 'Content without name' }]
      },
      lastChunk: true
    },
    {
      kind: 'status-update',
      status: { state: 'completed' },
      final: true
    }
  ]

  mockSendMessageStream.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const event of mockEvents) {
        yield event
      }
    }
  })

  const chunks: A2AChunk[] = []
  for await (const chunk of a2aClient.execute(prompt)) {
    chunks.push(chunk)
  }

  const artifactChunk = chunks.find(chunk => chunk.type === 'artifact')
  expect(artifactChunk).toEqual({
    type: 'artifact',
    name: `Artifact ${artifactId}`,
    content: 'Content without name'
  })
})

test('execute - Stream Error Handling', async () => {
  const prompt = 'Error test'

  mockSendMessageStream.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      throw new Error('Stream error')
      yield // This line is unreachable but satisfies the generator requirement
    }
  })

  await expect(async () => {
    const chunks: A2AChunk[] = []
    for await (const chunk of a2aClient.execute(prompt)) {
      chunks.push(chunk)
    }
  }).rejects.toThrow('Stream error')
})

test('execute - Multiple Artifacts', async () => {
  const taskId = 'task-multi'
  const prompt = 'Create multiple artifacts'

  const mockEvents = [
    {
      kind: 'task',
      id: taskId,
      status: { state: 'running' }
    },
    // First artifact
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: 'artifact-1',
        name: 'First Document',
        parts: [{ kind: 'text', text: 'First content' }]
      },
      lastChunk: true
    },
    // Second artifact
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: 'artifact-2',
        name: 'Second Document',
        parts: [{ kind: 'text', text: 'Second content' }]
      },
      lastChunk: true
    },
    {
      kind: 'status-update',
      status: { state: 'completed' },
      final: true
    }
  ]

  mockSendMessageStream.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const event of mockEvents) {
        yield event
      }
    }
  })

  const chunks: A2AChunk[] = []
  for await (const chunk of a2aClient.execute(prompt)) {
    chunks.push(chunk)
  }

  const artifactChunks = chunks.filter(chunk => chunk.type === 'artifact')
  expect(artifactChunks).toHaveLength(2)

  expect(artifactChunks[0]).toEqual({
    type: 'artifact',
    name: 'First Document',
    content: 'First content'
  })

  expect(artifactChunks[1]).toEqual({
    type: 'artifact',
    name: 'Second Document',
    content: 'Second content'
  })
})

test('execute - Empty Prompt', async () => {
  const prompt = ''

  const mockEvents = [
    {
      kind: 'status-update',
      status: { state: 'completed' },
      final: true
    }
  ]

  mockSendMessageStream.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const event of mockEvents) {
        yield event
      }
    }
  })

  const chunks: A2AChunk[] = []
  for await (const chunk of a2aClient.execute(prompt)) {
    chunks.push(chunk)
  }

  expect(chunks).toHaveLength(2)

  // Verify message params were sent with empty prompt
  expect(mockSendMessageStream).toHaveBeenCalledWith({
    message: {
      messageId: 'test-uuid-123',
      role: 'user',
      parts: [{ kind: 'text', text: '' }],
      kind: 'message'
    }
  })
})

test('execute - Large Artifact Content', async () => {
  const taskId = 'task-large'
  const artifactId = 'artifact-large'
  const prompt = 'Create large document'

  // Simulate chunked artifact content
  const chunks1 = Array(100).fill('chunk1 ')
  const chunks2 = Array(100).fill('chunk2 ')
  const chunks3 = Array(100).fill('chunk3 ')

  const mockEvents = [
    {
      kind: 'task',
      id: taskId,
      status: { state: 'running' }
    },
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: artifactId,
        name: 'Large Document',
        parts: [{ kind: 'text', text: chunks1.join('') }]
      },
      lastChunk: false
    },
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: artifactId,
        name: 'Large Document',
        parts: [{ kind: 'text', text: chunks2.join('') }]
      },
      lastChunk: false
    },
    {
      kind: 'artifact-update',
      artifact: {
        artifactId: artifactId,
        name: 'Large Document',
        parts: [{ kind: 'text', text: chunks3.join('') }]
      },
      lastChunk: true
    },
    {
      kind: 'status-update',
      status: { state: 'completed' },
      final: true
    }
  ]

  mockSendMessageStream.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const event of mockEvents) {
        yield event
      }
    }
  })

  const outputChunks: A2AChunk[] = []
  for await (const chunk of a2aClient.execute(prompt)) {
    outputChunks.push(chunk)
  }

  const artifactChunk = outputChunks.find(chunk => chunk.type === 'artifact')
  expect(artifactChunk).toBeDefined()
  if (artifactChunk && artifactChunk.type === 'artifact') {
    expect(artifactChunk.content).toBe(chunks1.join('') + chunks2.join('') + chunks3.join(''))
    expect(artifactChunk.content.length).toBeGreaterThan(1000)
  }
})
