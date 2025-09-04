import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '../mocks/index'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Editor from '../../src/agent/Editor.vue'
import Agent from '../../src/models/agent'
import AgentGenerator from '../../src/services/agent_generator'
import { nextTick } from 'vue'

enableAutoUnmount(afterAll)

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

// Mock the LLM Factory to return our mock LLM
vi.mock('../../src/llms/llm', () => {
  return {
    default: {
      manager: vi.fn(() => ({
        igniteEngine: vi.fn(() => ({
          complete: vi.fn()
        })),
        getChatModel: vi.fn(() => ({ id: 'test-model', name: 'Test Model' })),
        getChatModels: vi.fn(() => [{ id: 'test-model', name: 'Test Model' }]),
        getDefaultChatModel: vi.fn(() => 'test-model'),
        getEngineName: vi.fn((engine) => engine),
        isEngineReady: vi.fn(() => true),
        hasChatModels: vi.fn(() => true),
        isFavoriteEngine: vi.fn(() => false),
        checkModelListsVersion: vi.fn(),
        getCustomEngines: vi.fn(() => []),
        getStandardEngines: vi.fn(() => ['openai', 'anthropic']),
        getChatEngines: vi.fn(() => ['openai', 'anthropic']),
        getNonChatEngines: vi.fn(() => [])
      }))
    }
  }
})

// Mock AgentGenerator
vi.mock('../../src/services/agent_generator')

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  store.config = {} // Ensure store.config exists for EngineModelSelect
})

beforeEach(() => {
  vi.clearAllMocks()
  store.agents = []
})

// Helper function to create a valid generated agent response
const createValidGeneratedAgent = (): Agent => {
  const agent = new Agent()
  agent.name = 'Research Assistant'
  agent.description = 'An AI agent that researches topics and creates comprehensive reports'
  agent.type = 'runnable'
  agent.instructions = 'You are a research assistant that conducts thorough research and creates detailed reports.'
  agent.steps = [
    {
      description: 'Search for information',
      prompt: 'Search for information about {{topic}}',
      tools: ['search'],
      agents: []
    },
    {
      description: 'Create summary',
      prompt: 'Create a comprehensive summary of the following information: {{output.1}}',
      tools: ['writeFile'],
      agents: []
    }
  ]
  return agent
}

test('Shows generator step form fields', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Should show generator step (first step) - check for the visible WizardStep component
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  expect(wizardStep.exists()).toBe(true)
  expect(wizardStep.props('visible')).toBe(true)

  // Should show description textarea
  const descriptionField = wrapper.find('textarea[name="description"]')
  expect(descriptionField.exists()).toBe(true)
  expect(descriptionField.attributes('required')).toBeDefined()

  // Should show engine model selector
  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  expect(engineModelSelect.exists()).toBe(true)

  // Should show skip and generate buttons
  const skipButton = wrapper.find('button[name="skip"]')
  expect(skipButton.exists()).toBe(true)
  expect(skipButton.text()).toContain('agent.create.generator.skip')
})

test('Allows skipping generation step', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Click skip button
  const skipButton = wrapper.find('button[name="skip"]')
  await skipButton.trigger('click')
  await nextTick()

  // Should move to next step (General step)
  const steps = wrapper.findAll('.wizard-step')
  const activeStep = steps.find(step => step.classes().includes('active'))
  expect(activeStep).toBeTruthy()
  expect(activeStep!.text()).toContain('agent.create.information.title')
})

test('Shows validation error when description is empty', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Try to generate without entering description
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Should show validation error
  const errorDiv = wizardStep.find('.error')
  expect(errorDiv.exists()).toBe(true)
  expect(errorDiv.text()).toBe('agent.create.generator.error.description')
})

test('Shows generation in progress state', async () => {
  // Mock the agent generator to simulate long-running generation
  const mockGenerateAgent = vi.fn(() => new Promise(resolve => {
    setTimeout(() => resolve(createValidGeneratedAgent()), 100)
  }))
  
  vi.mocked(AgentGenerator).mockImplementation(() => ({
    generateAgentFromDescription: mockGenerateAgent
  } as any))

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Fill in description
  const descriptionField = wrapper.find('textarea[name="description"]')
  await descriptionField.setValue('Create a research agent that can analyze data')

  // Start generation
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Should show generating state
  const generatingStatus = wrapper.find('.generating-status')
  expect(generatingStatus.exists()).toBe(true)

  const loader = wrapper.find('.loader')
  expect(loader.exists()).toBe(true)

  const generatingText = wrapper.find('.generating-text strong')
  expect(generatingText.text()).toBe('agent.create.generator.generating.title')
})

test('Shows generated agent preview after successful generation', async () => {
  const generatedAgent = createValidGeneratedAgent()
  
  // Mock successful generation
  const mockGenerateAgent = vi.fn().mockResolvedValue(generatedAgent)
  vi.mocked(AgentGenerator).mockImplementation(() => ({
    generateAgentFromDescription: mockGenerateAgent
  } as any))

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Fill in description and generate
  const descriptionField = wrapper.find('textarea[name="description"]')
  await descriptionField.setValue('Create a research agent that can analyze data')

  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Wait for generation to complete
  await new Promise(resolve => setTimeout(resolve, 10))
  await wrapper.vm.$nextTick()

  // Should show success message
  const successTitle = wrapper.find('.preview-success h3')
  expect(successTitle.text()).toBe('agent.create.generator.success.title')

  // Should show preview card with agent details
  const previewCard = wrapper.find('.preview-card')
  expect(previewCard.exists()).toBe(true)

  const agentName = wrapper.find('.preview-header h4')
  expect(agentName.text()).toBe(generatedAgent.name)

  const agentDescription = wrapper.find('.preview-header p')
  expect(agentDescription.text()).toBe(generatedAgent.instructions)

  // Should show steps count
  const stepsText = wrapper.find('.preview-section strong')
  expect(stepsText.text()).toContain(`${generatedAgent.steps.length}`)

  // Should show try again button
  const tryAgainButton = wrapper.find('button[name="tryAgain"]')
  expect(tryAgainButton.exists()).toBe(true)
  expect(tryAgainButton.text()).toBe('agent.create.generator.tryAgain')
})

test('Allows trying again after generation', async () => {
  const generatedAgent = createValidGeneratedAgent()
  
  // Mock successful generation
  const mockGenerateAgent = vi.fn().mockResolvedValue(generatedAgent)
  vi.mocked(AgentGenerator).mockImplementation(() => ({
    generateAgentFromDescription: mockGenerateAgent
  } as any))

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Generate agent first
  const descriptionField = wrapper.find('textarea[name="description"]')
  await descriptionField.setValue('Create a research agent')

  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Wait for generation
  await new Promise(resolve => setTimeout(resolve, 10))
  await wrapper.vm.$nextTick()

  // Click try again
  const tryAgainButton = wrapper.find('button[name="tryAgain"]')
  await tryAgainButton.trigger('click')
  await nextTick()

  // Should return to initial state
  expect(wrapper.find('.preview-card').exists()).toBe(false)
  expect(wrapper.find('textarea[name="description"]').exists()).toBe(true)
  expect(wrapper.find('button[name="skip"]').exists()).toBe(true)
})

test('Shows error when generation fails', async () => {
  // Mock failed generation
  const mockGenerateAgent = vi.fn().mockResolvedValue(null)
  vi.mocked(AgentGenerator).mockImplementation(() => ({
    generateAgentFromDescription: mockGenerateAgent
  } as any))

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Fill in description and try to generate
  const descriptionField = wrapper.find('textarea[name="description"]')
  await descriptionField.setValue('Create a research agent')

  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Wait for generation to complete
  await new Promise(resolve => setTimeout(resolve, 10))
  await wrapper.vm.$nextTick()

  // Should show error in WizardStep component
  const wizardStepComponent = wrapper.findComponent({ name: 'WizardStep' })
  const errorDiv = wizardStepComponent.find('.error')
  expect(errorDiv.exists()).toBe(true)
  expect(errorDiv.text()).toBe('agent.create.generator.error.generation')
})

test('Shows error when generation throws exception', async () => {
  // Mock generation that throws an error
  const mockGenerateAgent = vi.fn().mockRejectedValue(new Error('Network error'))
  vi.mocked(AgentGenerator).mockImplementation(() => ({
    generateAgentFromDescription: mockGenerateAgent
  } as any))

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Fill in description and try to generate
  const descriptionField = wrapper.find('textarea[name="description"]')
  await descriptionField.setValue('Create a research agent')

  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Wait for generation to complete
  await new Promise(resolve => setTimeout(resolve, 10))
  await wrapper.vm.$nextTick()

  // Should show unexpected error in WizardStep component
  const wizardStepComponent = wrapper.findComponent({ name: 'WizardStep' })
  const errorDiv = wizardStepComponent.find('.error')
  expect(errorDiv.exists()).toBe(true)
  expect(errorDiv.text()).toBe('agent.create.generator.error.unexpected')
})

test('Proceeds to next step after successful generation and review', async () => {
  const generatedAgent = createValidGeneratedAgent()
  
  // Mock successful generation
  const mockGenerateAgent = vi.fn().mockResolvedValue(generatedAgent)
  vi.mocked(AgentGenerator).mockImplementation(() => ({
    generateAgentFromDescription: mockGenerateAgent
  } as any))

  const agent = new Agent()
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: agent
    }
  })
  await nextTick()

  // Generate agent
  const descriptionField = wrapper.find('textarea[name="description"]')
  await descriptionField.setValue('Create a research agent')

  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Wait for generation to complete
  await vi.waitFor(() => {
    return wrapper.find('.preview-card').exists()
  }, { timeout: 100 })

  // Click next (review) - this should proceed to next step
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Should move to next step (General step)
  const steps = wrapper.findAll('.wizard-step')
  const activeStep = steps.find(step => step.classes().includes('active'))
  expect(activeStep).toBeTruthy()
  expect(activeStep!.text()).toContain('agent.create.information.title')
})

test('Shows engine model selector component', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  // Should show EngineModelSelect component
  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  expect(engineModelSelect.exists()).toBe(true)

  // Should show the model selection help text
  const modelLabel = wrapper.find('label[for="model"]')
  expect(modelLabel.text()).toBe('agent.create.generator.model')
})

test('Updates next button text based on state', async () => {
  const generatedAgent = createValidGeneratedAgent()
  
  // Mock successful generation
  const mockGenerateAgent = vi.fn().mockResolvedValue(generatedAgent)
  vi.mocked(AgentGenerator).mockImplementation(() => ({
    generateAgentFromDescription: mockGenerateAgent
  } as any))

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: undefined
    }
  })
  await nextTick()

  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  
  // Initially should show "Generate"
  expect(wizardStep.props('nextButtonText')).toBe('agent.create.generator.generate')

  // After generation, should show "Review"
  const descriptionField = wrapper.find('textarea[name="description"]')
  await descriptionField.setValue('Create a research agent')

  await wizardStep.vm.$emit('next')
  await nextTick()

  // Wait for generation
  await new Promise(resolve => setTimeout(resolve, 10))
  await wrapper.vm.$nextTick()

  expect(wizardStep.props('nextButtonText')).toBe('agent.create.generator.review')
})