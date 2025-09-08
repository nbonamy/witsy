import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { createI18nMock } from '../mocks/index'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import AgentGenerator from '../../src/services/agent_generator'
import LlmFactory from '../../src/llms/llm'

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

// Mock LlmUtils to avoid complex LLM manager setup
vi.mock('../../src/services/llm_utils', () => {
  return {
    default: class MockLlmUtils {
      constructor() {}
      getEngineModelForTask() {
        return { engine: 'openai', model: 'gpt-4' }
      }
    }
  }
})

// Mock the LLM Factory to return our mock LLM
vi.mock('../../src/llms/llm', () => {
  return {
    default: {
      manager: vi.fn(() => ({
        igniteEngine: vi.fn(),
        getChatModel: vi.fn(() => ({ id: 'gpt-4' })),
        checkModelsCapabilities: vi.fn()
      }))
    }
  }
})

// Mock useTools composable
vi.mock('../../src/composables/useTools', () => ({
  useTools: vi.fn(() => ({
    getToolsForGeneration: vi.fn().mockResolvedValue('Available tools: search, writeFile, calculator')
  }))
}))

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// Helper function to create a valid agent generation response
const createValidAgentResponse = () => ({
  name: 'Research Assistant',
  description: 'An AI agent that researches topics and creates comprehensive reports',
  type: 'runnable',
  instructions: 'You are a research assistant that conducts thorough research and creates detailed reports on any given topic.',
  steps: [
    {
      description: 'Search for information',
      prompt: 'Search for comprehensive information about {{topic}}',
      tools: ['search'],
      agents: []
    },
    {
      description: 'Create detailed report',
      prompt: 'Create a comprehensive report based on the following research data: {{output.1}}',
      tools: ['writeFile'],
      agents: []
    }
  ]
})

const createValidAgentWithScheduleResponse = () => ({
  name: 'Daily News Summarizer',
  description: 'An AI agent that summarizes daily news every morning',
  type: 'runnable',
  instructions: 'You are a news summarization agent that creates daily news summaries.',
  schedule: '0 9 * * *', // Daily at 9 AM
  steps: [
    {
      description: 'Fetch latest news',
      prompt: 'Search for latest news articles from today',
      tools: ['search'],
      agents: []
    },
    {
      description: 'Create news summary',
      prompt: 'Summarize the following news articles: {{output.1}}',
      tools: ['writeFile'],
      agents: []
    }
  ]
})

test('Successfully generates agent from description', async () => {
  const validResponse = createValidAgentResponse()
  
  // Mock the LLM to return valid agent JSON via streaming
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: JSON.stringify(validResponse) }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription('Create a research assistant')

  expect(result).not.toBeNull()
  expect(result!.name).toBe('Research Assistant')
  expect(result!.description).toBe('An AI agent that researches topics and creates comprehensive reports')
  expect(result!.type).toBe('runnable')
  expect(result!.instructions).toBe('You are a research assistant that conducts thorough research and creates detailed reports on any given topic.')
  expect(result!.steps).toHaveLength(2)
  expect(result!.steps[0].description).toBe('Search for information')
  expect(result!.steps[0].tools).toEqual(['search'])
  expect(result!.steps[1].description).toBe('Create detailed report')
  expect(result!.steps[1].tools).toEqual(['writeFile'])

  // Verify LLM was called with proper arguments
  expect(mockLlm.generate).toHaveBeenCalledWith(
    { id: 'test-model' },
    expect.arrayContaining([
      expect.objectContaining({ role: 'system' }),
      expect.objectContaining({ role: 'user' })
    ]),
    expect.objectContaining({
      tools: false,
      structuredOutput: expect.objectContaining({
        name: 'agent',
        structure: expect.any(Object)
      })
    })
  )
})

test('Successfully generates agent with schedule when requested', async () => {
  const validResponse = createValidAgentWithScheduleResponse()
  
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: JSON.stringify(validResponse) }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription('Create a daily news summarizer that runs every morning at 9 AM')

  expect(result).not.toBeNull()
  expect(result!.name).toBe('Daily News Summarizer')
  expect(result!.schedule).toBe('0 9 * * *')
  expect(result!.steps).toHaveLength(2)
})

test('Uses specified engine and model when provided', async () => {
  const validResponse = createValidAgentResponse()
  
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: JSON.stringify(validResponse) }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'custom-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription(
    'Create a research assistant',
    'openai',
    'gpt-4'
  )

  expect(result).not.toBeNull()
  
  // Verify the specified model was used
  const llmManager = vi.mocked(LlmFactory.manager).mock.results[0].value
  expect(llmManager.igniteEngine).toHaveBeenCalledWith('openai')
  expect(llmManager.getChatModel).toHaveBeenCalledWith('openai', 'gpt-4')
})

test('Handles LLM response wrapped in markdown code blocks', async () => {
  const validResponse = createValidAgentResponse()
  const markdownWrappedResponse = '```json\n' + JSON.stringify(validResponse) + '\n```'
  
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: markdownWrappedResponse }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription('Create a research assistant')

  expect(result).not.toBeNull()
  expect(result!.name).toBe('Research Assistant')
})

test('Handles structured output response (already parsed object)', async () => {
  const validResponse = createValidAgentResponse()
  
  // When structured output is used, the agent_generator's parseAndValidateResponse
  // handles both string and object responses, but for streaming we still get string chunks
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: JSON.stringify(validResponse) }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription('Create a research assistant')

  expect(result).not.toBeNull()
  expect(result!.name).toBe('Research Assistant')
})

test('Returns null when LLM response is invalid JSON', async () => {
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: 'This is not valid JSON at all!' }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription('Create a research assistant')

  expect(result).toBeNull()
})

test('Returns null when required fields are missing', async () => {
  const invalidResponse = {
    // Missing name and description
    type: 'runnable',
    instructions: 'Some instructions',
    steps: []
  }
  
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: JSON.stringify(invalidResponse) }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription('Create a research assistant')

  expect(result).toBeNull()
})

test('Returns null when steps are missing or empty', async () => {
  const invalidResponse = {
    name: 'Test Agent',
    description: 'Test Description',
    type: 'runnable',
    instructions: 'Some instructions',
    steps: [] // Empty steps array
  }
  
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: JSON.stringify(invalidResponse) }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription('Create a research assistant')

  expect(result).toBeNull()
})

test('Returns null when LLM throws an error', async () => {
  
  const mockLlm = {
    // eslint-disable-next-line require-yield
    generate: vi.fn().mockImplementation(async function* () {
      throw new Error('LLM API error')
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription('Create a research assistant')

  expect(result).toBeNull()
})

test('Applies default values when optional fields are missing', async () => {
  const responseWithMissingOptionals = {
    name: 'Basic Agent',
    description: 'Basic Description',
    // Missing type, instructions, schedule
    steps: [
      {
        description: 'Do something',
        prompt: 'Do something with {{input}}',
        // Missing tools and agents arrays
      }
    ]
  }
  
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: JSON.stringify(responseWithMissingOptionals) }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  const result = await generator.generateAgentFromDescription('Create a basic agent')

  expect(result).not.toBeNull()
  expect(result!.name).toBe('Basic Agent')
  expect(result!.description).toBe('Basic Description')
  expect(result!.type).toBe('runnable') // Default value applied
  expect(result!.instructions).toBe('') // Default value applied
  expect(result!.schedule).toBeNull() // Default value applied
  expect(result!.steps).toHaveLength(1)
  expect(result!.steps[0].tools).toEqual([]) // Default value applied
  expect(result!.steps[0].agents).toEqual([]) // Default value applied
})

test('Builds system and user prompts correctly', async () => {
  const validResponse = createValidAgentResponse()
  
  const mockLlm = {
    generate: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: JSON.stringify(validResponse) }
    })
  }
  
  vi.mocked(LlmFactory.manager).mockReturnValue({
    igniteEngine: vi.fn().mockReturnValue(mockLlm),
    getChatModel: vi.fn().mockReturnValue({ id: 'test-model' }),
    checkModelsCapabilities: vi.fn()
  } as any)

  const generator = new AgentGenerator(store.config)
  await generator.generateAgentFromDescription('Create a research assistant for academic papers')

  // Verify the messages passed to LLM contain expected content
  const messages = mockLlm.generate.mock.calls[0][1]
  
  expect(messages).toHaveLength(2)
  expect(messages[0].role).toBe('system')
  expect(messages[0].content).toContain('You are an expert AI agent configuration generator')
  expect(messages[0].content).toContain('Available tools: search, writeFile, calculator')
  
  expect(messages[1].role).toBe('user')
  expect(messages[1].content).toContain('Create a research assistant for academic papers')
  expect(messages[1].content).toContain('Return the complete JSON configuration')
})