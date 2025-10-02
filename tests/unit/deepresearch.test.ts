/* eslint-disable @typescript-eslint/no-unused-vars, no-case-declarations */
 
 
import { vi, expect, test, beforeEach } from 'vitest'
import { Configuration } from '../../src/types/config'
import { LlmEngine } from 'multi-llm-ts'
import DeepResearchMultiStep from '../../src/services/deepresearch_ms'
import DeepResearchMultiAgent from '../../src/services/deepresearch_ma'
import * as dr from '../../src/services/deepresearch'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'
import SearchPlugin from '../../src/plugins/search'
import Generator from '../../src/services/generator'
import Runner, { RunnerCompletionOpts } from '../../src/services/runner'
import { AgentRun, AgentRunTrigger } from '../../src/types'
import { DEFAULT_WORKSPACE_ID } from '../../src/main/workspace'

// Mock dependencies
vi.mock('../../src/plugins/search')
vi.mock('../../src/services/generator')
vi.mock('../../src/plugins/agent')

// Mock Runner properly
vi.mock('../../src/services/runner', () => {
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
  
  // Setup Runner mock
  const mockRunnerInstance = {
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
  vi.mocked(Runner).mockImplementation(() => mockRunnerInstance)
  
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
  const prompt = dr.planningAgent.buildPrompt(0, {
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
  const prompt = dr.searchAgent.buildPrompt(0, {
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
  const prompt = dr.analysisAgent.buildPrompt(0, {
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
  const prompt = dr.writerAgent.buildPrompt(0, {
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
  const prompt = dr.titleAgent.buildPrompt(0, {
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
  const prompt = dr.synthesisAgent.buildPrompt(0, {
    researchTopic: 'Quantum Computing',
    keyLearnings: ['Quantum computers use qubits', 'They can solve certain problems exponentially faster'],
    outputType: 'executive_summary'
  })

  expect(prompt).toContain('Quantum Computing')
  expect(prompt).toContain('Quantum computers use qubits')
  expect(prompt).toContain('executive_summary')
})

test('Synthesis agent prompt building for conclusion', () => {
  const prompt = dr.synthesisAgent.buildPrompt(0, {
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

test('DeepResearchMultiStep stop functionality', () => {
  const deepResearch = new DeepResearchMultiStep(mockConfig, DEFAULT_WORKSPACE_ID)
  const abortSpy = vi.fn()
  const stopSpy = vi.fn()
  
  deepResearch.abortController = { abort: abortSpy } as any
  deepResearch.generators = [{ stop: stopSpy }] as any

  deepResearch.stop()

  expect(abortSpy).toHaveBeenCalled()
  expect(stopSpy).toHaveBeenCalled()
})

test('DeepResearchMultiStep complete agent chain execution', async () => {
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

  // Mock Generator with tracking
  // @ts-expect-error mock
  vi.mocked(Generator).mockImplementation(() => ({
     
    generate: vi.fn().mockImplementation(async (engine, messages, options) => {
      executionLog.push('status_update')
      // Add the status update to the response message
      const lastMessage = messages[messages.length - 1]
      lastMessage.appendText({
        type: 'content',
        text: `Status: ${messages[messages.length - 2]?.content || 'Starting'}`,
        done: false
      })
      return 'success'
    }),
    stop: vi.fn()
  }))

  // Mock Runner with detailed tracking and realistic responses
  // @ts-expect-error mock
  vi.mocked(Runner).mockImplementation((config: Configuration, workspaceId: string, agent: Agent) => {
    return {
      run: vi.fn().mockImplementation(async (trigger: AgentRunTrigger, prompt: string, options: RunnerCompletionOpts) => {
        const agentName = agent.name
        executionLog.push(`agent:${agentName}`)
        agentCalls.push({ agent: agentName, prompt, options })

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
            // Extract section info for content generation
            const titleMatch = prompt.match(/Section Title: (.+?)(?:\n|$)/)
            const numberMatch = prompt.match(/Section Number: (.+?)(?:\n|$)/)
            const sectionTitle = titleMatch ? titleMatch[1] : 'Unknown Section'
            const sectionNumber = numberMatch ? numberMatch[1] : '?'
            return { messages: [
              new Message('assistant', `## ${sectionNumber}. ${sectionTitle}\n\n` )
            ]}

          case 'synthesis':
            const outputTypeMatch = prompt.match(/Output Type: (.+?)(?:\n|$)/)
            const outputType = outputTypeMatch ? outputTypeMatch[1] : 'unknown'
            
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

  // Verify complete execution chain
  const expectedExecutionFlow = [
    'status_update',
    'agent:planning',
    'status_update',
    'search:q1_1',
    'search:q1_2',
    'search:q2_1',
    'status_update',
    'agent:analysis',
    'agent:writer',
    'agent:analysis',
    'agent:writer',
    'status_update',
    'agent:synthesis',
    'agent:synthesis',
    'status_update',
    'agent:title',
    'status_update',
  ]

  // Check that all expected steps were executed
  expect(executionLog.length).toEqual(expectedExecutionFlow.length)
  expectedExecutionFlow.forEach((step, index) => {
    expect(executionLog).toContain(step)
  })

  // Verify Runner was called the expected number of times
  expect(Runner).toHaveBeenCalledTimes(7) // 1 planning + 2 analysis + 2 writer + 1 synthesis + 1 title = 7

  // Verify agent call sequence
  const agentCallSequence = agentCalls.map(call => call.agent)
  expect(agentCallSequence).toEqual([
    'planning', 'analysis', 'analysis', 'writer', 'writer', 'synthesis', 'synthesis', 'title'
  ])

  // Verify the planning agent was called with correct parameters
  const planningCall = agentCalls.find(call => call.agent === 'planning')
  expect(planningCall.prompt).toContain('Research topic')
  expect(planningCall.prompt).toContain('3 sections')
  expect(planningCall.prompt).toContain('2 search queries')

  // Verify analysis agents received section objectives
  const analysisCalls = agentCalls.filter(call => call.agent === 'analysis')
  expect(analysisCalls).toHaveLength(2)
  expect(analysisCalls[0].prompt).toContain('Objective 1')
  expect(analysisCalls[1].prompt).toContain('Objective 2')

  // Verify writer agents received proper section data
  const writerCalls = agentCalls.filter(call => call.agent === 'writer')
  expect(writerCalls).toHaveLength(2)
  expect(writerCalls[0].prompt).toContain('Section 1')
  expect(writerCalls[1].prompt).toContain('Section 2')

  // Verify synthesis agents were called for both executive summary and conclusion
  const synthesisCalls = agentCalls.filter(call => call.agent === 'synthesis')
  expect(synthesisCalls).toHaveLength(2)
  expect(synthesisCalls[0].prompt).toContain('executive_summary')
  expect(synthesisCalls[1].prompt).toContain('conclusion')

})

test('DeepResearchMultiStep JSON parsing error handling', async () => {
  // Override the mock for this specific test
  const mockRunnerInstance = {
    run: vi.fn().mockResolvedValue({
      messages: [new Message('assistant', 'Invalid JSON response')]
    })
  }
  
  // @ts-expect-error mock
  vi.mocked(Runner).mockImplementation(() => mockRunnerInstance)
  
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

  // Create a promise that we can control
  let resolveRun: any
  const runPromise = new Promise((resolve) => {
    resolveRun = resolve
  })

  // Override the mock to simulate a long-running operation
  const mockRunnerInstance = {
    run: vi.fn().mockImplementation(() => runPromise)
  }
  
  // @ts-expect-error mock
  vi.mocked(Runner).mockImplementation(() => mockRunnerInstance)

  // Start the run operation
  const resultPromise = deepResearch.run(mockEngine, chat, mockOpts)
  
  // Simulate abort after a short delay
  setTimeout(() => {
    deepResearch.stop() // This should call abortController.abort()
    // Resolve the mock to continue execution
    resolveRun(planningResult)
  }, 10)

  const result = await resultPromise
  expect(result).toBe('stopped')
})

test('DeepResearchMultiStep JSON parsing valid content', () => {
  const deepResearch = new DeepResearchMultiStep(mockConfig, DEFAULT_WORKSPACE_ID)
  const validJson = '{"sections": [{"title": "Test"}]}'
  const result = deepResearch['parseJson'](validJson)
  expect(result).toEqual({ sections: [{ title: 'Test' }] })
})

test('DeepResearchMultiStep JSON parsing with extra content', () => {
  const deepResearch = new DeepResearchMultiStep(mockConfig, DEFAULT_WORKSPACE_ID)
  const jsonWithExtra = 'Some text before {"sections": [{"title": "Test"}]} some text after'
  const result = deepResearch['parseJson'](jsonWithExtra)
  expect(result).toEqual({ sections: [{ title: 'Test' }] })
})

test('DeepResearchMultiStep JSON parsing invalid content', () => {
  const deepResearch = new DeepResearchMultiStep(mockConfig, DEFAULT_WORKSPACE_ID)
  const invalidJson = 'No JSON here'
  expect(() => deepResearch['parseJson'](invalidJson)).toThrow('No JSON object found in content')
})

test('DeepResearchMultiAgent creation', () => {
  const deepResearch = new DeepResearchMultiAgent(mockConfig, DEFAULT_WORKSPACE_ID)
  expect(deepResearch).toBeInstanceOf(DeepResearchMultiAgent)
  expect(deepResearch.config).toBe(mockConfig)
  expect(deepResearch.storage).toEqual({})
})

test('DeepResearchMultiAgent stop functionality', () => {
  const deepResearch = new DeepResearchMultiAgent(mockConfig, DEFAULT_WORKSPACE_ID)
  const mockGenerator = { stop: vi.fn() }
  deepResearch.generator = mockGenerator as any

  deepResearch.stop()

  expect(mockGenerator.stop).toHaveBeenCalled()
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
