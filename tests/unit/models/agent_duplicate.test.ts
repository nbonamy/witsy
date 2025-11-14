import { vi, beforeAll, expect, test, describe } from 'vitest'
import Agent from '../../src/models/agent'
import { useWindowMock } from '../mocks/window'

// Mock i18n
vi.mock('../../src/renderer/services/i18n', () => ({
  t: (key: string) => {
    if (key === 'agent.copySuffix') return 'Copy'
    return key
  }
}))

beforeAll(() => {
  useWindowMock()
})

describe('Agent.duplicate()', () => {
  test('Creates new agent with different UUID', () => {
    const original = new Agent()
    original.uuid = 'original-uuid'
    original.name = 'Test Agent'

    const duplicated = original.duplicate()

    expect(duplicated.uuid).not.toBe(original.uuid)
    expect(duplicated.uuid).toBeTruthy()
    expect(duplicated.uuid.length).toBeGreaterThan(0)
  })

  test('Appends " - Copy" suffix to name', () => {
    const original = new Agent()
    original.name = 'Test Agent'

    const duplicated = original.duplicate()

    expect(duplicated.name).toBe('Test Agent - Copy')
  })

  test('Creates new timestamps', () => {
    const original = new Agent()
    const originalCreatedAt = original.createdAt
    const originalUpdatedAt = original.updatedAt

    // Wait a bit to ensure different timestamps
    vi.useFakeTimers()
    vi.advanceTimersByTime(1000)

    const duplicated = original.duplicate()

    expect(duplicated.createdAt).not.toBe(originalCreatedAt)
    expect(duplicated.updatedAt).not.toBe(originalUpdatedAt)
    expect(duplicated.createdAt).toBe(duplicated.updatedAt)

    vi.useRealTimers()
  })

  test('Copies all basic properties', () => {
    const original = new Agent()
    original.source = 'witsy'
    original.description = 'Test description'
    original.type = 'runnable'
    original.engine = 'openai'
    original.model = 'gpt-4'
    original.disableStreaming = true
    original.locale = 'en-US'
    original.instructions = 'Test instructions'
    original.schedule = '0 0 * * *'
    original.webhookToken = 'test-token'

    const duplicated = original.duplicate()

    expect(duplicated.source).toBe(original.source)
    expect(duplicated.description).toBe(original.description)
    expect(duplicated.type).toBe(original.type)
    expect(duplicated.engine).toBe(original.engine)
    expect(duplicated.model).toBe(original.model)
    expect(duplicated.disableStreaming).toBe(original.disableStreaming)
    expect(duplicated.locale).toBe(original.locale)
    expect(duplicated.instructions).toBe(original.instructions)
    expect(duplicated.schedule).toBe(original.schedule)
    expect(duplicated.webhookToken).toBe(original.webhookToken)
  })

  test('Deep copies modelOpts', () => {
    const original = new Agent()
    original.modelOpts = { temperature: 0.7, maxTokens: 1000 }

    const duplicated = original.duplicate()

    expect(duplicated.modelOpts).toEqual(original.modelOpts)
    expect(duplicated.modelOpts).not.toBe(original.modelOpts) // Different object reference

    // Modifying duplicate should not affect original
    if (duplicated.modelOpts) {
      duplicated.modelOpts.temperature = 0.9
    }
    expect(original.modelOpts?.temperature).toBe(0.7)
  })

  test('Deep copies parameters array', () => {
    const original = new Agent()
    original.parameters = [
      { name: 'param1', type: 'string', description: 'Test param' }
    ]

    const duplicated = original.duplicate()

    expect(duplicated.parameters).toEqual(original.parameters)
    expect(duplicated.parameters).not.toBe(original.parameters) // Different array reference

    // Modifying duplicate should not affect original
    duplicated.parameters.push({ name: 'param2', type: 'number', description: 'Another param' })
    expect(original.parameters).toHaveLength(1)
  })

  test('Deep copies steps array', () => {
    const original = new Agent()
    original.steps = [
      {
        prompt: 'Test prompt',
        tools: ['tool1', 'tool2'],
        agents: ['agent1']
      },
      {
        prompt: 'Second step',
        tools: [],
        agents: []
      }
    ]

    const duplicated = original.duplicate()

    expect(duplicated.steps).toEqual(original.steps)
    expect(duplicated.steps).not.toBe(original.steps) // Different array reference

    // Modifying duplicate should not affect original
    duplicated.steps[0].prompt = 'Modified prompt'
    duplicated.steps[0].tools?.push('tool3')
    expect(original.steps[0].prompt).toBe('Test prompt')
    expect(original.steps[0].tools).toHaveLength(2)
  })

  test('Deep copies invocationValues', () => {
    const original = new Agent()
    original.invocationValues = { key1: 'value1', key2: 'value2' }

    const duplicated = original.duplicate()

    expect(duplicated.invocationValues).toEqual(original.invocationValues)
    expect(duplicated.invocationValues).not.toBe(original.invocationValues) // Different object reference

    // Modifying duplicate should not affect original
    duplicated.invocationValues.key3 = 'value3'
    expect(original.invocationValues).not.toHaveProperty('key3')
  })

  test('Handles null modelOpts', () => {
    const original = new Agent()
    original.modelOpts = null

    const duplicated = original.duplicate()

    expect(duplicated.modelOpts).toBeNull()
  })

  test('Handles empty arrays', () => {
    const original = new Agent()
    original.parameters = []
    original.steps = []

    const duplicated = original.duplicate()

    expect(duplicated.parameters).toEqual([])
    expect(duplicated.steps).toEqual([])
  })

  test('Handles empty invocationValues', () => {
    const original = new Agent()
    original.invocationValues = {}

    const duplicated = original.duplicate()

    expect(duplicated.invocationValues).toEqual({})
  })

  test('Duplicating an already duplicated agent', () => {
    const original = new Agent()
    original.name = 'Original Agent'

    const firstDuplicate = original.duplicate()
    expect(firstDuplicate.name).toBe('Original Agent - Copy')

    const secondDuplicate = firstDuplicate.duplicate()
    expect(secondDuplicate.name).toBe('Original Agent - Copy - Copy')
  })
})
