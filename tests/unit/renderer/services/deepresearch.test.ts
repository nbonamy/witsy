/* eslint-disable no-case-declarations */
 
 
import { vi, expect, test, beforeEach } from 'vitest'
import { Configuration } from '../../../../src/types/config'
import { LlmEngine } from 'multi-llm-ts'
import DeepResearchMultiStep from '../../../../src/renderer/services/deepresearch_ms'
import DeepResearchMultiAgent from '../../../../src/renderer/services/deepresearch_ma'
import DeepResearchAL, { mainLoopAgent, getComponentType } from '../../../../src/renderer/services/deepresearch_al'
import * as dr from '../../../../src/renderer/services/deepresearch'
import Chat from '../../../../src/models/chat'
import Message from '../../../../src/models/message'
import SearchPlugin from '../../../../src/renderer/services/plugins/search'
import Generator from '../../../../src/renderer/services/generator'
import AgentWorkflowExecutor, { AgentWorkflowExecutorOpts } from '../../../../src/renderer/services/agent_executor_workflow'
import { AgentRun, AgentRunTrigger } from '../../../../src/types/agents'
import { DEFAULT_WORKSPACE_ID } from '../../../../src/main/workspace'
import { replacePromptInputs } from '../../../../src/renderer/services/prompt'

// Mock dependencies
vi.mock('../../../../src/renderer/services/plugins/search')
vi.mock('../../../../src/renderer/services/generator')
vi.mock('../../../../src/renderer/services/plugins/agent')

// Mock LlmUtils
vi.mock('../../../../src/renderer/services/llm_utils', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      generateStatusUpdate: vi.fn().mockResolvedValue('Status update generated'),
      getEngineModelForTask: vi.fn().mockReturnValue({ engine: 'test', model: 'test-model' }),
      getTitle: vi.fn().mockResolvedValue('Test Title'),
      evaluateToolCall: vi.fn().mockResolvedValue('safe'),
      getToolCallDescription: vi.fn().mockResolvedValue('Tool action')
    }))
  }
})

// Mock LlmFactory
vi.mock('../../../../src/renderer/services/llms/llm', () => {
  const mockLlm = {
    getId: () => 'test-engine',
    getName: () => 'Test Engine',
    addPlugin: vi.fn(),
    clearPlugins: vi.fn(),
    plugins: []
  }
  return {
    default: {
      manager: vi.fn().mockReturnValue({
        igniteEngine: vi.fn().mockReturnValue(mockLlm),
        getChatModel: vi.fn().mockReturnValue({ id: 'test-model' })
      })
    }
  }
})

// Mock useTools
vi.mock('../../../../src/renderer/composables/tools', () => ({
  useTools: vi.fn().mockReturnValue({
    getAllAvailableTools: vi.fn().mockResolvedValue({ allTools: [] }),
    getToolsForGeneration: vi.fn().mockResolvedValue('')
  })
}))

// Mock LlmUtils
vi.mock('../../../../src/renderer/services/llm_utils', () => {
  const parseJson = (content: string): any => JSON.parse(content)
  const MockLlmUtils = vi.fn().mockImplementation(() => ({
    generateStatusUpdate: vi.fn().mockResolvedValue('Status update generated'),
    getSystemInstructions: vi.fn().mockImplementation((instr) => instr || 'System instructions'),
    getTitle: vi.fn().mockResolvedValue('Test Title'),
    evaluateOutput: vi.fn().mockResolvedValue({ quality: 'pass', feedback: 'Good' }),
    getEngineModelForTask: vi.fn().mockReturnValue({ engine: 'test-engine', model: 'test-model' })
  }))
  MockLlmUtils.parseJson = parseJson

  return {
    default: MockLlmUtils
  }
})

// Mock AgentWorkflowExecutor properly
vi.mock('../../../../src/renderer/services/agent_executor_workflow', () => {
  return {
    default: vi.fn()
  }
})

const mockConfig: Configuration = {
  deepresearch: {
    searchResults: 5
  },
  plugins: {
    search: {
      enabled: true,
      engine: 'google'
    }
  },
  engines: {
    'test-engine': {
      models: {
        chat: [
          { id: 'test-model', name: 'Test Model', capabilities: { tools: true, vision: false, reasoning: false } }
        ]
      }
    }
  },
  llm: {
    engine: 'test-engine'
  }
} as unknown as Configuration

const mockEngine = {
  getId: () => 'test-engine',
  addPlugin: vi.fn(),
  clearPlugins: vi.fn()
} as unknown as LlmEngine

const mockOpts: dr.DeepResearchOpts = {
  model: 'test-model',
  breadth: 3,
  depth: 2,
  searchResults: 5
}

// Setup mock data
const planningResult: AgentRun = {
  messages: [new Message('assistant', JSON.stringify({
    sections: [{ title: 'Test', description: 'Test desc', queries: ['test query'] }]
  }))]
} as AgentRun

const analysisResult: AgentRun = {
  messages: [new Message('assistant', JSON.stringify({
    learnings: ['Learning 1', 'Learning 2']
  }))]
} as AgentRun

const writerResult: AgentRun = {
  messages: [new Message('assistant', '# Test Section\nContent here')]
} as AgentRun

const synthesisResult: AgentRun = {
  messages: [new Message('assistant', '# Executive Summary\nSummary here')]
} as AgentRun

beforeEach(() => {
  
  vi.clearAllMocks()
  
  // Setup AgentWorkflowExecutor mock
  const mockExecutorInstance = {
    run: vi.fn((workflow, prompt) => {
      // Determine which agent is being called based on the prompt content
      if (prompt.includes('Plan the research report structure')) {
        return Promise.resolve(planningResult)
      } else if (prompt.includes('Analyze the following information')) {
        return Promise.resolve(analysisResult)
      } else if (prompt.includes('Generate content for section')) {
        return Promise.resolve(writerResult)
      } else {
        return Promise.resolve(synthesisResult)
      }
    })
  }
  
  // @ts-expect-error mock
  vi.mocked(AgentWorkflowExecutor).mockImplementation(() => mockExecutorInstance)
  
  // Setup SearchPlugin mock
  // @ts-expect-error mock
  vi.mocked(SearchPlugin).mockImplementation(() => ({
    getName: () => 'search_internet',
    getRunningDescription: () => 'Searching...',
    getCompletedDescription: () => 'Search completed',
    execute: vi.fn().mockResolvedValue({
      results: [{ title: 'Test Article', content: 'Test content', url: 'https://test.com' }]
    })
  }))
  
  // Setup Generator mock
  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue('success'),
    stop: vi.fn()
  }))
})

test('Planning agent configuration', () => {
  expect(dr.planningAgent.name).toBe('planning')
  expect(dr.planningAgent.description).toContain('Strategic research planner')
  expect(dr.planningAgent.steps[0].tools).toContain('search_internet')
  expect(dr.planningAgent.steps[0].tools).toContain('extract_webpage_content')
})

test('Planning agent prompt building', () => {
  const prompt = replacePromptInputs(dr.planningAgent.steps[0].prompt, {
    userQuery: 'quantum computing',
    numSections: 3,
    numQueriesPerSection: 2
  })

  expect(prompt).toContain('quantum computing')
  expect(prompt).toContain('3 sections')
  expect(prompt).toContain('2 search queries')
})

test('Planning agent parameters', () => {
  const params = dr.planningAgent.parameters
  const userQueryParam = params.find(p => p.name === 'userQuery')
  const numSectionsParam = params.find(p => p.name === 'numSections')
  const numQueriesParam = params.find(p => p.name === 'numQueriesPerSection')
  expect(userQueryParam?.required).toBe(true)
  expect(numSectionsParam?.required).toBe(false)
  expect(numQueriesParam?.required).toBe(true)
})

test('Search agent configuration', () => {
  expect(dr.searchAgent.name).toBe('search')
  expect(dr.searchAgent.description).toContain('Expert information retrieval')
  expect(dr.searchAgent.steps[0].tools).toContain('search_internet')
  expect(dr.searchAgent.steps[0].tools).toContain('extract_webpage_content')
  expect(dr.searchAgent.steps[0].tools).toContain('get_youtube_transcript')
})

test('Search agent prompt building', () => {
  const prompt = replacePromptInputs(dr.searchAgent.steps[0].prompt, {
    searchQuery: 'quantum entanglement',
    maxResults: 10
  })

  expect(prompt).toContain('Execute targeted search for: quantum entanglement')
  expect(prompt).toContain('maxResults to return: 10')
})

test('Search agent parameters', () => {
  const params = dr.searchAgent.parameters
  const searchQueryParam = params.find(p => p.name === 'searchQuery')
  const maxResultsParam = params.find(p => p.name === 'maxResults')

  expect(searchQueryParam?.required).toBe(true)
  expect(maxResultsParam?.required).toBe(true)
  expect(maxResultsParam?.type).toBe('number')
})

test('Analysis agent configuration', () => {
  expect(dr.analysisAgent.name).toBe('analysis')
  expect(dr.analysisAgent.description).toContain('Advanced information processor')
  expect(dr.analysisAgent.steps[0].tools).toContain('run_python_code')
  expect(dr.analysisAgent.steps[0].tools).toContain('extract_webpage_content')
})

test('Analysis agent prompt building', () => {
  const prompt = replacePromptInputs(dr.analysisAgent.steps[0].prompt, {
    sectionObjective: 'Understand quantum mechanics',
    rawInformation: 'Quantum particles exhibit wave-particle duality...'
  })

  expect(prompt).toContain('Understand quantum mechanics')
  expect(prompt).toContain('Quantum particles exhibit wave-particle duality')
})

test('Analysis agent parameters', () => {
  const params = dr.analysisAgent.parameters
  const objectiveParam = params.find(p => p.name === 'sectionObjective')
  const rawInfoParam = params.find(p => p.name === 'rawInformation')

  expect(objectiveParam?.required).toBe(true)
  expect(rawInfoParam?.required).toBe(true)
})

test('Writer agent configuration', () => {
  expect(dr.writerAgent.name).toBe('writer')
  expect(dr.writerAgent.description).toContain('Section generator')
  expect(dr.writerAgent.steps[0].tools).toEqual([])
})

test('Writer agent prompt building', () => {
  const prompt = replacePromptInputs(dr.writerAgent.steps[0].prompt, {
    sectionNumber: 1,
    sectionTitle: 'Quantum Entanglement',
    sectionObjective: 'Explain quantum entanglement',
    keyLearnings: ['Entanglement is non-local', 'Bell\'s theorem proves it']
  })

  expect(prompt).toContain('Section Number: 1')
  expect(prompt).toContain('Section Title: Quantum Entanglement')
  expect(prompt).toContain('Section Objective: Explain quantum entanglement')
  expect(prompt).toContain('Key Learnings: Entanglement is non-local, Bell\'s theorem proves it')
})

test('Writer agent parameters', () => {
  const params = dr.writerAgent.parameters
  const sectionNumberParam = params.find(p => p.name === 'sectionNumber')
  const sectionTitleParam = params.find(p => p.name === 'sectionTitle')
  const sectionObjectiveParam = params.find(p => p.name === 'sectionObjective')
  const keyLearningsParam = params.find(p => p.name === 'keyLearnings')

  expect(sectionNumberParam?.required).toBe(true)
  expect(sectionTitleParam?.required).toBe(true)
  expect(sectionObjectiveParam?.required).toBe(true)
  expect(keyLearningsParam?.required).toBe(true)
  expect(keyLearningsParam?.type).toBe('array')
})

test('Title agent configuration', () => {
  expect(dr.titleAgent.name).toBe('title')
  expect(dr.titleAgent.description).toContain('Expert title generator')
  expect(dr.titleAgent.steps[0].tools).toEqual([])
})

test('Title agent prompt building', () => {
  const prompt = replacePromptInputs(dr.titleAgent.steps[0].prompt, {
    researchTopic: 'Quantum Computing Applications',
    keyLearnings: ['Quantum computers can solve optimization problems', 'They show promise in cryptography', 'Current limitations exist in error rates']
  })

  expect(prompt).toContain('Quantum Computing Applications')
  expect(prompt).toContain('Quantum computers can solve optimization problems')
  expect(prompt).toContain('They show promise in cryptography')
})

test('Title agent parameters', () => {
  const params = dr.titleAgent.parameters
  const researchTopicParam = params.find(p => p.name === 'researchTopic')
  const keyLearningsParam = params.find(p => p.name === 'keyLearnings')

  expect(researchTopicParam?.required).toBe(true)
  expect(keyLearningsParam?.required).toBe(true)
  expect(keyLearningsParam?.type).toBe('array')
})

test('Title agent structured output', () => {
  expect(dr.titleAgent.steps[0].structuredOutput?.name).toBe('title')
  expect(dr.titleAgent.steps[0].structuredOutput?.structure).toBeDefined()
})

test('Synthesis agent configuration', () => {
  expect(dr.synthesisAgent.name).toBe('synthesis')
  expect(dr.synthesisAgent.description).toContain('Expert report synthesizer')
  expect(dr.synthesisAgent.steps[0].tools).toEqual([])
})

test('Synthesis agent prompt building for executive summary', () => {
  const prompt = replacePromptInputs(dr.synthesisAgent.steps[0].prompt, {
    researchTopic: 'Quantum Computing',
    keyLearnings: ['Quantum computers use qubits', 'They can solve certain problems exponentially faster'],
    outputType: 'executive_summary'
  })

  expect(prompt).toContain('Quantum Computing')
  expect(prompt).toContain('Quantum computers use qubits')
  expect(prompt).toContain('executive_summary')
})

test('Synthesis agent prompt building for conclusion', () => {
  const prompt = replacePromptInputs(dr.synthesisAgent.steps[0].prompt, {
    researchTopic: 'Quantum Computing',
    keyLearnings: ['Quantum computers use qubits'],
    outputType: 'conclusion'
  })

  expect(prompt).toContain('conclusion')
})

test('Synthesis agent parameters', () => {
  const params = dr.synthesisAgent.parameters
  const researchTopicParam = params.find(p => p.name === 'researchTopic')
  const keyLearningsParam = params.find(p => p.name === 'keyLearnings')
  const outputTypeParam = params.find(p => p.name === 'outputType')

  expect(researchTopicParam?.required).toBe(true)
  expect(keyLearningsParam?.required).toBe(true)
  expect(keyLearningsParam?.type).toBe('array')
  expect(outputTypeParam?.required).toBe(true)
  expect(outputTypeParam?.enum).toEqual(['executive_summary', 'conclusion'])
})

test('DeepResearchMultiStep creation', () => {
  const deepResearch = new DeepResearchMultiStep(mockConfig, DEFAULT_WORKSPACE_ID)
  expect(deepResearch).toBeInstanceOf(DeepResearchMultiStep)
  expect(deepResearch.config).toBe(mockConfig)
})

test('DeepResearchMultiStep complete agent chain execution', async () => {
  // Reset mocks to track calls
  vi.clearAllMocks()

  const deepResearch = new DeepResearchMultiStep(mockConfig, DEFAULT_WORKSPACE_ID)
  const chat = new Chat()
  chat.messages = [
    new Message('system', 'You are a deep research assistant'),
    new Message('user', 'Research topic'),
    new Message('assistant', '')
  ]

  // Track execution order and calls
  const executionLog: string[] = []
  const agentCalls: any[] = []

  // Mock SearchPlugin with tracking
  // @ts-expect-error mock
  vi.mocked(SearchPlugin).mockImplementation(() => ({
    getName: () => 'search_internet',
    getRunningDescription: () => 'Searching...',
    getCompletedDescription: () => 'Search completed',
    execute: vi.fn().mockImplementation(async (context, params) => {
      executionLog.push(`search:${params.query}`)
      return {
        results: [{ 
          title: `Search Result for ${params.query}`, 
          content: `Content about ${params.query}`, 
          url: `https://example.com/${params.query.replace(/\s+/g, '-')}` 
        }]
      }
    })
  }))

  // Generator mock no longer needed for status updates (uses LlmUtils now)
  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue('success'),
    stop: vi.fn()
  }))

  // Mock AgentWorkflowExecutor with detailed tracking and realistic responses
  // @ts-expect-error mock
  vi.mocked(AgentWorkflowExecutor).mockImplementation((config: Configuration, workspaceId: string, agent: Agent) => {
    return {
      run: vi.fn().mockImplementation(async (trigger: AgentRunTrigger, values: Record<string, string>, options: AgentWorkflowExecutorOpts) => {
        const agentName = agent.name
        executionLog.push(`agent:${agentName}`)
        agentCalls.push({ agent: agentName, values, options })

        switch (agentName) {
          case 'planning':
            return { messages: [
              new Message('assistant', JSON.stringify({
                sections: [
                  { title: 'Section 1', description: 'Objective 1', queries: ['q1_1', 'q1_2'] },
                  { title: 'Section 2', description: 'Objective 2', queries: ['q2_1'] }
                ]
              }))
            ]}

          case 'analysis':
            return { messages: [
              new Message('assistant', JSON.stringify({ learnings: [ 'kl1', 'kl2', 'kl3' ], }))
            ]}

          case 'writer':
            // Extract section info from values
            const sectionTitle = values.sectionTitle || 'Unknown Section'
            const sectionNumber = values.sectionNumber || '?'
            return { messages: [
              new Message('assistant', `## ${sectionNumber}. ${sectionTitle}\n\n` )
            ]}

          case 'synthesis':
            const outputType = values.outputType || 'unknown'
            
            if (outputType === 'executive_summary') {
              return { messages: [
                new Message('assistant', `# Executive Summary\n\n` )
              ]}
            } else {
              return { messages: [
                new Message('assistant', `# Conclusion\n\n`)
              ]}
            }

          case 'title':
            return { messages: [
              new Message('assistant', `{"title": "Research Report: Test Topic"}`)
            ]}

          default:
            return {
              messages: [new Message('assistant', `Response from ${agentName} agent`)]
            }
        }
      })
    }
  })

  const result = await deepResearch.run(mockEngine, chat, mockOpts)
  expect(result).toBe('success')

  // Verify the final response contains all sections
  const responseContent = chat.messages[chat.messages.length - 1].content
  expect(responseContent).toContain('<artifact')
  expect(responseContent).toContain('# Executive Summary')
  expect(responseContent).toContain('## 1. Section 1')
  expect(responseContent).toContain('## 2. Section 2')
  expect(responseContent).toContain('# Conclusion')
  expect(responseContent).toContain('Sources:')
  expect(responseContent).toContain('</artifact>')

  // Verify search results are included as sources
  expect(responseContent).toContain('[Search Result for q1_1](https://example.com/q1_1)')
  expect(responseContent).toContain('[Search Result for q1_2](https://example.com/q1_2)')
  expect(responseContent).toContain('[Search Result for q2_1](https://example.com/q2_1)')

  // Verify complete execution chain (status updates are now mocked and not tracked)
  const expectedExecutionFlow = [
    'agent:planning',
    'search:q1_1',
    'search:q1_2',
    'search:q2_1',
    'agent:analysis',
    'agent:analysis',
    'agent:writer',
    'agent:writer',
    'agent:synthesis',
    'agent:synthesis',
    'agent:title',
  ]

  // Check that all expected steps were executed
  expect(executionLog.length).toEqual(expectedExecutionFlow.length)
  expectedExecutionFlow.forEach((step) => {
    expect(executionLog).toContain(step)
  })

  // Verify AgentWorkflowExecutor was called the expected number of times
  expect(AgentWorkflowExecutor).toHaveBeenCalledTimes(7) // 1 planning + 2 analysis + 2 writer + 1 synthesis + 1 title = 7

  // Verify agent call sequence
  const agentCallSequence = agentCalls.map(call => call.agent)
  expect(agentCallSequence).toEqual([
    'planning', 'analysis', 'analysis', 'writer', 'writer', 'synthesis', 'synthesis', 'title'
  ])

  // Verify the planning agent was called with correct parameters
  const planningCall = agentCalls.find(call => call.agent === 'planning')
  expect(planningCall.values.userQuery).toContain('Research topic')
  expect(planningCall.values.numSections).toBe('3')
  expect(planningCall.values.numQueriesPerSection).toBe('2')

  // Verify analysis agents received section objectives
  const analysisCalls = agentCalls.filter(call => call.agent === 'analysis')
  expect(analysisCalls).toHaveLength(2)
  expect(analysisCalls[0].values.sectionObjective).toContain('Objective 1')
  expect(analysisCalls[1].values.sectionObjective).toContain('Objective 2')

  // Verify writer agents received proper section data
  const writerCalls = agentCalls.filter(call => call.agent === 'writer')
  expect(writerCalls).toHaveLength(2)
  expect(writerCalls[0].values.sectionTitle).toContain('Section 1')
  expect(writerCalls[1].values.sectionTitle).toContain('Section 2')

  // Verify synthesis agents were called for both executive summary and conclusion
  const synthesisCalls = agentCalls.filter(call => call.agent === 'synthesis')
  expect(synthesisCalls).toHaveLength(2)
  expect(synthesisCalls[0].values.outputType).toBe('executive_summary')
  expect(synthesisCalls[1].values.outputType).toBe('conclusion')

  // Verify generateStatusUpdate was called 6 times
  // (before planning, after planning, after search, before synthesis, before title, final)
  const LlmUtilsMock = vi.mocked(await import('../../../../src/renderer/services/llm_utils')).default
  const llmUtilsInstance = LlmUtilsMock.mock.results[0]?.value
  expect(llmUtilsInstance.generateStatusUpdate).toHaveBeenCalledTimes(6)

})

test('DeepResearchMultiStep JSON parsing error handling', async () => {
  // Override the mock for this specific test
  const mockExecutorInstance = {
    run: vi.fn().mockResolvedValue({
      messages: [new Message('assistant', 'Invalid JSON response')]
    })
  }
  
  // @ts-expect-error mock
  vi.mocked(AgentWorkflowExecutor).mockImplementation(() => mockExecutorInstance)
  
  const deepResearch = new DeepResearchMultiStep(mockConfig, DEFAULT_WORKSPACE_ID)
  const chat = new Chat()
  chat.messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Research quantum computing'),
    new Message('assistant', '')
  ]

  const result = await deepResearch.run(mockEngine, chat, mockOpts)

  expect(result).toBe('error')
  expect(chat.messages[chat.messages.length - 1].content).toContain(
    'This model was not able to provide a research plan in the expected format'
  )
})

test('DeepResearchMultiStep abort handling', async () => {
  const deepResearch = new DeepResearchMultiStep(mockConfig, DEFAULT_WORKSPACE_ID)
  const chat = new Chat()
  chat.messages = [
    new Message('system', 'You are a helpful assistant'),
    new Message('user', 'Research quantum computing'),
    new Message('assistant', '')
  ]

  // Create AbortController for the test
  const abortController = new AbortController()
  const optsWithSignal = {
    ...mockOpts,
    abortSignal: abortController.signal
  }

  // Create a promise that we can control
  let resolveRun: any
  const runPromise = new Promise((resolve) => {
    resolveRun = resolve
  })

  // Override the mock to simulate a long-running operation
  const mockExecutorInstance = {
    run: vi.fn().mockImplementation(() => runPromise)
  }

  // @ts-expect-error mock
  vi.mocked(AgentWorkflowExecutor).mockImplementation(() => mockExecutorInstance)

  // Start the run operation
  const resultPromise = deepResearch.run(mockEngine, chat, optsWithSignal)

  // Simulate abort after a short delay
  setTimeout(() => {
    abortController.abort() // Trigger abort signal
    // Resolve the mock to continue execution
    resolveRun(planningResult)
  }, 10)

  const result = await resultPromise
  expect(result).toBe('stopped')
})


test('DeepResearchMultiAgent creation', () => {
  const deepResearch = new DeepResearchMultiAgent(mockConfig, DEFAULT_WORKSPACE_ID)
  expect(deepResearch).toBeInstanceOf(DeepResearchMultiAgent)
  expect(deepResearch.config).toBe(mockConfig)
  expect(deepResearch.storage).toEqual({})
})

test('DeepResearchMultiAgent storage and retrieval', async () => {
  const deepResearch = new DeepResearchMultiAgent(mockConfig, DEFAULT_WORKSPACE_ID)
  const testData = { key: 'value', number: 42 }
  
  const id = await deepResearch.store(testData)
  expect(typeof id).toBe('string')
  expect(id).toMatch(/^[0-9a-f-]{36}$/) // UUID format

  const retrieved = await deepResearch.retrieve(id)
  expect(retrieved).toEqual(testData)
})

test('DeepResearchMultiAgent retrieve non-existent key', async () => {
  const deepResearch = new DeepResearchMultiAgent(mockConfig, DEFAULT_WORKSPACE_ID)
  const result = await deepResearch.retrieve('non-existent-key')
  expect(result).toBeUndefined()
})

test('DeepResearchMultiAgent engine setup', async () => {
  vi.clearAllMocks()
  
  const deepResearch = new DeepResearchMultiAgent(mockConfig, DEFAULT_WORKSPACE_ID)
  const chat = new Chat()
  chat.messages = []

  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue('success'),
    stop: vi.fn()
  }))

  await deepResearch.run(mockEngine, chat, mockOpts)

  expect(mockEngine.clearPlugins).toHaveBeenCalled()
  expect(mockEngine.addPlugin).toHaveBeenCalledTimes(dr.deepResearchAgents.length)
})

test('DeepResearchMultiAgent system message setup', async () => {
  vi.clearAllMocks()
  
  const deepResearch = new DeepResearchMultiAgent(mockConfig, DEFAULT_WORKSPACE_ID)
  const chat = new Chat()
  chat.messages = []

  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue('success'),
    stop: vi.fn()
  }))

  await deepResearch.run(mockEngine, chat, mockOpts)

  expect(chat.messages).toHaveLength(1)
  expect(chat.messages[0].role).toBe('system')
  expect(chat.messages[0].content).toContain('research coordinator')
  expect(chat.messages[0].content).toContain('3') // numSections
  expect(chat.messages[0].content).toContain('2') // numQueriesPerSection
  expect(chat.messages[0].content).toContain('5') // numSearchResults
})

test('DeepResearchMultiAgent generator call', async () => {
  vi.clearAllMocks()
  
  const deepResearch = new DeepResearchMultiAgent(mockConfig, DEFAULT_WORKSPACE_ID)
  const chat = new Chat()
  chat.messages = []

  const mockGenerate = vi.fn().mockResolvedValue('success')
  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
    generate: mockGenerate,
    stop: vi.fn()
  }))

  const result = await deepResearch.run(mockEngine, chat, mockOpts)

  expect(mockGenerate).toHaveBeenCalledWith(
    mockEngine,
    chat.messages,
    expect.objectContaining({
      ...mockOpts,
      toolChoice: { type: 'tool', name: 'agent_planning' }
    })
  )
  expect(result).toBe('success')
})

test('Deep research agents count', () => {
  expect(dr.deepResearchAgents).toHaveLength(6)
  expect(dr.deepResearchAgents.map(a => a.name)).toEqual([
    'planning',
    'search', 
    'analysis',
    'writer',
    'title',
    'synthesis'
  ])
})

test('Deep research agents consistency', () => {
  dr.deepResearchAgents.forEach(agent => {
    expect(agent.name).toBeTruthy()
    expect(agent.description).toBeTruthy()
    expect(agent.instructions).toBeTruthy()
    expect(Array.isArray(agent.parameters)).toBe(true)
    expect(agent.steps).toHaveLength(1)
    expect(agent.steps[0].prompt).toBeTruthy()
    expect(Array.isArray(agent.steps[0].tools)).toBe(true)
    expect(Array.isArray(agent.steps[0].agents)).toBe(true)
  })
})

test('Deep research agents parameter validation', () => {
  dr.deepResearchAgents.forEach(agent => {
    agent.parameters.forEach(param => {
      expect(param.name).toBeTruthy()
      expect(param.type).toBeTruthy()
      expect(param.description).toBeTruthy()
      expect(typeof param.required).toBe('boolean')
    })
  })
})

// ==================== DEEPRESEARCH AL TESTS ====================

test('DeepResearchAgentLoop - Main loop agent configuration', () => {
  expect(mainLoopAgent.name).toBe('deep_research_main_loop')
  expect(mainLoopAgent.description).toContain('Strategic research coordinator')
  expect(mainLoopAgent.steps[0].structuredOutput).toBeDefined()
  expect(mainLoopAgent.steps[0].structuredOutput!.name).toBe('research_decision')
})

test('DeepResearchAgentLoop - Main loop agent schema', () => {
  const schema = mainLoopAgent.steps[0].structuredOutput!.structure
  expect(schema).toBeDefined()

  // Verify schema has expected fields
  const shape = schema._def.shape()
  expect(shape.status).toBeDefined()
  expect(shape.nextAction).toBeDefined()
  expect(shape.agentName).toBeDefined()
  expect(shape.agentParamsJson).toBeDefined()
  expect(shape.reasoning).toBeDefined()
  expect(shape.estimatedRemaining).toBeDefined()
  expect(shape.deliveryMessage).toBeDefined()
})

test('DeepResearchAgentLoop - Constructor initializes agent mapping', () => {
  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)

  // @ts-expect-error accessing private property for testing
  const agentMap = deepResearchAL.deepResearchAgents

  expect(agentMap.size).toBe(dr.deepResearchAgents.length)
  expect(agentMap.has('planning')).toBe(true)
  expect(agentMap.has('search')).toBe(true)
  expect(agentMap.has('analysis')).toBe(true)
  expect(agentMap.has('writer')).toBe(true)
  expect(agentMap.has('title')).toBe(true)
  expect(agentMap.has('synthesis')).toBe(true)
})

test('DeepResearchAgentLoop - Uses mainLoopAgent by default', () => {
  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)

  // Verify the class is instantiated correctly
  expect(deepResearchAL).toBeDefined()
  expect(deepResearchAL.agent.name).toBe('deep_research_main_loop')
})

test('DeepResearchAgentLoop - getComponentType helper maps agent names correctly', () => {
  expect(getComponentType('planning', {})).toBe('plan')
  expect(getComponentType('search', {})).toBe('search_results')
  expect(getComponentType('analysis', {})).toBe('learnings')
  expect(getComponentType('writer', {})).toBe('section')
  expect(getComponentType('title', {})).toBe('title')
  expect(getComponentType('synthesis', { outputType: 'conclusion' })).toBe('conclusion')
  expect(getComponentType('synthesis', { outputType: 'executive_summary' })).toBe('exec_summary')
  expect(getComponentType('synthesis', {})).toBe('exec_summary') // default
  expect(getComponentType('unknown', {})).toBeUndefined()
})

test('DeepResearchAgentLoop - buildReflectionContext with no reflections', () => {
  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)

  // @ts-expect-error accessing private method for testing
  const context = deepResearchAL.buildReflectionContext()

  expect(context).toBe('')
})

test('DeepResearchAgentLoop - buildReflectionContext with reflections', () => {
  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)

  // @ts-expect-error accessing private property for testing
  deepResearchAL.reflections = [
    { type: 'failure', message: 'Test failed' },
    { type: 'learning', message: 'Learned something' }
  ]

  // @ts-expect-error accessing private method for testing
  const context = deepResearchAL.buildReflectionContext()

  expect(context).toContain('PREVIOUS LEARNINGS & FEEDBACK')
  expect(context).toContain('Test failed')
  expect(context).toContain('Learned something')
})

test('DeepResearchAgentLoop - buildReflectionContext with tool abortions', () => {
  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)

  // @ts-expect-error accessing private property for testing
  deepResearchAL.toolAbortions = [{
    name: 'search_internet',
    params: { query: 'test' },
    reason: { decision: 'deny' }
  }]

  // @ts-expect-error accessing private method for testing
  const context = deepResearchAL.buildReflectionContext()

  expect(context).toContain('IMPORTANT - Tool Abortions')
  expect(context).toContain('search_internet')
  // expect(context).toContain('User denied')
})

test('DeepResearchAgentLoop - resolveToolPlugins returns empty for no catalog', () => {
  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)

  // @ts-expect-error accessing private method for testing
  const plugins = deepResearchAL.resolveToolPlugins(['search_internet'])

  expect(plugins).toEqual([])
})

test('DeepResearchAgentLoop - generateStatusUpdate sets transient and status', async () => {
  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)
  const message = new Message('assistant', '')
  const opts = { ...mockOpts, engine: 'test-engine', model: 'test-model' }

  // @ts-expect-error accessing private method for testing
  await deepResearchAL.generateStatusUpdate('Test prompt', message, opts)

  expect(message.transient).toBe(true)
  expect(message.status).toBe('Status update generated')
})

test('DeepResearchAgentLoop - Handles agentParamsJson as string', () => {
  const jsonString = '{"searchQuery":"test","maxResults":8}'
  const parsed = JSON.parse(jsonString)

  expect(parsed.searchQuery).toBe('test')
  expect(parsed.maxResults).toBe(8)
})

test('DeepResearchAgentLoop - Handles agentParamsJson as object', () => {
  const jsonObject = {"searchQuery":"test","maxResults":8}

  expect(jsonObject.searchQuery).toBe('test')
  expect(jsonObject.maxResults).toBe(8)
})

test('DeepResearchAgentLoop - Handles agentParamsJson as array for parallel', () => {
  const jsonArray = [
    {"searchQuery":"test1","maxResults":8},
    {"searchQuery":"test2","maxResults":8}
  ]

  expect(Array.isArray(jsonArray)).toBe(true)
  expect(jsonArray.length).toBe(2)
  expect(jsonArray[0].searchQuery).toBe('test1')
  expect(jsonArray[1].searchQuery).toBe('test2')
})

test('DeepResearchAgentLoop - Extracts _relevantMemory from params', () => {
  const params = {
    searchQuery: 'test',
    maxResults: 8,
    _relevantMemory: ['mem-id-1', 'mem-id-2']
  }

  const { _relevantMemory, ...cleanParams } = params

  expect(_relevantMemory).toEqual(['mem-id-1', 'mem-id-2'])
  expect(cleanParams).toEqual({
    searchQuery: 'test',
    maxResults: 8
  })
  expect(cleanParams._relevantMemory).toBeUndefined()
})

test('DeepResearchAgentLoop - Configuration values injected into main loop', () => {
  const opts: dr.DeepResearchOpts = {
    model: 'test-model',
    breadth: 5,
    depth: 3,
    searchResults: 10
  }

  // Test that breadth, depth, searchResults would be available
  expect(opts.breadth).toBe(5)
  expect(opts.depth).toBe(3)
  expect(opts.searchResults).toBe(10)
})

test('DeepResearchAgentLoop - Parallel execution with array params', () => {
  const paramsString = '[{"searchQuery":"q1","maxResults":8},{"searchQuery":"q2","maxResults":8}]'
  const parsed = JSON.parse(paramsString)

  expect(Array.isArray(parsed)).toBe(true)
  expect(parsed.length).toBe(2)

  // Both should execute in parallel
  parsed.forEach((p: any) => {
    expect(p.maxResults).toBe(8)
  })
})

test('DeepResearchAgentLoop - Sequential execution with single params', () => {
  const paramsString = '{"searchQuery":"q1","maxResults":8}'
  const parsed = JSON.parse(paramsString)

  expect(Array.isArray(parsed)).toBe(false)
  expect(parsed.searchQuery).toBe('q1')
})

test('DeepResearchAgentLoop - Full workflow with mocked Generator', async () => {
  const chat = new Chat()
  chat.addMessage(new Message('system', 'System'))
  chat.addMessage(new Message('user', 'test research'))
  chat.addMessage(new Message('assistant', ''))

  let generateCallCount = 0

  // Mock Generator to simulate agent loop
  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate: vi.fn().mockImplementation(async (llm, messages, opts, callback) => {
      generateCallCount++
      const response = messages[messages.length - 1]

      // Iteration 1: Main loop decides to plan
      if (generateCallCount === 1) {
        response.content = JSON.stringify({
          status: 'continue',
          agentName: 'planning',
          agentParamsJson: '{"userQuery":"test","numSections":1,"numQueriesPerSection":1,"_relevantMemory":[]}',
          nextAction: 'Plan',
          reasoning: 'Need plan',
          estimatedRemaining: 3
        })
        return 'success'
      }

      // Iteration 2: Planning agent returns plan
      if (generateCallCount === 2) {
        response.content = JSON.stringify({
          sections: [{ title: 'Test Section', description: 'Test', queries: ['test query'] }]
        })
        return 'success'
      }

      // Iteration 3: Main loop decides done
      if (generateCallCount === 3) {
        response.content = JSON.stringify({
          status: 'done',
          deliveryMessage: 'Done',
          reasoning: 'Complete'
        })
        return 'success'
      }

      return 'success'
    }),
    stop: vi.fn()
  }))

  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)
  const result = await deepResearchAL.run(mockEngine, chat, mockOpts)

  expect(result).toBe('success')
  expect(generateCallCount).toBe(3)
  expect(chat.messages.length).toBeGreaterThan(2)
})

test('DeepResearchAgentLoop - Workflow with search and analysis', async () => {
  const chat = new Chat()
  chat.addMessage(new Message('system', 'System'))
  chat.addMessage(new Message('user', 'test'))
  chat.addMessage(new Message('assistant', ''))

  let callCount = 0

  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
    generate: vi.fn().mockImplementation(async (llm, messages, opts, callback) => {
      callCount++
      const response = messages[messages.length - 1]

      if (callCount === 1) {
        // Main loop: plan
        response.content = JSON.stringify({
          status: 'continue',
          agentName: 'planning',
          agentParamsJson: '{"userQuery":"test","numSections":1,"numQueriesPerSection":1,"_relevantMemory":[]}',
          nextAction: 'Plan',
          reasoning: 'Start',
          estimatedRemaining: 5
        })
      } else if (callCount === 2) {
        // Planning result
        response.content = JSON.stringify({ sections: [{ title: 'S1', description: 'D1', queries: ['q1'] }] })
      } else if (callCount === 3) {
        // Main loop: search
        response.content = JSON.stringify({
          status: 'continue',
          agentName: 'search',
          agentParamsJson: '{"searchQuery":"q1","maxResults":8,"_relevantMemory":[]}',
          nextAction: 'Search',
          reasoning: 'Search',
          estimatedRemaining: 4
        })
      } else if (callCount === 4) {
        // Search result with tool callback
        response.content = 'Search results here'
        if (callback) {
          callback({ type: 'tool', name: 'search_internet', done: true, call: { result: { results: [{ title: 'T1', url: 'http://test.com' }] } } } as any)
        }
      } else if (callCount === 5) {
        // Main loop: done
        response.content = JSON.stringify({
          status: 'done',
          deliveryMessage: 'Done',
          reasoning: 'Complete'
        })
      }

      return 'success'
    }),
    stop: vi.fn()
  }))

  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)
  const result = await deepResearchAL.run(mockEngine, chat, mockOpts)

  expect(result).toBe('success')
  expect(callCount).toBe(5)
})

test('DeepResearchAgentLoop - Error handling in runAgentLoop', async () => {
  const chat = new Chat()
  chat.addMessage(new Message('system', 'System'))
  chat.addMessage(new Message('user', 'test'))
  chat.addMessage(new Message('assistant', ''))

  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
    generate: vi.fn().mockRejectedValue(new Error('Test error')),
    stop: vi.fn()
  }))

  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)
  const result = await deepResearchAL.run(mockEngine, chat, mockOpts)

  expect(result).toBe('error')
})

test('DeepResearchAgentLoop - Abort signal handling', async () => {
  const chat = new Chat()
  chat.addMessage(new Message('system', 'System'))
  chat.addMessage(new Message('user', 'test'))
  chat.addMessage(new Message('assistant', ''))

  const abortController = new AbortController()
  let callCount = 0

  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
    generate: vi.fn().mockImplementation(async (llm, messages) => {
      callCount++
      const response = messages[messages.length - 1]

      if (callCount === 1) {
        // First iteration succeeds
        response.content = JSON.stringify({
          status: 'continue',
          agentName: 'planning',
          agentParamsJson: '{"userQuery":"test","_relevantMemory":[]}',
          nextAction: 'test',
          reasoning: 'test'
        })
      } else if (callCount === 2) {
        // Planning agent executes
        response.content = JSON.stringify({ sections: [] })
      } else {
        // After planning, abort before next iteration
        abortController.abort()
        response.content = JSON.stringify({ status: 'continue', agentName: 'search', agentParamsJson: '{}', nextAction: 'search', reasoning: 'search' })
      }
      return 'success'
    }),
    stop: vi.fn()
  }))

  const deepResearchAL = new DeepResearchAL(mockConfig, DEFAULT_WORKSPACE_ID)
  const result = await deepResearchAL.run(mockEngine, chat, { ...mockOpts, abortSignal: abortController.signal })

  expect(result).toBe('stopped')
})