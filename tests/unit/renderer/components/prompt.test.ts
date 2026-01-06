
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { emitEventMock } from '@root/vitest.setup'
import { stubTeleport } from '@tests/mocks/stubs'
import { store } from '@services/store'
import Prompt from '@components/Prompt.vue'
import Chat from '@models/chat'
import Attachment from '@models/attachment'
import { getLlmLocale } from '@services/i18n'
import Dialog from '@renderer/utils/dialog'

enableAutoUnmount(afterAll)

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

vi.mock('@renderer/utils/dialog', () => ({
  default: {
    show: vi.fn(),
    alert: vi.fn()
  }
}))

vi.mock('@renderer/voice/stt', () => ({
  isSTTReady: vi.fn(() => true),
}))

vi.mock('@renderer/audio/audio_recorder', () => ({
  default: vi.fn(() => ({
    initialize: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    release: vi.fn(),
    getAnalyser: vi.fn(() => ({
      getByteTimeDomainData: vi.fn()
    })),
    getBufferLength: vi.fn(() => 1024)
  })),
}))

vi.mock('@renderer/audio/transcriber', () => ({
  default: vi.fn(() => ({
    transcriber: {
      initialize: vi.fn(),
      requiresPcm16bits: false,
      requiresStreaming: false,
      transcribe: vi.fn().mockResolvedValue({ text: 'test transcription' }),
      startStreaming: vi.fn(),
      sendStreamingChunk: vi.fn(),
      endStreaming: vi.fn()
    },
    processStreamingError: vi.fn()
  }))
}))

vi.mock('@renderer/utils/image_utils', () => ({
  default: {
    resize: vi.fn((dataUrl, maxSize, callback) => {
      // Simulate successful resize by calling the callback with modified content
      callback('resized_base64_content', 'image/png')
    })
  }
}))

let wrapper: VueWrapper<any>
let chat: Chat|null = null

beforeAll(async () => {
  useBrowserMock()
  useWindowMock({ favoriteModels: true })
  store.isFeatureEnabled = () => true
  store.loadExperts()
  store.loadCommands()
})

beforeEach(() => {
  vi.clearAllMocks()
  
  // Setup custom emitEventMock implementation
  vi.mocked(emitEventMock).mockImplementation((event, ...args) => {
    // this is called when mounting so discard it
    if (event === 'prompt-resize' && args[0] === '0px') {
      emitEventMock.mockClear()
    }
  })
  
  store.loadSettings()
  store.config.llm.imageResize = 0
  store.config.engines.openai.models.chat.push(
    { id: 'gpt-5.2', name: 'gpt-5.2', capabilities: { tools: true, vision: true, reasoning: false, caching: false } },
  )
  store.config.engines.mock = {
    models: {
      chat: [
        { id: 'chat', name: 'chat', capabilities: { tools: true, vision: true, reasoning: false, caching: false } },
        { id: 'chat2', name: 'chat2', capabilities: { tools: true, vision: true, reasoning: false, caching: false } },
        { id: 'vision', name: 'vision', capabilities: { tools: true, vision: true, reasoning: false, caching: false } },
      ]
    },
    model: {
      chat: 'chat'
    }
  }

  chat = new Chat()

  // for an unknown reason enableTools make some of the menu tests fail even though things work
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat, enableTools: false } } )
})

test('Render', () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.input textarea').exists()).toBe(true)
  expect(wrapper.find('.send').exists()).toBe(true)
  expect(wrapper.find('.stop').exists()).toBe(false)
  expect(window.api.docrepo.list).toHaveBeenCalled()
})

test('Has unique IDs for menu anchors', () => {
  const promptMenu = wrapper.find('.prompt-menu')
  const modelMenuButton = wrapper.find('.model-menu-button')

  expect(promptMenu.exists()).toBe(true)
  expect(modelMenuButton.exists()).toBe(true)

  // Check that both elements have id attributes
  const promptMenuId = promptMenu.attributes('id')
  const modelMenuButtonId = modelMenuButton.attributes('id')

  expect(promptMenuId).toBeTruthy()
  expect(modelMenuButtonId).toBeTruthy()

  // Check that IDs start with the expected prefix
  expect(promptMenuId).toMatch(/^prompt-menu-/)
  expect(modelMenuButtonId).toMatch(/^model-menu-button-/)

  // Check that IDs are different
  expect(promptMenuId).not.toBe(modelMenuButtonId)
})

test('Different Prompt instances have different unique IDs', () => {
  const chat2 = new Chat()
  const wrapper2 = mount(Prompt, { ...stubTeleport, props: { chat: chat2, enableTools: false } })

  const promptMenu1 = wrapper.find('.prompt-menu').attributes('id')
  const promptMenu2 = wrapper2.find('.prompt-menu').attributes('id')
  const modelMenu1 = wrapper.find('.model-menu-button').attributes('id')
  const modelMenu2 = wrapper2.find('.model-menu-button').attributes('id')

  // Check that different instances have different IDs
  expect(promptMenu1).not.toBe(promptMenu2)
  expect(modelMenu1).not.toBe(modelMenu2)

  wrapper2.unmount()
})

test('Send on click', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await wrapper.find('.send-stop').trigger('click')
  expect(wrapper.emitted<any[]>().prompt[0][0]).toMatchObject({
    prompt: 'this is my prompt',
    attachments: [],
    docrepos: [],
    execMode: 'prompt',
  })
  expect(prompt.element.value).toBe('')
})

test('Sends on enter', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(wrapper.emitted<any[]>().prompt[0][0]).toMatchObject({
    prompt: 'this is my prompt',
    attachments: [],
    docrepos: [],
    execMode: 'prompt',
  })
  expect(prompt.element.value).toBe('')
})

test('Not send on shift enter', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown', { key: 'Enter', shiftKey: true })
  expect(emitEventMock.mock.calls.filter(c => c[0] !== 'prompt-resize').length).toBe(0)
})

test('Sends on shift enter when sendKey is shiftEner', async () => {
  store.config.appearance.chat.sendKey = 'shiftEner'
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown', { key: 'Enter', shiftKey: true })
  expect(wrapper.emitted<any[]>().prompt[0][0]).toMatchObject({
    prompt: 'this is my prompt',
    attachments: [],
    docrepos: [],
    execMode: 'prompt',
  })
  expect(prompt.element.value).toBe('')
  store.config.appearance.chat.sendKey = 'enter'
})

test('Not send on enter when sendKey is shiftEner', async () => {
  store.config.appearance.chat.sendKey = 'shiftEner'
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(emitEventMock.mock.calls.filter(c => c[0] !== 'prompt-resize').length).toBe(0)
  store.config.appearance.chat.sendKey = 'enter'
})

test('Sends with right parameters', async () => {
  wrapper.vm.attachments = [ new Attachment('image64', 'image/png', 'file://image.png') ]
  wrapper.vm.expert = store.experts[2]
  wrapper.vm.docrepos = ['docrepo']
  wrapper.vm.deepResearchActive = true
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt2')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(wrapper.emitted<any[]>().prompt[0]).toMatchObject([{
    prompt: 'this is my prompt',
    attachments: expect.arrayContaining([
      expect.objectContaining({ content: 'image64', mimeType: 'image/png', url: 'file://image.png' })
    ]),
    expert: expect.objectContaining({ id: 'uuid3', name: 'actor3', prompt: 'prompt3' }),
    docrepos: ['docrepo'],
    execMode: 'deepresearch',
  }])
  expect(prompt.element.value).toBe('')
})

// test('Autogrow', async () => {
//   const prompt = wrapper.find('.input textarea')
//   for (const char of 'this is my prompt') {
//     await prompt.trigger(`keyup.${char}`)
//   }
//   expect(prompt.element.value).toBe('this is my prompt')
//   expect(prompt.element.style.height).toBe('150px')
// })

test('Show stop button when working', async () => {
  const chat = Chat.fromJson({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  expect(wrapper.find('.send').exists()).toBe(false)
  expect(wrapper.find('.stop').exists()).toBe(true)
  await wrapper.find('.send-stop').trigger('click')
  expect(wrapper.emitted<any[]>().stop).toBeTruthy()
})

test('promptingState starts as idle', () => {
  expect(wrapper.vm.promptingState).toBe('idle')
})

test('promptingState changes to prompting when message transient', async () => {
  const chat = Chat.fromJson({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.promptingState).toBe('prompting')
})

test('promptingState changes to canceling when stop clicked', async () => {
  const chat = Chat.fromJson({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.promptingState).toBe('prompting')

  await wrapper.find('.icon.stop').trigger('click')
  expect(wrapper.vm.promptingState).toBe('canceling')
})

test('promptingState returns to idle when message completes', async () => {
  const chat = Chat.fromJson({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.promptingState).toBe('prompting')

  // Create new chat with completed message to trigger watcher
  const completedChat = Chat.fromJson({ messages: [ {} ] })
  completedChat.messages[0].transient = false
  await wrapper.setProps({ chat: completedChat })
  await wrapper.vm.$nextTick()
  expect(wrapper.vm.promptingState).toBe('idle')
})

test('Stop button shows correct icon based on state', async () => {
  // Idle - shows send icon
  expect(wrapper.find('.send').exists()).toBe(true)
  expect(wrapper.find('.stop').exists()).toBe(false)

  // Prompting - shows stop icon
  const chat = Chat.fromJson({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.send').exists()).toBe(false)
  expect(wrapper.find('.stop').exists()).toBe(true)
})

test('Stop button has canceling class when canceling', async () => {
  const chat = Chat.fromJson({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  await wrapper.vm.$nextTick()

  expect(wrapper.find('.icon.stop.canceling').exists()).toBe(false)

  await wrapper.find('.icon.stop').trigger('click')
  expect(wrapper.find('.icon.stop.canceling').exists()).toBe(true)
})

test('Escape key triggers stop when prompting', async () => {
  const chat = Chat.fromJson({ messages: [ {} ] })
  chat.messages[0].transient = true
  await wrapper.setProps({ chat: chat })
  await wrapper.vm.$nextTick()

  expect(wrapper.vm.promptingState).toBe('prompting')

  // Simulate Escape key at document level
  const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
  document.dispatchEvent(escapeEvent)
  await wrapper.vm.$nextTick()

  expect(wrapper.emitted<any[]>().stop).toBeTruthy()
  expect(wrapper.vm.promptingState).toBe('canceling')
})

test('Escape key does nothing when idle', async () => {
  expect(wrapper.vm.promptingState).toBe('idle')

  // Simulate Escape key at document level
  const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
  document.dispatchEvent(escapeEvent)
  await wrapper.vm.$nextTick()

  expect(wrapper.emitted<any[]>().stop).toBeFalsy()
  expect(wrapper.vm.promptingState).toBe('idle')
})

test('Stores attachment', async () => {
  await wrapper.find('.prompt-menu').trigger('click')
  const menu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  await menu.find('.attachments').trigger('click')
  await wrapper.vm.$nextTick() // Wait for async operations
  expect(window.api.file.pickFile).toHaveBeenCalled()
  expect(window.api.file.pickFile).toHaveBeenLastCalledWith({
    multiselection: true,
    //filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }]
  })
  expect(wrapper.vm.attachments).toEqual([{
    mimeType: 'image/png',
    content: 'image1.png_encoded',
    saved: false,
    extracted: false,
    filepath: 'image1.png',
    url: 'image1.png',
    title: '',
    context: '',
  }, {
    mimeType: 'image/png',
    content: 'image2.png_encoded',
    saved: false,
    extracted: false,
    filepath: 'image2.png',
    url: 'image2.png',
    title: '',
    context: '',
  }])
})

test('Remove attachments', async () => {
  wrapper.vm.attachments = [
    new Attachment('image64', 'image/png', 'file://image.png'),
    new Attachment('image64', 'image/png', 'file://image.png')
  ]
  await wrapper.vm.$nextTick()
  await wrapper.find('.attachment:last-child .delete').trigger('click')
  expect(wrapper.vm.attachments).toHaveLength(1)
  await wrapper.find('.attachment:last-child .delete').trigger('click')
  expect(wrapper.vm.attachments).toStrictEqual([])
})

test('Display url attachment', async () => {
  wrapper.vm.attachments = [ new Attachment('', '', 'file://image.png') ]
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.attachments').exists()).toBe(true)
  expect(wrapper.find('.attachment').exists()).toBe(true)
  expect(wrapper.find('.attachment img').exists()).toBe(true)
  expect(wrapper.find('.attachment img').attributes('src')).toBe('file://image.png')
})

test('Display base64 attachment', async () => {
  wrapper.vm.attachments = [ new Attachment('image64', 'image/png', 'file://image.png') ]
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.attachments').exists()).toBe(true)
  expect(wrapper.find('.attachment').exists()).toBe(true)
  expect(wrapper.find('.attachment img').exists()).toBe(true)
  expect(wrapper.find('.attachment img').attributes('src')).toBe('data:image/png;base64,image64')
})

// test('Accept incoming prompt', async () => {
//   const prompt = wrapper.find('.input textarea')
//   prompt.setValue('')
//   emitEventMock.mockRestore()
//   useEventBus().emitEvent('set-prompt', { content: 'this is my prompt' })
//   await wrapper.vm.$nextTick()
//   expect(prompt.element.value).toBe('this is my prompt')
// })

test('History navigation', async () => {
  
  await wrapper.setProps({ historyProvider: () => [ 'Hello', 'Bonjour' ] })
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.setValue('Hola')
  // triggering ArrowUp does not move selection to the beginning
  // as it does in real-life so we need to set it manually
  await prompt.element.setSelectionRange(0, 0)
  await prompt.trigger('keydown.ArrowUp')
  expect(prompt.element.value).toBe('Bonjour')
  await prompt.trigger('keydown.ArrowUp')
  expect(prompt.element.value).toBe('Hello')
  await prompt.trigger('keydown.ArrowUp')
  expect(prompt.element.value).toBe('Hello')
  await prompt.trigger('keydown.ArrowDown')
  expect(prompt.element.value).toBe('Bonjour')
  await prompt.trigger('keydown.ArrowDown')
  expect(prompt.element.value).toBe('Hola')

})

test('Selects instructions', async () => {
  await wrapper.find('.prompt-menu').trigger('click')
  const menu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  await menu.find('.instructions').trigger('click')
  // expect(menu.findAll('.filter-input').length).toBe(1)
  expect(menu.findAll('.item').length).toBe(8)
  await menu.find('.item:nth-child(1)').trigger('click')
  expect(wrapper.vm.instructions).toBe(null)
  
  await wrapper.find('.prompt-menu').trigger('click')
  await wrapper.find('.instructions').trigger('click')
  const menu2 = wrapper.find('.context-menu')
  await menu2.find('.item:nth-child(3)').trigger('click')
  expect(wrapper.vm.instructions).toStrictEqual({
    id: 'structured',
    label: 'settings.llm.instructions.structured',
    instructions: 'instructions.chat.structured_default'
  })
})

test('Selects instructions based on chat locale', async () => {
  wrapper.vm.chat.locale = 'fr-FR'
  
  await wrapper.find('.prompt-menu').trigger('click')
  const menu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  await menu.find('.instructions').trigger('click')
  
  await menu.find('.item:nth-child(4)').trigger('click')
  expect(wrapper.vm.instructions).toStrictEqual({
    id: 'playful',
    label: 'settings.llm.instructions.playful',
    instructions: 'instructions.chat.playful_fr-FR'
  })
  expect(getLlmLocale()).toBe('default')
})

test('Selects expert', async () => {
  // Open expert menu
  await wrapper.find('.prompt-menu').trigger('click')
  const menu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  await menu.find('.experts').trigger('click')

  // Menu now shows categories first, then uncategorized experts
  // Test experts uuid1-4: uuid1 has no category, uuid2-4 have cat-1 or cat-2
  // Find and click an uncategorized expert (uuid1) or navigate into a category
  const items = menu.findAll('.item')

  // Look for uncategorized expert (should be directly clickable)
  const uncategorizedExpert = items.find(item => item.text().includes('actor'))
  if (uncategorizedExpert) {
    await uncategorizedExpert.trigger('click')
  } else {
    // Navigate into first category, then click first expert
    const firstCategory = items.at(0)
    await firstCategory.trigger('click')
    await menu.vm.$nextTick()
    const expertInCategory = menu.findAll('.item').find(item => item.text().includes('actor'))
    await expertInCategory.trigger('click')
  }

  await wrapper.vm.$nextTick()
  expect(wrapper.vm.expert.id).toBe('uuid3')
  expect(wrapper.find('.prompt-feature').exists()).toBe(true)
})

test('Clears expert', async () => {
  wrapper.vm.expert = store.experts[0]
  await wrapper.vm.$nextTick()
  const feature = wrapper.findComponent({ name: 'PromptFeature' })
  expect(feature.exists()).toBe(true)
  expect(feature.find('.clear').exists()).toBe(false)
  await feature.trigger('mouseenter')
  await feature.find('.clear').trigger('click')
  expect(wrapper.vm.expert).toBeNull()
})

test('Sets engine and model when expert has them', async () => {
  // Initial state - chat should have undefined engine/model
  expect(chat!.engine).toBeUndefined()
  expect(chat!.model).toBeUndefined()

  // Select expert with engine and model set (uuid4: anthropic/claude-3-sonnet)
  // Directly set expert since menu structure changed to category-based
  const expertWithEngineModel = store.experts.find(e => e.id === 'uuid4')
  wrapper.vm.setExpert(expertWithEngineModel)
  await wrapper.vm.$nextTick()

  // Verify expert was selected
  expect(wrapper.vm.expert.id).toBe('uuid4')

  // Verify chat engine and model were updated
  expect(chat!.engine).toBe('anthropic')
  expect(chat!.model).toBe('claude-3-sonnet')
})

test('Stores command for later', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.trigger('keydown', { key: '#' })
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.filter-input').length).toBe(1)
  expect(menu.findAll('.item').length).toBe(4)
  await menu.findAll('.item')[1].trigger('click')
  expect(wrapper.vm.command.id).toBe('uuid2')
  expect(wrapper.find('.input .icon.command.left').exists()).toBe(true)
  prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(wrapper.emitted<any[]>().prompt[0][0]).toMatchObject({
    prompt: 'command_uuid2_template_this is my prompt',
    attachments: [],
    docrepos: [],
    execMode: 'prompt',
  })
})

test('Selects command and run', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  const trigger = wrapper.find('.icon.command')
  await trigger.trigger('click')
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.filter-input').length).toBe(1)
  expect(menu.findAll('.item').length).toBe(4)
  await menu.findAll('.item')[1].trigger('click')
  expect(wrapper.emitted<any[]>().prompt[0][0]).toMatchObject({
    prompt: 'command_uuid2_template_this is my prompt',
    attachments: [],
    docrepos: [],
    execMode: 'prompt',
  })
})

test('Clears comamnd', async () => {
  wrapper.vm.command = store.commands[0]
  await wrapper.vm.$nextTick()
  await wrapper.find('.input .icon.command.left').trigger('click')
  expect(wrapper.vm.command).toBeNull()
})

test('Document repository', async () => {
  await wrapper.find('.prompt-menu').trigger('click')
  const menu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  await menu.find('.docrepos').trigger('click')
  // Items: select all + clear all (when multi-select) + 2 docrepos + 1 manage footer item
  const items = menu.findAll('.item')
  // Multi-select menu has select all, clear all, then docrepos, then manage
  expect(items.length).toBeGreaterThanOrEqual(2)
  // Connect to a docrepo - with multi-select it toggles
  await menu.find('.item:nth-child(1)').trigger('click')
})

test('Tools', async () => {
  // Mount wrapper with enableTools enabled
  chat!.tools = []
  const toolsWrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat!, enableTools: true } })
  await toolsWrapper.find('.prompt-menu').trigger('click')
  const menu = toolsWrapper.findComponent({ name: 'PromptMenu' })

  // Simulate saving tools from PromptMenu
  await menu.vm.$emit('pluginToggle', 'search')
  await menu.vm.$emit('serverToolToggle', {}, { uuid: 'tool1___server1' })
  await menu.vm.$emit('close')

  // Agent step should have updated tools
  expect(chat!.tools).toEqual(['search_internet', 'tool1___server1'])
})

test('Deep Research', async () => {
  // Mount wrapper with enableDeepResearch enabled
  const deepResearchWrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat!, enableDeepResearch: true } })
  
  expect(deepResearchWrapper.vm.isDeepResearchActive()).toBe(false)
  
  await deepResearchWrapper.find('.prompt-menu').trigger('click')
  const menu = deepResearchWrapper.findComponent({ name: 'ContextMenuPlus' })
  await menu.find('.deepresearch').trigger('click')
  
  expect(deepResearchWrapper.vm.isDeepResearchActive()).toBe(true)
})

test('PromptFeature component displays for active expert', async () => {
  wrapper.vm.expert = store.experts[0]
  await wrapper.vm.$nextTick()
  
  const feature = wrapper.findComponent({ name: 'PromptFeature' })
  expect(feature.exists()).toBe(true)
  expect(feature.props('label')).toBe('expert_uuid1_name')
})

test('PromptFeature component displays for active docrepos', async () => {
  wrapper.vm.docrepos = ['uuid1']
  await wrapper.vm.$nextTick()

  const features = wrapper.findAllComponents({ name: 'PromptFeature' })
  const docrepoFeature = features.find(f => f.props('label') === 'docrepo1')
  expect(docrepoFeature).toBeTruthy()
})

test('PromptFeature component displays for active instructions', async () => {
  wrapper.vm.instructions = { id: 'structured', label: 'Structured', instructions: 'test' }
  await wrapper.vm.$nextTick()
  
  const features = wrapper.findAllComponents({ name: 'PromptFeature' })
  const instructionsFeature = features.find(f => f.props('label') === 'Structured')
  expect(instructionsFeature).toBeTruthy()
})

test('PromptFeature component displays for active deep research', async () => {
  wrapper.vm.deepResearchActive = true
  await wrapper.vm.$nextTick()
  
  const features = wrapper.findAllComponents({ name: 'PromptFeature' })
  const deepResearchFeature = features.find(f => f.props('label') === 'common.deepResearch')
  expect(deepResearchFeature).toBeTruthy()
})

test('Clear functions work correctly', async () => {
  // Set up test data
  wrapper.vm.expert = store.experts[0]
  wrapper.vm.docrepos = ['uuid1']
  wrapper.vm.instructions = { id: 'structured', label: 'Structured', instructions: 'test' }
  wrapper.vm.deepResearchActive = true
  await wrapper.vm.$nextTick()

  // Test clearExpert
  wrapper.vm.clearExpert()
  expect(wrapper.vm.expert).toBeNull()

  // Test clearDocRepos
  wrapper.vm.clearDocRepos()
  expect(wrapper.vm.docrepos).toStrictEqual([])

  // Test clearInstructions
  wrapper.vm.clearInstructions()
  expect(wrapper.vm.instructions).toBeNull()

  // Test clearDeepResearch
  wrapper.vm.clearDeepResearch()
  expect(wrapper.vm.deepResearchActive).toBe(false)
})

test('matchInstructions function works correctly', () => {
  // Test with null/undefined
  expect(wrapper.vm.matchInstructions()).toBeNull()
  expect(wrapper.vm.matchInstructions('')).toBeNull()
  
  // Test with standard instruction
  const standardResult = wrapper.vm.matchInstructions('instructions.chat.structured_default')
  expect(standardResult).toEqual({
    id: 'structured',
    label: 'settings.llm.instructions.structured',
    instructions: 'instructions.chat.structured_default'
  })
  
  // Test with custom instruction (fallback)
  const customResult = wrapper.vm.matchInstructions('Some custom text')
  expect(customResult).toEqual({
    id: 'custom',
    label: 'Custom',
    instructions: 'Some custom text'
  })
})

test('matchDocRepos function works correctly', async () => {
  // Load docrepos first
  await wrapper.vm.loadDocRepos()

  // Test with null/undefined
  expect(wrapper.vm.matchDocRepos()).toStrictEqual([])
  expect(wrapper.vm.matchDocRepos([])).toStrictEqual([])

  // Test with valid docrepo IDs
  expect(wrapper.vm.matchDocRepos(['uuid1'])).toStrictEqual(['uuid1'])
  expect(wrapper.vm.matchDocRepos(['uuid1', 'uuid2'])).toStrictEqual(['uuid1', 'uuid2'])

  // Test with invalid docrepo ID (filters out invalid)
  expect(wrapper.vm.matchDocRepos(['invalid-uuid'])).toStrictEqual([])
})

test('getDocRepoName function works correctly', async () => {
  // Load docrepos first
  await wrapper.vm.loadDocRepos()

  // Test with valid docrepo
  expect(wrapper.vm.getDocRepoName('uuid1')).toBe('docrepo1')

  // Test with invalid docrepo (returns fallback)
  expect(wrapper.vm.getDocRepoName('invalid-uuid')).toBe('Knowledge Base')
})

test('Model menu button displays and opens menu', async () => {

  wrapper.vm.chat.engine = 'mock'
  wrapper.vm.chat.model = 'chat'
  await wrapper.vm.$nextTick()

  // Check model menu button exists
  const modelButton = wrapper.find('.model-menu-button')
  expect(modelButton.exists()).toBe(true)
  
  // Check it shows model name - should show fallback since mock doesn't return a model name
  expect(modelButton.text()).toContain('chat')
  
  // Click the button
  await modelButton.trigger('click')
  
  // Check that showModelMenu is true
  expect(wrapper.vm.showModelMenu).toBe(true)
})

test('Adds to favorite', async () => {

  wrapper.vm.chat.engine = 'mock'
  wrapper.vm.chat.model = 'chat2'
  await wrapper.vm.$nextTick()

  // Find buttons by name attribute
  const addButton = wrapper.find('[name="addToFavorites"]')
  const removeButton = wrapper.find('[name="removeFavorite"]')
  
  // Should have add button but not remove button
  expect(addButton.exists()).toBe(true)
  expect(removeButton.exists()).toBe(false)

  // Click the add button
  await addButton.trigger('click')
  
  // Should be added to favorites in store
  expect(store.config.llm.favorites).toHaveLength(3)
  expect(store.config.llm.favorites[2].id).toBe('mock-chat2')
})

test('Removes from favorites', async () => {

  wrapper.vm.chat.engine = 'mock'
  wrapper.vm.chat.model = 'chat'
  await wrapper.vm.$nextTick()
  
  // Find buttons by name attribute
  const addButton = wrapper.find('[name="addToFavorites"]')
  const removeButton = wrapper.find('[name="removeFavorite"]')
  
  // Should have remove button but not add button
  expect(removeButton.exists()).toBe(true)
  expect(addButton.exists()).toBe(false)

  // Click the remove button
  await removeButton.trigger('click')

  // Should be removed from favorites in store
  expect(store.config.llm.favorites).toHaveLength(1)
})

test('handleManageDocRepo opens docrepo settings', async () => {
  // Open prompt menu first
  await wrapper.find('.prompt-menu').trigger('click')
  await wrapper.vm.$nextTick()

  // Call handleManageDocRepo
  wrapper.vm.handleManageDocRepo()

  // Should call IPC to open docrepo
  expect(window.api.docrepo.open).toHaveBeenCalled()
  // Should close the prompt menu
  expect(wrapper.vm.showPromptMenu).toBe(false)
})

test('handleManageExperts opens experts settings', async () => {
  // Open prompt menu first
  await wrapper.find('.prompt-menu').trigger('click')
  await wrapper.vm.$nextTick()

  // Call handleManageExperts
  wrapper.vm.handleManageExperts()

  // Should call IPC to open settings on experts tab
  expect(window.api.settings.open).toHaveBeenCalledWith({ initialTab: 'experts' })
  // Should close the prompt menu
  expect(wrapper.vm.showPromptMenu).toBe(false)
})

test('onNoEngineAvailable shows dialog and opens settings on confirm', async () => {
  // Mock Dialog.show to return confirmed
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false, value: undefined })

  // Call onNoEngineAvailable
  await wrapper.vm.onNoEngineAvailable()

  // Should show dialog
  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    title: expect.any(String),
    text: expect.any(String),
    showCancelButton: true
  }))

  // Should open settings on models tab
  expect(window.api.settings.open).toHaveBeenCalledWith({ initialTab: 'models' })
})

test('onNoEngineAvailable does not open settings when cancelled', async () => {
  // Mock Dialog.show to return cancelled
  vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true, value: undefined })

  vi.clearAllMocks()

  // Call onNoEngineAvailable
  await wrapper.vm.onNoEngineAvailable()

  // Should show dialog
  expect(Dialog.show).toHaveBeenCalled()

  // Should NOT open settings
  expect(window.api.settings.open).not.toHaveBeenCalled()
})

test('categoriesWithExperts filters and sorts categories', () => {
  const categories = wrapper.vm.categoriesWithExperts

  // Should be an array
  expect(Array.isArray(categories)).toBe(true)

  // Each category should have required properties
  categories.forEach((cat: any) => {
    expect(cat).toHaveProperty('id')
    expect(cat).toHaveProperty('name')
    expect(cat).toHaveProperty('icon')
  })

  // Should be sorted alphabetically by name
  for (let i = 1; i < categories.length; i++) {
    expect(categories[i].name.localeCompare(categories[i-1].name)).toBeGreaterThanOrEqual(0)
  }
})

test('expertsByCategory groups experts by category', () => {
  const grouped = wrapper.vm.expertsByCategory

  // Should be an object
  expect(typeof grouped).toBe('object')

  // Each group should be an array
  Object.values(grouped).forEach(group => {
    expect(Array.isArray(group)).toBe(true)
  })
})

test('uncategorizedExperts returns only experts without category', () => {
  const uncategorized = wrapper.vm.uncategorizedExperts

  // Should be an array
  expect(Array.isArray(uncategorized)).toBe(true)

  // None should have a categoryId
  uncategorized.forEach((exp: any) => {
    expect(exp.categoryId).toBeUndefined()
  })
})

test('startDictation initializes transcriber and audio recorder', async () => {
  // Call startDictation
  await wrapper.vm.startDictation()

  // Should initialize transcriber
  expect(wrapper.vm.transcriber.initialize).toHaveBeenCalled()

  // Should initialize audio recorder with config
  expect(wrapper.vm.audioRecorder.initialize).toHaveBeenCalledWith(expect.objectContaining({
    pcm16bitStreaming: expect.any(Boolean),
    listener: expect.objectContaining({
      onNoiseDetected: expect.any(Function),
      onAudioChunk: expect.any(Function),
      onSilenceDetected: expect.any(Function),
      onRecordingComplete: expect.any(Function)
    })
  }))
})

test('onDictate starts dictation when not dictating', async () => {
  // Ensure not dictating
  wrapper.vm.dictating = false

  // Clear previous calls
  vi.clearAllMocks()

  // Call onDictate
  await wrapper.vm.onDictate()

  // Should initialize transcriber (proof that startDictation was called)
  expect(wrapper.vm.transcriber.initialize).toHaveBeenCalled()

  // Should initialize audio recorder
  expect(wrapper.vm.audioRecorder.initialize).toHaveBeenCalled()
})

test('onDictate stops dictation when already dictating', async () => {
  // Set dictating to true
  wrapper.vm.dictating = true

  // Call onDictate
  await wrapper.vm.onDictate()

  // Should stop transcriber streaming
  expect(wrapper.vm.transcriber.endStreaming).toHaveBeenCalled()

  // Should stop audio recorder
  expect(wrapper.vm.audioRecorder.stop).toHaveBeenCalled()
})

test('onPaste ignores text clipboard items', async () => {
  const initialAttachmentsLength = wrapper.vm.attachments.length

  // Create paste event with text
  const textItem = {
    kind: 'string',
    getAsFile: vi.fn()
  }

  const event = {
    clipboardData: {
      items: [textItem]
    }
  } as any

  wrapper.vm.onPaste(event)
  await wrapper.vm.$nextTick()

  // Should not add any attachments
  expect(wrapper.vm.attachments).toHaveLength(initialAttachmentsLength)
})

test('onPaste processes image file from clipboard', async () => {
  const initialAttachmentsLength = wrapper.vm.attachments.length

  // Create a fake Blob
  const blob = new Blob(['fake image data'], { type: 'image/png' })

  const fileItem = {
    kind: 'file',
    getAsFile: vi.fn(() => blob)
  }

  const event = {
    clipboardData: {
      items: [fileItem]
    },
    preventDefault: vi.fn()
  } as any

  // Mock FileReader
  const mockFileReader = {
    readyState: FileReader.DONE,
    result: 'data:image/png;base64,ZmFrZV9pbWFnZV9kYXRh',
    onload: null as any,
    readAsDataURL: vi.fn(function(this: any) {
      // Simulate successful read
      setTimeout(() => {
        if (this.onload) {
          this.onload({
            target: {
              readyState: FileReader.DONE,
              result: this.result
            }
          })
        }
      }, 0)
    })
  }

  global.FileReader = vi.fn(() => mockFileReader) as any

  wrapper.vm.onPaste(event)

  // Wait for FileReader to complete
  await vi.waitFor(() => {
    expect(wrapper.vm.attachments.length).toBeGreaterThan(initialAttachmentsLength)
  }, { timeout: 1000 })

  // Should add attachment
  expect(wrapper.vm.attachments.length).toBeGreaterThan(initialAttachmentsLength)
  const attachment = wrapper.vm.attachments[wrapper.vm.attachments.length - 1]
  expect(attachment.url).toBe('clipboard://')
})

test('onPaste shows error for unsupported format', async () => {
  // Mock canProcessFormat to return false
  wrapper.vm.llmManager.canProcessFormat = vi.fn(() => false)

  const blob = new Blob(['fake data'], { type: 'application/unknown' })

  const fileItem = {
    kind: 'file',
    getAsFile: vi.fn(() => blob)
  }

  const event = {
    clipboardData: {
      items: [fileItem]
    },
    preventDefault: vi.fn()
  } as any

  // Mock FileReader
  const mockFileReader = {
    readyState: FileReader.DONE,
    result: 'data:application/unknown;base64,ZmFrZV9kYXRh',
    onload: null as any,
    readAsDataURL: vi.fn(function(this: any) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({
            target: {
              readyState: FileReader.DONE,
              result: this.result
            }
          })
        }
      }, 0)
    })
  }

  global.FileReader = vi.fn(() => mockFileReader) as any

  wrapper.vm.onPaste(event)

  // Wait for FileReader and processing
  await vi.waitFor(() => {
    expect(Dialog.alert).toHaveBeenCalled()
  }, { timeout: 1000 })

  // Should show error dialog
  expect(Dialog.alert).toHaveBeenCalled()
})

test('onDragOver prevents default and sets dropEffect', () => {
  // Enable attachments
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat, enableAttachments: true } })

  const event = {
    preventDefault: vi.fn(),
    dataTransfer: {
      dropEffect: ''
    }
  } as any

  wrapper.vm.onDragOver(event)

  expect(event.preventDefault).toHaveBeenCalled()
  expect(event.dataTransfer.dropEffect).toBe('copy')
})

test('onDragOver does nothing when attachments disabled', () => {
  // Disable attachments
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat, enableAttachments: false } })

  const event = {
    preventDefault: vi.fn(),
    dataTransfer: {
      dropEffect: ''
    }
  } as any

  wrapper.vm.onDragOver(event)

  expect(event.preventDefault).not.toHaveBeenCalled()
})

test('onDragEnter sets isDragOver to true', () => {
  // Enable attachments
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat, enableAttachments: true } })

  expect(wrapper.vm.isDragOver).toBe(false)

  const event = {
    preventDefault: vi.fn()
  } as any

  wrapper.vm.onDragEnter(event)

  expect(wrapper.vm.isDragOver).toBe(true)
  expect(event.preventDefault).toHaveBeenCalled()
})

test('onDragLeave sets isDragOver to false when leaving dropzone', () => {
  // Enable attachments
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat, enableAttachments: true } })
  wrapper.vm.isDragOver = true

  // Create a related target that is NOT a special div (add a child to make it not special)
  const relatedTarget = document.createElement('div')
  const child = document.createElement('span')
  relatedTarget.appendChild(child)

  const event = {
    preventDefault: vi.fn(),
    currentTarget: {
      contains: vi.fn(() => false)
    },
    relatedTarget: relatedTarget
  } as any

  wrapper.vm.onDragLeave(event)

  expect(wrapper.vm.isDragOver).toBe(false)
})

test('onDragLeave does nothing when entering child element', () => {
  // Enable attachments
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat, enableAttachments: true } })
  wrapper.vm.isDragOver = true

  const relatedTarget = document.createElement('div')

  const event = {
    preventDefault: vi.fn(),
    currentTarget: {
      contains: vi.fn(() => true) // Still within dropzone
    },
    relatedTarget: relatedTarget
  } as any

  wrapper.vm.onDragLeave(event)

  // Should still be true because we're still over the dropzone
  expect(wrapper.vm.isDragOver).toBe(true)
})

test('onDrop processes dropped image file', async () => {
  // Enable attachments
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat, enableAttachments: true } })
  wrapper.vm.isDragOver = true

  const initialAttachmentsLength = wrapper.vm.attachments.length

  // Create a fake file
  const file = new File(['fake image data'], 'test.png', { type: 'image/png' })

  const event = {
    preventDefault: vi.fn(),
    dataTransfer: {
      files: [file]
    }
  } as any

  // Mock FileReader
  const mockFileReader = {
    readyState: FileReader.DONE,
    result: 'data:image/png;base64,ZmFrZV9pbWFnZV9kYXRh',
    onload: null as any,
    onerror: null as any,
    readAsDataURL: vi.fn(function(this: any) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({
            target: {
              readyState: FileReader.DONE,
              result: this.result
            }
          })
        }
      }, 0)
    })
  }

  global.FileReader = vi.fn(() => mockFileReader) as any

  await wrapper.vm.onDrop(event)

  // Wait for FileReader to complete
  await vi.waitFor(() => {
    expect(wrapper.vm.attachments.length).toBeGreaterThan(initialAttachmentsLength)
  }, { timeout: 1000 })

  expect(event.preventDefault).toHaveBeenCalled()
  expect(wrapper.vm.isDragOver).toBe(false)
  expect(wrapper.vm.attachments.length).toBeGreaterThan(initialAttachmentsLength)
})

test('onDrop shows error for unsupported file format', async () => {
  // Enable attachments
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat, enableAttachments: true } })

  // Mock canProcessFormat to return false
  wrapper.vm.llmManager.canProcessFormat = vi.fn(() => false)

  const file = new File(['fake data'], 'test.xyz', { type: 'application/unknown' })

  const event = {
    preventDefault: vi.fn(),
    dataTransfer: {
      files: [file]
    }
  } as any

  await wrapper.vm.onDrop(event)
  await wrapper.vm.$nextTick()

  // Should show error dialog
  expect(Dialog.alert).toHaveBeenCalled()
})

test('onDrop does nothing when no files', async () => {
  // Enable attachments
  wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat, enableAttachments: true } })

  const initialAttachmentsLength = wrapper.vm.attachments.length

  const event = {
    preventDefault: vi.fn(),
    dataTransfer: {
      files: []
    }
  } as any

  await wrapper.vm.onDrop(event)
  await wrapper.vm.$nextTick()

  // Should not add any attachments
  expect(wrapper.vm.attachments).toHaveLength(initialAttachmentsLength)
})

test('onAttach adds supported file via file picker', async () => {
  // Mock canProcessFormat to return true
  wrapper.vm.llmManager.canProcessFormat = vi.fn(() => true)

  // Mock window.api.file.pickFile to return file paths
  vi.mocked(window.api.file.pickFile).mockReturnValue(['image1.png', 'image2.png'])

  const initialLength = wrapper.vm.attachments.length

  await wrapper.vm.onAttach()

  // Wait for attachments to be added
  await vi.waitFor(() => {
    expect(wrapper.vm.attachments.length).toBeGreaterThan(initialLength)
  }, { timeout: 1000 })

  // Should have called pickFile
  expect(window.api.file.pickFile).toHaveBeenCalledWith({ multiselection: true })

  // Should have read both files
  expect(window.api.file.read).toHaveBeenCalledWith('image1.png')
  expect(window.api.file.read).toHaveBeenCalledWith('image2.png')
})

test('onAttach shows error for unsupported file format', async () => {
  // Mock canProcessFormat to return false
  wrapper.vm.llmManager.canProcessFormat = vi.fn(() => false)

  // Mock window.api.file.pickFile to return a file
  vi.mocked(window.api.file.pickFile).mockReturnValue(['unsupported.xyz'])

  const initialLength = wrapper.vm.attachments.length

  await wrapper.vm.onAttach()
  await wrapper.vm.$nextTick()

  // Should not add attachment
  expect(wrapper.vm.attachments).toHaveLength(initialLength)

  // Should show error dialog
  expect(Dialog.alert).toHaveBeenCalled()
})
