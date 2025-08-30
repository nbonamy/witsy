
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { emitEventMock } from '../../vitest.setup'
import { stubTeleport } from '../mocks/stubs'
import { store } from '../../src/services/store'
import Prompt from '../../src/components/Prompt.vue'
import Chat from '../../src/models/chat'
import Attachment from '../../src/models/attachment'
import { getLlmLocale } from '../../src/services/i18n'

enableAutoUnmount(afterAll)

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

let wrapper: VueWrapper<any>
let chat: Chat|null = null

beforeAll(() => {
  useBrowserMock()
  useWindowMock()
  store.isFeatureEnabled = () => true
  store.loadSettings()
  store.loadExperts()
  store.loadCommands()
  store.config.llm.imageResize = 0
  store.config.engines.openai.models.chat.push(
    { id: 'gpt-4.1', name: 'gpt-4.1', capabilities: { tools: true, vision: true, reasoning: false, caching: false } },
  )
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

test('Send on click', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await wrapper.find('.icon.send').trigger('click')
  expect(wrapper.emitted<any[]>().prompt[0][0]).toEqual({
    prompt: 'this is my prompt',
    attachments: [],
    deepResearch: false,
  })
  expect(prompt.element.value).toBe('')
})

test('Sends on enter', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(wrapper.emitted<any[]>().prompt[0][0]).toEqual({
    prompt: 'this is my prompt',
    attachments: [],
    deepResearch: false,
  })
  expect(prompt.element.value).toBe('')
})

test('Sends with right parameters', async () => {
  wrapper.vm.attachments = [ new Attachment('image64', 'image/png', 'file://image.png') ]
  wrapper.vm.expert = store.experts[2]
  wrapper.vm.docrepo = 'docrepo'
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt2')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(wrapper.emitted<any[]>().prompt[0]).toEqual([{
    prompt: 'this is my prompt',
    attachments: [ { content: 'image64', mimeType: 'image/png', url: 'file://image.png', title: '', context: '', saved: false, extracted: false } ],
    expert: { id: 'uuid3', name: 'actor3', prompt: 'prompt3', type: 'user', state: 'enabled', triggerApps: [ { identifier: 'app' }] },
    docrepo: 'docrepo',
    deepResearch: false,
  }])
  expect(prompt.element.value).toBe('')
})

test('Not send on shift enter', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.enter.shift')
  expect(emitEventMock.mock.calls.filter(c => c[0] !== 'prompt-resize').length).toBe(0)
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
  await wrapper.find('.icon.stop').trigger('click')
  expect(wrapper.emitted<any[]>().stop).toBeTruthy()
})

test('Stores attachment', async () => {
  await wrapper.find('.prompt-menu').trigger('click')
  const menu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  await menu.find('.attachments').trigger('click')
  await wrapper.vm.$nextTick() // Wait for async operations
  expect(window.api.file.pickFile).toHaveBeenCalled()
  expect(window.api.file.pickFile).toHaveBeenLastCalledWith({
    multiselection: true,
    //filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }]
  })
  expect(wrapper.vm.attachments).toEqual([{
    mimeType: 'image/png',
    content: 'image1.png_encoded',
    saved: false,
    extracted: false,
    url: 'image1.png',
    title: '',
    context: '',
  }, {
    mimeType: 'image/png',
    content: 'image2.png_encoded',
    saved: false,
    extracted: false,
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
  await wrapper.find('.prompt-menu').trigger('click')
  const menu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  await menu.find('.experts').trigger('click')
  expect(menu.findAll('.filter-input').length).toBe(1)
  expect(menu.findAll('.item').length).toBe(3)
  // Management option is now in footer
  expect(menu.find('.footer .item').text()).toBe('prompt.menu.experts.manage')
  await menu.find('.item:nth-child(2)').trigger('click')
  expect(wrapper.vm.expert.id).toBe('uuid3')
  expect(wrapper.find('.prompt-feature').exists()).toBe(true)
})

test('Clears expert', async () => {
  wrapper.vm.expert = store.experts[0]
  await wrapper.vm.$nextTick()
  const feature = wrapper.findComponent({ name: 'PromptFeature' })
  expect(feature.exists()).toBe(true)
  await feature.find('.clear').trigger('click')
  expect(wrapper.vm.expert).toBeNull()
})

test('Stores command for later', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  await prompt.trigger('keydown', { key: '#' })
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.filter').length).toBe(1)
  expect(menu.findAll('.item').length).toBe(4)
  await menu.find('.item:nth-child(2)').trigger('click')
  expect(wrapper.vm.command.id).toBe('uuid2')
  expect(wrapper.find('.input .icon.command.left').exists()).toBe(true)
  prompt.setValue('this is my prompt')
  await prompt.trigger('keydown.Enter')
  expect(wrapper.emitted<any[]>().prompt[0][0]).toEqual({
    prompt: 'command_uuid2_template_this is my prompt',
    attachments: [],
    deepResearch: false,
  })
})

test('Selects command and run', async () => {
  const prompt = wrapper.find<HTMLInputElement>('.input textarea')
  expect(prompt.element.value).not.toBe('this is my prompt')
  await prompt.setValue('this is my prompt')
  const trigger = wrapper.find('.icon.command.right')
  await trigger.trigger('click')
  const menu = wrapper.find('.context-menu')
  expect(menu.exists()).toBe(true)
  expect(menu.findAll('.filter').length).toBe(1)
  expect(menu.findAll('.item').length).toBe(4)
  await menu.find('.item:nth-child(2)').trigger('click')
  expect(wrapper.emitted<any[]>().prompt[0][0]).toEqual({
    prompt: 'command_uuid2_template_this is my prompt',
    attachments: [],
    deepResearch: false,
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
  expect(menu.findAll('.item').length).toBe(3)
  expect(menu.find('.item:nth-child(1)').text()).toBe('docrepo1')
  expect(menu.find('.item:nth-child(2)').text()).toBe('docrepo2')
  // Management option is now in footer
  expect(menu.find('.footer .item').text()).toBe('prompt.menu.docRepos.manage')

  // connect
  await menu.find('.item:nth-child(1)').trigger('click')
  expect(window.api.docrepo.connect).toHaveBeenLastCalledWith('uuid1')

})

test('Tools', async () => {
  // Mount wrapper with enableTools enabled
  chat!.tools = []
  const toolsWrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat!, enableTools: true } })
  await toolsWrapper.find('.prompt-menu').trigger('click')
  const menu = toolsWrapper.findComponent({ name: 'PromptMenu' })

  // Simulate saving tools from PromptMenu
  await menu.vm.$emit('pluginToggle', 'plugin1')
  await menu.vm.$emit('serverToolToggle', {}, { uuid: 'tool1___server1' })
  await menu.vm.$emit('close')

  // Agent step should have updated tools
  expect(chat!.tools).toEqual(['plugin1', 'tool1___server1'])
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

test('PromptFeature component displays for active docrepo', async () => {
  wrapper.vm.docrepo = 'uuid1'
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
  wrapper.vm.docrepo = 'uuid1'
  wrapper.vm.instructions = { id: 'structured', label: 'Structured', instructions: 'test' }
  wrapper.vm.deepResearchActive = true
  await wrapper.vm.$nextTick()

  // Test clearExpert
  wrapper.vm.clearExpert()
  expect(wrapper.vm.expert).toBeNull()

  // Test clearDocRepo
  wrapper.vm.clearDocRepo()
  expect(wrapper.vm.docrepo).toBeNull()

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

test('matchDocRepo function works correctly', async () => {
  // Load docrepos first
  await wrapper.vm.loadDocRepos()
  
  // Test with null/undefined
  expect(wrapper.vm.matchDocRepo()).toBeUndefined()
  expect(wrapper.vm.matchDocRepo('')).toBeUndefined()
  
  // Test with valid docrepo ID
  expect(wrapper.vm.matchDocRepo('uuid1')).toBe('uuid1')
  
  // Test with invalid docrepo ID
  expect(wrapper.vm.matchDocRepo('invalid-uuid')).toBeUndefined()
})

test('getActiveDocRepoName function works correctly', async () => {
  // Load docrepos first
  await wrapper.vm.loadDocRepos()
  
  // Test with no active docrepo (returns fallback)
  wrapper.vm.docrepo = null
  expect(wrapper.vm.getActiveDocRepoName()).toBe('Knowledge Base')
  
  // Test with active docrepo
  wrapper.vm.docrepo = 'uuid1'
  expect(wrapper.vm.getActiveDocRepoName()).toBe('docrepo1')
  
  // Test with invalid docrepo (returns fallback)
  wrapper.vm.docrepo = 'invalid-uuid'
  expect(wrapper.vm.getActiveDocRepoName()).toBe('Knowledge Base')
})

test('Model menu button displays and opens menu', async () => {
  // Setup chat with engine and model
  if (chat) {
    chat.engine = 'mock'
    chat.model = 'chat'
    
    // Recreate wrapper with updated chat
    wrapper = mount(Prompt, { ...stubTeleport, props: { chat: chat } } )
    
    // Check model menu button exists
    const modelButton = wrapper.find('.model-menu-button')
    expect(modelButton.exists()).toBe(true)
    
    // Check it shows model name - should show fallback since mock doesn't return a model name
    expect(modelButton.text()).toContain('chat')
    
    // Click the button
    await modelButton.trigger('click')
    
    // Check that showModelMenu is true
    expect(wrapper.vm.showModelMenu).toBe(true)
  }
})
