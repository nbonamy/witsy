import { vi, beforeAll, beforeEach, afterAll, expect, test, describe } from 'vitest'
import { mount as vtumount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Onboarding from '../../src/screens/Onboarding.vue'
import Welcome from '../../src/onboarding/Welcome.vue'
import Chat from '../../src/onboarding/Chat.vue'
import Ollama from '../../src/onboarding/Ollama.vue'
import Studio from '../../src/onboarding/Studio.vue'
import Voice from '../../src/onboarding/Voice.vue'
import Permissions from '../../src/onboarding/Permissions.vue'
import Instructions from '../../src/onboarding/Instructions.vue'
import Done from '../../src/onboarding/Done.vue'

enableAutoUnmount(afterAll)

const screensMacOS = [Welcome, Chat, Ollama, Studio, Voice, Permissions, Instructions, Done]
const screensOthers = [Welcome, Chat, Ollama, Studio, Voice, Instructions, Done]

// Mock i18n
vi.mock('../../src/services/i18n', async () => {
  return {
    t: (key: string) => key,
    allLanguages: [
      { locale: 'en', label: 'English' },
      { locale: 'fr', label: 'Français' },
      { locale: 'es', label: 'Español' },
      { locale: 'de', label: 'Deutsch' }
    ]
  }
})

// Mock LLM services
vi.mock('../../src/llms/manager', async () => {
  return { 
    default: class {
      config: any
      
      constructor(config: any) {
        this.config = config
      }
      getChatEngineModel() {
        return { engine: 'mock', model: 'test' }
      }
      checkModelListsVersion() {
        // Mock implementation
      }
      getStandardEngines() {
        return ['openai', 'anthropic', 'google']
      }
      isCustomEngine() {
        return false
      }
      isEngineReady() {
        return true
      }
      async loadModels(engine: string) {
        // Mock load models with different behaviors
        if (engine === 'error-engine') {
          throw new Error('Failed to load models')
        }
        
        // Simulate successful model loading by updating the config
        if (!this.config.engines[engine].models) {
          this.config.engines[engine].models = { chat: [] }
        }
        
        // Add mock models to simulate successful loading
        this.config.engines[engine].models.chat = ['model1', 'model2', 'gpt-4']
        
        return ['model1', 'model2', 'gpt-4']
      }
    }
  }
})

vi.mock('../../src/services/assistant', async () => {
  return { 
    default: class {
      constructor() {}
      setChat() {}
      prompt(prompt: string, options: any, callback?: (chunk: any) => void) { 
        // Simulate different responses based on prompt
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (callback) {
              if (prompt.includes('system prompt')) {
                // Simulate system prompt response
                callback({ type: 'content', text: 'SYSTEM PROMPT\n\nYou are a helpful assistant.' })
              } else if (prompt.includes('error')) {
                // Simulate error case
                reject(new Error('Assistant error'))
                return
              } else {
                // Regular response
                callback({ type: 'content', text: 'This is a regular response.' })
              }
            }
            resolve(undefined)
          }, 100)
        })
      }
      chat = { model: 'test', lastMessage: () => null }
    }
  }
})

// Mock voice engines
vi.mock('../../src/voice/stt', async () => {
  return {
    getSTTEngines: () => [
      { id: 'openai', name: 'OpenAI Whisper' },
    ],
    getSTTModels: () => [
      { id: 'whisper-1', label: 'OpenAI Whisper V2' },
    ],
  }
})

vi.mock('../../src/voice/tts', async () => {
  return {
    getTTSEngines: () => [
      { id: 'openai', name: 'OpenAI TTS' },
    ],
    getTTSModels: () => [
      { id: 'openai-tts', label: 'OpenAI TTS' },
    ],
  }
})

vi.mock('../../src/services/image', async () => ({
  default: {
    getEngines: () => [
      { id: 'openai', name: 'OpenAI' }
    ]
  }
}))

vi.mock('../../src/services/video', async () => ({
  default: {
    getEngines: () => [
      { id: 'openai', name: 'OpenAI' }
    ]
  }
}))

vi.mock('../../src/composables/dialog.ts', () => ({
  default: {
    show: vi.fn(() => ({ isConfirmed: true }))
  }
}))

beforeAll(() => {
  
  useWindowMock()
  store.loadSettings()
  
  // Ensure all engines have proper configuration structure for both chat and voice
  const allEngines = ['openai', 'anthropic', 'google' ]
  allEngines.forEach(engine => {
    if (!store.config.engines[engine]) {
      store.config.engines[engine] = { apiKey: '' } as any
    }
    if (!store.config.engines[engine].apiKey) {
      store.config.engines[engine].apiKey = ''
    }
  })
  
  // Set up global llmManager mock for components that access it directly
  const mockLlmManager = {
    getChatEngineModel: () => ({ engine: 'mock', model: 'test' }),
    checkModelListsVersion: () => {},
    getStandardEngines: () => ['openai', 'anthropic', 'google'],
    isCustomEngine: () => false,
    isFavoriteEngine: () => false,
    isReady: () => true,
    isConfigured: () => true
  }
  
  global.llmManager = mockLlmManager
  globalThis.llmManager = mockLlmManager
})

beforeEach(() => {
  vi.clearAllMocks()
})

const mount = async (component: any, props: any = {}): Promise<VueWrapper<any>> => {
  return vtumount(component, { props })
}

describe('Onboarding Main Component', () => {

  test('Renders correctly', async () => {
    const wrapper = await mount(Onboarding)
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.overlay').exists()).toBe(true)
    expect(wrapper.find('.onboarding').exists()).toBe(true)
    expect(wrapper.find('.close').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(true)
    expect(wrapper.find('footer').exists()).toBe(true)

    expect(wrapper.findComponent(Welcome).exists()).toBe(true)
    expect(wrapper.findComponent(Chat).exists()).toBe(true)
    expect(wrapper.findComponent(Ollama).exists()).toBe(true)
    expect(wrapper.findComponent(Studio).exists()).toBe(true)
    expect(wrapper.findComponent(Voice).exists()).toBe(true)
    expect(wrapper.findComponent(Instructions).exists()).toBe(true)
    expect(wrapper.findComponent(Done).exists()).toBe(true)
  })

  test('Navigation buttons work correctly', async () => {
    const wrapper = await mount(Onboarding)
    
    // Step 1: Only Next button visible
    expect(wrapper.find('.prev').exists()).toBe(false)
    expect(wrapper.find('.next').exists()).toBe(true)
    expect(wrapper.find('.last').exists()).toBe(false)
    
    // Click Next to go to step 2
    await wrapper.find('.next').trigger('click')
    expect(wrapper.findComponent(Chat).exists()).toBe(true)
    expect(wrapper.find('.prev').exists()).toBe(true)
    expect(wrapper.find('.next').exists()).toBe(true)
    
    // Click Prev to go back to step 1
    await wrapper.find('.prev').trigger('click')
    expect(wrapper.findComponent(Welcome).exists()).toBe(true)
    expect(wrapper.find('.prev').exists()).toBe(false)
  })

  test('Shows correct buttons on last step', async () => {
    const wrapper = await mount(Onboarding)
    
    // Navigate to last step
    for (let i = 1; i < screensMacOS.length; i++) {
      await wrapper.find('.next').trigger('click')
    }
    
    expect(wrapper.findComponent(Done).exists()).toBe(true)
    expect(wrapper.find('.prev').exists()).toBe(true)
    expect(wrapper.find('.next').exists()).toBe(false)
    expect(wrapper.find('.last').exists()).toBe(true)
  })

  test('Close button emits close event', async () => {
    const wrapper = await mount(Onboarding)
    const closeDiv = wrapper.find('.close')
    expect(closeDiv.exists()).toBe(true)
    
    // Find the icon component within the close div and trigger click on it
    const iconElement = closeDiv.find('*') // Find any child element
    if (iconElement.exists()) {
      await iconElement.trigger('click')
    } else {
      // If no child found, click the div itself
      await closeDiv.trigger('click')
    }
    
    // Check if the close event was emitted
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  test('Last button emits close event', async () => {
    const wrapper = await mount(Onboarding)
    
    // Navigate to last step
    for (let i = 1; i < screensMacOS.length; i++) {
      await wrapper.find('.next').trigger('click')
    }
    
    await wrapper.find('.last').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

})

describe('Individual Screen Rendering', () => {

  test('All screens render with proper structure and specific elements', async () => {
    const screenTests = [
      { 
        component: Chat, 
        name: 'Chat',
        hasEnginesGrid: true,
      },
      { 
        component: Ollama, 
        name: 'Ollama',
      },
      { 
        component: Studio, 
        name: 'Studio',
        hasEnginesGrid: true,
      },
      { 
        component: Voice, 
        name: 'Voice',
        hasEnginesGrid: true,
      },
      { 
        component: Done, 
        name: 'Done',
        hasLogo: true,
      }
    ]
    
    for (const screen of screenTests) {
      
      const wrapper = await mount(screen.component)
      const component = wrapper.vm as any
      await component.onVisible?.()
      
      // Basic structure that all screens should have
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('section').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
      
      // Screen-specific elements
      if (screen.hasEnginesGrid) {
        expect(wrapper.find('.engines-grid').exists()).toBe(true)
      }
      if (screen.hasLogo) {
        expect(wrapper.find('.logo').exists()).toBe(true)
        expect(wrapper.find('.landing-logo').exists()).toBe(true)
      }
    }
  })

})

describe('Screen Navigation Flow', () => {

  test('Complete navigation flow through all screens with state management', async () => {
    
    const wrapper = await mount(Onboarding)
    const component = wrapper.vm as any
    
    // Test forward navigation through all screens
    for (let i = 0; i < screensMacOS.length; i++) {
      if (i < screensMacOS.length - 1) {
        await wrapper.find('.next').trigger('click')
      }
    }
    
    // Should be on the last screen now
    expect(component.step).toBe(screensMacOS.indexOf(Done))
    
    // Test backward navigation
    // Go back a few steps from Done screen
    await wrapper.find('.prev').trigger('click')
    expect(component.step).toBe(screensMacOS.indexOf(Instructions))
    
    // Go back to Permissions screen
    await wrapper.find('.prev').trigger('click')
    expect(component.step).toBe(screensMacOS.indexOf(Permissions))
    
    // Go back to Voice screen
    await wrapper.find('.prev').trigger('click')
    expect(component.step).toBe(screensMacOS.indexOf(Voice))
    
    // Go back to Studio screen
    await wrapper.find('.prev').trigger('click')
    expect(component.step).toBe(screensMacOS.indexOf(Studio))
    
    // Go back to Ollama screen
    await wrapper.find('.prev').trigger('click')
    expect(component.step).toBe(screensMacOS.indexOf(Ollama))
    
    // Go back to Chat screen
    await wrapper.find('.prev').trigger('click')
    expect(component.step).toBe(screensMacOS.indexOf(Chat))
    
    // Go back to Welcome screen
    await wrapper.find('.prev').trigger('click')
    expect(component.step).toBe(screensMacOS.indexOf(Welcome))
    
    // Should not be able to go back further - no prev button
    expect(wrapper.find('.prev').exists()).toBe(false)
    
    // Test state persistence - navigate forward again and verify components render correctly
    await wrapper.find('.next').trigger('click')
    expect(component.step).toBe(screensMacOS.indexOf(Chat))
    
    await wrapper.find('.next').trigger('click')
    expect(component.step).toBe(screensMacOS.indexOf(Ollama))
  })

  test('Platform-based navigation skips Permissions screen on non-macOS', async () => {
    
    // Set platform to non-macOS
    ;(window.api as any).platform = 'linux'
    
    const wrapper = await mount(Onboarding)
    const component = wrapper.vm as any
    
    // Navigate through screens until Voice (step 5)
    for (let i = 0; i < 4; i++) {
      await wrapper.find('.next').trigger('click')
    }
    
    // Should be on Voice screen (step 5)
    expect(component.step).toBe(screensOthers.indexOf(Voice))
    
    // Click next - should skip Permissions and go directly to Instructions
    await wrapper.find('.next').trigger('click')
    expect(component.step).toBe(screensOthers.indexOf(Instructions))
    
    // Test backward navigation - should skip Permissions when going back
    await wrapper.find('.prev').trigger('click')
    expect(component.step).toBe(screensOthers.indexOf(Voice))
    
    // Reset platform for other tests
    ;(window.api as any).platform = 'darwin'
  })

})

describe('Navigation Error Handling', () => {

  test('Prevents navigation when Instructions screen is not ready', async () => {
    
    const wrapper = await mount(Onboarding)
    
    // Navigate to instructions screen
    wrapper.vm.step = screensMacOS.indexOf(Instructions)
    await wrapper.vm.$nextTick()
    
    // Mock instructions component to prevent leaving
    const instructionsRef = wrapper.vm.$refs.instructions
    if (instructionsRef) {
      instructionsRef.canLeave = vi.fn().mockResolvedValue(false)
    }
    
    // Try to navigate next - should stay on same step
    const nextButton = wrapper.find('.next')
    await nextButton.trigger('click')
    await wrapper.vm.$nextTick()
    
    // Should still be on same step
    expect(wrapper.vm.step).toBe(screensMacOS.indexOf(Instructions))
  })

})

describe('Language Selector Functionality', () => {

  test('Shows language selector in top right corner', async () => {
    const wrapper = await mount(Onboarding)
    const languageSelector = wrapper.find('.language-selector')
    expect(languageSelector.exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'LangSelect' }).exists()).toBe(true)
  })

  test('Language selector has correct props', async () => {
    const wrapper = await mount(Onboarding)
    const langSelect = wrapper.findComponent({ name: 'LangSelect' })
    
    expect(langSelect.exists()).toBe(true)
    expect(langSelect.props('defaultText')).toBe('common.language.system')
    expect(langSelect.props('filter')).toEqual(['en', 'fr'])
  })

  test('Language selector saves changes to store', async () => {
    expect(store.config.general.locale).toBe('')
    const wrapper = await mount(Onboarding)
    const langSelect = wrapper.findComponent({ name: 'LangSelect' })
    langSelect.find('select').setValue('fr')
    expect(store.config.general.locale).toBe('fr')
  })

  test('Language selector loads current locale on mount', async () => {
    store.config.general.locale = 'fr'
    
    const wrapper = await mount(Onboarding)
    
    // Check that the language selector shows the current locale
    const languageSelector = wrapper.find('select')
    expect(languageSelector.exists()).toBe(true)
    
    // The select should have the French option selected
    expect(languageSelector.element.value).toBe('fr')
  })

})

describe('Welcome Screen', () => {

  test('Renders welcome content', async () => {
    const wrapper = await mount(Welcome)
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.find('header').exists()).toBe(true)
  })

  test('Shows animated background with feature icons', async () => {
    const wrapper = await mount(Welcome)
    const featureItems = wrapper.findAll('.feature')
    expect(featureItems.length).toBeGreaterThan(0)
    
    // Check that feature items have animation delays
    featureItems.forEach((item) => {
      const style = item.attributes('style')
      expect(style).toContain('--delay')
    })
  })

})

describe('Chat Screen - Engine Configuration', () => {

  test('Renders engines with inputs and handles API key interactions', async () => {
    const wrapper = await mount(Chat)
    
    // Should show engines grid with chat engine items
    expect(wrapper.find('.engines-grid').exists()).toBe(true)
    const engineItems = wrapper.findAll('.engine')
    expect(engineItems.length).toBeGreaterThan(0)
    
    // Each engine should have brand and config sections
    engineItems.forEach(item => {
      expect(item.find('.brand').exists()).toBe(true)
      expect(item.find('.config').exists()).toBe(true)
    })
    
    // Should have API key inputs for each engine
    const inputComponents = wrapper.findAllComponents({ name: 'InputObfuscated' })
    expect(inputComponents.length).toBeGreaterThan(0)
    expect(engineItems.length).toBe(inputComponents.length)
  })

  test('API key input functionality and store integration', async () => {
    // Start with clean state
    store.config.engines.openai.apiKey = ''
    
    const wrapper = await mount(Chat)
    
    // Find the first API key input
    const inputComponents = wrapper.findAllComponents({ name: 'InputObfuscated' })
    const firstInputComponent = inputComponents[0]
    const actualInput = firstInputComponent.find('input')
    
    // Test setting an API key
    const testApiKey = 'sk-test-api-key-12345'
    await actualInput.setValue(testApiKey)
    await actualInput.trigger('keyup')
    expect(store.config.engines.openai.apiKey).toBe(testApiKey)
    
    // Test clearing the API key
    await actualInput.setValue('')
    await actualInput.trigger('keyup')
    expect(store.config.engines.openai.apiKey).toBe('')
    
    // Test API key changes update immediately
    await actualInput.setValue('new-key')
    await actualInput.trigger('keyup')
    expect(store.config.engines.openai.apiKey).toBe('new-key')
    
    // Test that changes persist between component instances
    wrapper.unmount()
    await mount(Chat)
    expect(store.config.engines.openai.apiKey).toBe('new-key')
  })

  test('Handles API key changes and shows appropriate status elements', async () => {
    const wrapper = await mount(Chat)
    
    // Find an API key input
    const inputComponents = wrapper.findAllComponents({ name: 'InputObfuscated' })
    const firstInput = inputComponents[0].find('input')
    
    // Each engine should have a config section with status elements
    const configSections = wrapper.findAll('.config')
    expect(configSections.length).toBeGreaterThan(0)
    
    // Each config section should have status span elements (even if empty)
    configSections.forEach(config => {
      const spans = config.findAll('span')
      expect(spans.length).toBeGreaterThan(0)
    })
    
    // Test API key input functionality
    await firstInput.setValue('test-key')
    await firstInput.trigger('keyup')
    
    // The store should be updated
    expect(store.config.engines.openai.apiKey).toBe('test-key')
  })

  test('Displays existing model count for configured engines', async () => {
    // Pre-configure an engine with models using proper ChatModel structure
    store.config.engines.openai.apiKey = 'existing-key'
    if (!store.config.engines.openai.models) {
      store.config.engines.openai.models = { chat: [] }
    }
    store.config.engines.openai.models.chat = [
      { id: 'model1', name: 'Model 1', capabilities: { tools: true, vision: false, reasoning: false, caching: false } },
      { id: 'model2', name: 'Model 2', capabilities: { tools: true, vision: false, reasoning: false, caching: false } }
    ]
    
    const wrapper = await mount(Chat)
    
    // Should show status message (translation key is expected in test environment)
    const statusSpan = wrapper.find('.status')
    expect(statusSpan.exists()).toBe(true)
    expect(statusSpan.text()).toContain('onboarding.chat.alreadyonboarding.chat.count')
  })

})

describe('Ollama Screen - Installation Status Management', () => {

  test('Renders different status states correctly', async () => {
    
    const wrapper = await mount(Ollama)
    const component = wrapper.vm as any
    await component.onVisible?.()
    
    // Should start with checking status
    expect(wrapper.find('.status-section').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'EngineLogo' }).exists()).toBe(true)
    
    // Should have proper structure for status management
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('.form').exists()).toBe(true)
  })

})

describe('Studio Screen - Image/Video Engine Configuration', () => {

  test('Renders studio engines with API key inputs and proper engine filtering', async () => {
    
    const wrapper = await mount(Studio)
    const component = wrapper.vm as any
    await component.onVisible?.()
    
    // Should show engines grid for image/video engines
    expect(wrapper.find('.engines-grid').exists()).toBe(true)
    
    // Should have studio engine items
    const engineItems = wrapper.findAll('.engine')
    expect(engineItems.length).toBeGreaterThan(0)
    
    // Each engine should have brand and config sections
    engineItems.forEach(item => {
      expect(item.find('.brand').exists()).toBe(true)
      expect(item.find('.config').exists()).toBe(true)
      expect(item.findComponent({ name: 'EngineLogo' }).exists()).toBe(true)
      expect(item.findComponent({ name: 'InputObfuscated' }).exists()).toBe(true)
    })
  })

  test('API key input functionality and store integration', async () => {
    // Start with clean state
    store.config.engines.openai.apiKey = ''
    
    const wrapper = await mount(Studio)
    const component = wrapper.vm as any
    await component.onVisible?.()
    
    // Find the first API key input
    const inputComponents = wrapper.findAllComponents({ name: 'InputObfuscated' })
    const firstInputComponent = inputComponents[0]
    const actualInput = firstInputComponent.find('input')
    
    // Test setting an API key
    const testApiKey = 'sk-test-api-key-12345'
    await actualInput.setValue(testApiKey)
    await actualInput.trigger('keyup')
    expect(store.config.engines.openai.apiKey).toBe(testApiKey)
    
    // Test clearing the API key
    await actualInput.setValue('')
    await actualInput.trigger('keyup')
    expect(store.config.engines.openai.apiKey).toBe('')
    
    // Test API key changes update immediately
    await actualInput.setValue('new-key')
    await actualInput.trigger('keyup')
    expect(store.config.engines.openai.apiKey).toBe('new-key')
    
    // Test that changes persist between component instances
    wrapper.unmount()
    await mount(Studio)
    expect(store.config.engines.openai.apiKey).toBe('new-key')
  })

  test('Handles API key changes and shows appropriate status elements', async () => {
    const wrapper = await mount(Studio)
    const component = wrapper.vm as any
    await component.onVisible?.()
    
    // Find an API key input
    const inputComponents = wrapper.findAllComponents({ name: 'InputObfuscated' })
    const firstInput = inputComponents[0].find('input')
    
    // Each engine should have a config section with status elements
    const configSections = wrapper.findAll('.config')
    expect(configSections.length).toBeGreaterThan(0)
    
    // Each config section should have status span elements (even if empty)
    configSections.forEach(config => {
      const spans = config.findAll('span')
      expect(spans.length).toBeGreaterThan(0)
    })
    
    // Test API key input functionality
    await firstInput.setValue('test-key')
    await firstInput.trigger('keyup')
    
    // The store should be updated
    expect(store.config.engines.openai.apiKey).toBe('test-key')
  })

  test('Displays existing model count for configured engines', async () => {
    // Pre-configure an engine with models for studio (image/video)
    store.config.engines.openai.apiKey = 'existing-key'
    if (!store.config.engines.openai.models) {
      store.config.engines.openai.models = { chat: [], image: [], video: [] }
    }
    if (!store.config.engines.openai.models.image) {
      store.config.engines.openai.models.image = []
    }
    if (!store.config.engines.openai.models.video) {
      store.config.engines.openai.models.video = []
    }
    store.config.engines.openai.models.image = [
      { id: 'dall-e-3', name: 'DALL-E 3' },
      { id: 'dall-e-2', name: 'DALL-E 2' }
    ]
    store.config.engines.openai.models.video = [
      { id: 'sora-1', name: 'Sora V1' }
    ]
    
    const wrapper = await mount(Studio)
    const component = wrapper.vm as any
    await component.onVisible?.()
    
    // Should show status message (Studio component uses chat translations)
    const statusSpan = wrapper.find('.status')
    expect(statusSpan.exists()).toBe(true)
    expect(statusSpan.text()).toBe('onboarding.studio.alreadyonboarding.studio.count')
  })

})

describe('Voice Screen - Engine Configuration', () => {

  test('Renders voice engines with functional API key inputs', async () => {
    const wrapper = await mount(Voice)
    const component = wrapper.vm as any
    await component.onVisible?.()
    
    // Should show engines grid
    expect(wrapper.find('.engines-grid').exists()).toBe(true)
    
    // Should have voice engine items
    const engineItems = wrapper.findAll('.engine')
    expect(engineItems.length).toBeGreaterThan(0)
    
    // Each engine should have brand and config sections
    engineItems.forEach(item => {
      expect(item.find('.brand').exists()).toBe(true)
      expect(item.find('.config').exists()).toBe(true)
    })
    
    // Should have functional API key inputs
    const inputComponents = wrapper.findAllComponents({ name: 'InputObfuscated' })
    expect(inputComponents.length).toBeGreaterThan(0)
    
    // Each input should have proper password structure
    inputComponents.forEach(inputComponent => {
      const actualInput = inputComponent.find('input')
      expect(actualInput.exists()).toBe(true)
      expect(actualInput.attributes('type')).toBe('password')
    })
  })

  test('API key input functionality and store integration', async () => {
    // Start with clean state
    store.config.engines.openai.apiKey = ''
    
    const wrapper = await mount(Voice)
    const component = wrapper.vm as any
    await component.onVisible?.()
    
    // Find the first API key input
    const inputComponents = wrapper.findAllComponents({ name: 'InputObfuscated' })
    const firstInputComponent = inputComponents[0]
    const actualInput = firstInputComponent.find('input')
    
    // Test setting an API key
    const testApiKey = 'sk-test-api-key-12345'
    await actualInput.setValue(testApiKey)
    await actualInput.trigger('keyup')
    expect(store.config.engines.openai.apiKey).toBe(testApiKey)
    
    // Test clearing the API key
    await actualInput.setValue('')
    await actualInput.trigger('keyup')
    expect(store.config.engines.openai.apiKey).toBe('')
    
    // Test API key changes update immediately
    await actualInput.setValue('new-key')
    await actualInput.trigger('keyup')
    expect(store.config.engines.openai.apiKey).toBe('new-key')
    
    // Test that changes persist between component instances
    wrapper.unmount()
    await mount(Voice)
    expect(store.config.engines.openai.apiKey).toBe('new-key')
  })

  test('Handles API key changes and shows appropriate status elements', async () => {
    const wrapper = await mount(Voice)
    const component = wrapper.vm as any
    await component.onVisible?.()
    
    // Find an API key input
    const inputComponents = wrapper.findAllComponents({ name: 'InputObfuscated' })
    const firstInput = inputComponents[0].find('input')
    
    // Each engine should have a config section with status elements
    const configSections = wrapper.findAll('.config')
    expect(configSections.length).toBeGreaterThan(0)
    
    // Each config section should have status span elements (even if empty)
    configSections.forEach(config => {
      const spans = config.findAll('span')
      expect(spans.length).toBeGreaterThan(0)
    })
    
    // Test API key input functionality
    await firstInput.setValue('test-key')
    await firstInput.trigger('keyup')
    
    // The store should be updated
    expect(store.config.engines.openai.apiKey).toBe('test-key')
  })

  test('Displays existing model count for configured engines', async () => {
    // Pre-configure an engine with models for voice (STT/TTS)
    store.config.engines.openai.apiKey = 'existing-key'
    if (!store.config.engines.openai.models) {
      store.config.engines.openai.models = { chat: [], stt: [], tts: [] }
    }
    if (!store.config.engines.openai.models.stt) {
      store.config.engines.openai.models.stt = []
    }
    if (!store.config.engines.openai.models.tts) {
      store.config.engines.openai.models.tts = []
    }
    store.config.engines.openai.models.stt = [
      { id: 'whisper-1', name: 'Whisper V2' }
    ]
    store.config.engines.openai.models.tts = [
      { id: 'tts-1', name: 'TTS HD' }
    ]
    
    const wrapper = await mount(Voice)
    const component = wrapper.vm as any
    await component.onVisible?.()
    
    // Should show status message (Voice component uses chat translations)
    const statusSpan = wrapper.find('.status')
    expect(statusSpan.exists()).toBe(true)
    expect(statusSpan.text()).toBe('onboarding.voice.alreadyonboarding.voice.count')
  })

})

describe('Permissions Screen', () => {

  test('Renders with proper structure and permission cards', async () => {
    const wrapper = await mount(Permissions)
    const component = wrapper.vm as any
    await component.onVisible()

    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('onboarding.permissions.title')
    expect(wrapper.find('h3').text()).toBe('onboarding.permissions.subtitle')
    
    // Check permission cards
    const permissionCards = wrapper.findAll('.permission-card')
    expect(permissionCards).toHaveLength(2)
    
    // Check accessibility card
    expect(wrapper.text()).toContain('onboarding.permissions.accessibility.title')
    expect(wrapper.text()).toContain('onboarding.permissions.accessibility.description')
    
    // Check automation card
    expect(wrapper.text()).toContain('onboarding.permissions.automation.title')
    expect(wrapper.text()).toContain('onboarding.permissions.automation.description')
    
    // Check that refresh button is no longer present
    expect(wrapper.find('.refresh-button').exists()).toBe(false)
  })

  test('Shows permissions as granted on non-macOS platforms', async () => {
    // Mock platform as non-darwin
    window.api.platform = 'win32'
    
    const wrapper = await mount(Permissions)
    const component = wrapper.vm as any
    await component.onVisible()
    await wrapper.vm.$nextTick()
    
    // Wait for permissions check to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    await wrapper.vm.$nextTick()
    
    // Both permissions should be granted
    const grantedCards = wrapper.findAll('.permission-card.granted')
    expect(grantedCards).toHaveLength(2)
    
    // Reset platform
    window.api.platform = 'darwin'
  })

  test('Calls permission check APIs on macOS', async () => {
    const wrapper = await mount(Permissions)
    const component = wrapper.vm as any
    await component.onVisible()
    
    // Wait for permissions check to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Check that permission APIs were called
    expect((window.api as any).permissions.checkAccessibility).toHaveBeenCalled()
    expect((window.api as any).permissions.checkAutomation).toHaveBeenCalled()
  })

  test('Can leave permission screen with proper confirmation logic', async () => {
    const wrapper = await mount(Permissions)
    const component = wrapper.vm as any
    await component.onVisible()
    
    // Test 1: When permissions are not granted, should show dialog and return based on user choice
    // Mock permissions as not granted
    ;(window.api as any).permissions.checkAccessibility.mockResolvedValue(false)
    ;(window.api as any).permissions.checkAutomation.mockResolvedValue(false)
    
    // Trigger permission check to update state
    await wrapper.vm.checkPermissions()
    await nextTick()
    
    // Dialog mock returns { isConfirmed: true } by default, so canLeave should return true
    const canLeaveWithDialog = await wrapper.vm.canLeave()
    expect(canLeaveWithDialog).toBe(true)
    
    // Test 2: When all permissions are granted, should not show dialog and return true
    // Mock permissions as granted
    ;(window.api as any).permissions.checkAccessibility.mockResolvedValue(true)
    ;(window.api as any).permissions.checkAutomation.mockResolvedValue(true)
    
    // Trigger permission check to update state
    await wrapper.vm.checkPermissions()
    await nextTick()
    
    // Should return true without showing dialog
    const canLeaveWithoutDialog = await wrapper.vm.canLeave()
    expect(canLeaveWithoutDialog).toBe(true)
  })

  test('Polls permission status automatically', async () => {
    const wrapper = await mount(Permissions)
    const component = wrapper.vm as any
    await component.onVisible()
    
    // Clear previous calls
    vi.clearAllMocks()
    
    // Wait for initial check and first poll interval
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    // Check that permission APIs were called multiple times due to polling
    expect((window.api as any).permissions.checkAccessibility).toHaveBeenCalled()
    expect((window.api as any).permissions.checkAutomation).toHaveBeenCalled()
    
    // Unmount to stop polling
    wrapper.unmount()
  })

})

describe('Instructions Screen', () => {

  test('Renders with proper structure and UI state management', async () => {
    
    const wrapper = await mount(Instructions)
    
    // Basic rendering
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.find('header').exists()).toBe(true)
    
    // Initial UI state - should show chat interface with loader
    expect(wrapper.find('.message-area').exists()).toBe(true)
    expect(wrapper.find('.prompt-area').exists()).toBe(true)
    expect(wrapper.find('.loader').exists()).toBe(true)
    expect(wrapper.find('.instructions-chat').exists()).toBe(true)
    
    // Should not show other states initially
    expect(wrapper.find('.confirmation-area').exists()).toBe(false)
    expect(wrapper.find('.instruction-selection').exists()).toBe(false)

  })

  test('Shows instruction selection stage when stage is set to select', async () => {
    
    const wrapper = await mount(Instructions)
    const component = wrapper.vm as any
    await component.onVisible()
    
    // Access the component's internal state directly
    component.stage = 'select'
    await wrapper.vm.$nextTick()
    
    // Should show instruction selection interface
    expect(wrapper.find('.instruction-selection').exists()).toBe(true)
    expect(wrapper.find('.selection-header').exists()).toBe(true)
    expect(wrapper.find('.instructions-grid').exists()).toBe(true)
    
    // Should have instruction cards
    const instructionCards = wrapper.findAll('.instruction-card')
    expect(instructionCards.length).toBeGreaterThan(0)
    
    // Should not show chat interface or confirmation
    expect(wrapper.find('.loader').exists()).toBe(false)
    expect(wrapper.find('.message-area').exists()).toBe(false)
    expect(wrapper.find('.confirmation-area').exists()).toBe(false)
  })

  test('Shows confirmation stage when stage is set to confirm', async () => {
    const wrapper = await mount(Instructions)
    const component = wrapper.vm as any
    await component.onVisible()

    // Access the component's internal state directly
    component.stage = 'confirm'
    await wrapper.vm.$nextTick()
    
    // Should show confirmation interface
    expect(wrapper.find('.confirmation-area').exists()).toBe(true)
    expect(wrapper.find('.confirmation-area h2').exists()).toBe(true)
    
    // Should not show other interfaces
    expect(wrapper.find('.message-area').exists()).toBe(false)
    expect(wrapper.find('.instruction-selection').exists()).toBe(false)
  })

  test('Instruction selection creates custom instructions and saves to store', async () => {
    // Clear existing custom instructions
    store.config.llm.customInstructions = []
    store.config.llm.instructions = ''
    
    const wrapper = await mount(Instructions)
    const component = wrapper.vm as any
    await component.onVisible()

    // Set up the selection stage with detected system prompt
    component.stage = 'select'
    component.detectedSystemPrompt = 'Custom system prompt for testing'
    await wrapper.vm.$nextTick()
    
    // Find and click on the first instruction card
    const instructionCards = wrapper.findAll('.instruction-card')
    expect(instructionCards.length).toBeGreaterThan(0)
    
    const firstCard = instructionCards[0]
    await firstCard.trigger('click')
    
    // Should transition to confirm stage
    expect(component.stage).toBe('confirm')
    
    // Should have created a custom instruction in the store
    expect(store.config.llm.customInstructions.length).toBe(1)
    expect(store.config.llm.customInstructions[0].instructions).toContain('Custom system prompt for testing')
    expect(store.config.llm.instructions).toBe(store.config.llm.customInstructions[0].id)
  })

  test('Prompt interaction triggers message processing', async () => {
    const wrapper = await mount(Instructions)
    const component = wrapper.vm as any
    await component.onVisible()

    // Wait for initial loading to complete
    await vi.waitFor(() => {
      return wrapper.find('.loader').exists() === false || component.latestText !== null
    }, { timeout: 2000 })
    
    // Find the Prompt component and trigger a prompt
    const promptComponent = wrapper.findComponent({ name: 'Prompt' })
    expect(promptComponent.exists()).toBe(true)
    
    // Trigger a prompt event
    await promptComponent.vm.$emit('prompt', { prompt: 'Test user prompt' })
    
    // Should show processing state
    expect(component.isProcessing).toBe(true)
  })

  test('CanLeave function returns true when completed', async () => {
    const wrapper = await mount(Instructions)
    const component = wrapper.vm as any
    
    // Set completed state by transitioning to confirm stage
    component.stage = 'confirm'
    component.completed = true
    
    // canLeave should return true when completed
    const canLeave = await component.canLeave()
    expect(canLeave).toBe(true)
  })

})

