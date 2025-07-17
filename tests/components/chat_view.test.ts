
import { vi, beforeAll, beforeEach, expect, test, afterEach } from 'vitest'
import { VueWrapper, enableAutoUnmount, mount, flushPromises } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { setLlmDefaults } from '../mocks/llm'
import { store } from '../../src/services/store'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'
import Attachment from '../../src/models/attachment'
import ChatView from '../../src/screens/Chat.vue'
import ChatSidebar from '../../src/components/ChatSidebar.vue'
import ChatArea from '../../src/components/ChatArea.vue'
import Assistant from '../../src/services/assistant'
import Swal from 'sweetalert2/dist/sweetalert2.js'

import useEventBus  from '../../src/composables/event_bus'
const { emitEvent } = useEventBus()

enableAutoUnmount(afterEach)

vi.mock('../../src/services/i18n', async () => {
  return {
    t: (key: string) => `${key}`,
    commandI18n: vi.fn(() => {}),
    expertI18n: vi.fn(() => {}),
    i18nInstructions: (config: any, key: string) => `${key}`,
    allLanguages: [ { locale: 'en-US', label: 'English' }, { locale: 'fr-FR', label: 'French' } ],
  }
})

vi.mock('sweetalert2/dist/sweetalert2.js', async () => {
  const Swal = vi.fn()
  Swal['fire'] = vi.fn((args) => Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false, value: args.input === 'select' ? 'folder1' : 'user-input' }))
  return { default: Swal }
})

vi.mock('../../src/services/assistant', async () => {
  const Assistant = vi.fn()
  Assistant.prototype.setConfig = vi.fn()
  Assistant.prototype.setChat = vi.fn((chat) => {
    Assistant.prototype.chat = chat
  })
  Assistant.prototype.initChat = vi.fn(() => {
    Assistant.prototype.chat = new Chat()
    return Assistant.prototype.chat
  })
  Assistant.prototype.initLlm = vi.fn()
  Assistant.prototype.hasLlm = vi.fn(() => true)
  Assistant.prototype.prompt = vi.fn()
  Assistant.prototype.stop = vi.fn()
  return { default: Assistant }
})

beforeAll(() => {
  
  useWindowMock({ modelDefaults: true })
  useBrowserMock()

  window.api.history.load = () => ({
    folders: [
      { id: 'folder1', name: 'Folder', chats: [] },
      { id: 'folder2', name: 'Folder', chats: [], defaults: {
        engine: 'mock',
        model: 'chat',
        disableStreaming: true,
        tools: [ 'tool1' ],
        locale: 'en',
        instructions: 'instructions',
        docrepo: 'docrepo',
        expert: 'uuid1',
        modelOpts: {
          temperature: 0.7,
          customOpts: {
            'custom': 'custom'
          }
        }
      } },
    ], chats: [
      Chat.fromJson({
        uuid: 'chat',
        title: 'title',
        docrepo: 'docrepo',
        engine: 'openai',
        model: 'gpt-4.1',
        messages: [
          new Message('system', 'instructions'),
          new Message('user', 'prompt1'),
          new Message('assistant', 'response1'),
          Message.fromJson({ role: 'user', content: 'prompt2', expert: { id: 'expert' }, attachment: { content: 'attachment', url: 'url', saved: true } }),
          new Message('assistant', 'response2'),  
        ]
      })
    ], quickPrompts: ['prompt']
  })

})

beforeEach(() => {
  vi.clearAllMocks()
  store.load()
})

test('Renders correctly', () => {
  const wrapper = mount(ChatView)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.chat').exists()).toBe(true)
  expect(wrapper.findComponent(ChatSidebar).exists()).toBe(true)
  expect(wrapper.findComponent(ChatArea).exists()).toBe(true)
})

test('Resets assistant', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)

  // load witb defaults
  setLlmDefaults('mock', 'chat')
  emitEvent('new-chat', null)
  expect(Assistant.prototype.initChat).toHaveBeenLastCalledWith()
  expect(wrapper.vm.assistant.chat.title).toBeNull()
  expect(wrapper.vm.assistant.chat.engine).toBe('mock')
  expect(wrapper.vm.assistant.chat.model).toBe('chat')
  expect(wrapper.vm.assistant.chat.tools).toStrictEqual([])
  expect(wrapper.vm.assistant.chat.modelOpts).toEqual({
    contextWindowSize: 512,
    maxTokens: 150,
    temperature: 0.7,
    top_k: 10,
    top_p: 0.5,
    reasoning: true
  })

  // load witbout defaults
  setLlmDefaults('openai', 'gpt-4.1-mini')
  emitEvent('new-chat', null)
  expect(Assistant.prototype.initChat).toHaveBeenLastCalledWith()
  expect(wrapper.vm.assistant.chat.title).toBeNull()
  expect(wrapper.vm.assistant.chat.engine).toBe('openai')
  expect(wrapper.vm.assistant.chat.model).toBe('gpt-4.1-mini')
  expect(wrapper.vm.assistant.chat.tools).toBeNull()
  expect(wrapper.vm.assistant.chat.modelOpts).toBeUndefined()
})

test('Saves text attachment', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  const attachment = new Attachment('text', 'text/plain', 'file://text', false)
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt', attachments: [attachment] })
  expect(window.api.file.save).toHaveBeenLastCalledWith({ contents: 'text_decoded_encoded', properties: expect.any(Object) })
  expect(attachment.url).toBe('file://file_saved')
  expect(attachment.saved).toBe(true)
})

test('Saves pdf attachment', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  const attachment = new Attachment('pdf', 'text/pdf', 'file://pdf', false)
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt', attachments: [attachment] })
  expect(window.api.file.save).toHaveBeenLastCalledWith({ contents: 'pdf_extracted_encoded', properties: expect.any(Object) })
  expect(attachment.url).toBe('file://file_saved')
  expect(attachment.saved).toBe(true)
})

test('Saves image attachment', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  const attachment = new Attachment('image', 'image/png', 'file://image', false)
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt', attachments: [attachment] })
  expect(window.api.file.save).toHaveBeenLastCalledWith({ contents: 'image', properties: expect.any(Object) })
  expect(attachment.url).toBe('file://file_saved')
  expect(attachment.saved).toBe(true)
})

test('Does not save twice', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  const attachment = new Attachment('text', 'text/plain', 'file://text', true)
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt', attachments: [attachment] })
  expect(window.api.file.save).not.toHaveBeenCalled()
  expect(attachment.url).toBe('file://text')
  expect(attachment.saved).toBe(true)
})

test('Sends prompt', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt' })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenLastCalledWith('prompt', {
    model: 'gpt-4.1', instructions: null, attachments: [], docrepo: null, expert: null, deepResearch: false,
  }, expect.any(Function), expect.any(Function))
})

test('Sends prompt with instructions', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt', instructions: 'instructions' })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenLastCalledWith('prompt', {
    model: 'gpt-4.1', instructions: 'instructions', attachments: [], docrepo: null, expert: null, deepResearch: false,
  }, expect.any(Function), expect.any(Function))
})

test('Sends prompt with attachment', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt', attachments: ['file'] })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenLastCalledWith('prompt', {
    model: 'gpt-4.1', instructions: null, attachments: ['file'], docrepo: null, expert: null, deepResearch: false,
  }, expect.any(Function), expect.any(Function))
})

test('Sends prompt with doc repo', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt', docrepo: 'docrepo' })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenLastCalledWith('prompt', {
    model: 'gpt-4.1', instructions: null, attachments: [], docrepo: 'docrepo', expert: null, deepResearch: false,
  }, expect.any(Function), expect.any(Function))
})

test('Sends prompt with expert', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt', expert: { id: 'expert', prompt: 'system' } })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenLastCalledWith('prompt', {
    model: 'gpt-4.1', instructions: null, attachments: [], docrepo: null, expert: { id: 'expert', prompt: 'system' }, deepResearch: false,
  }, expect.any(Function), expect.any(Function))
})

test('Stop assistant', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  await wrapper.vm.chatArea.$emit('stop', null)
  expect(Assistant.prototype.stop).toHaveBeenCalled()
})

test('New chat in folder without defaults', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  setLlmDefaults('mock', 'chat')
  emitEvent('new-chat-in-folder', 'folder1')
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[1].title).toBeTruthy()
  expect(store.history.chats[1].engine).toBeTruthy()
  expect(store.history.chats[1].model).toBeTruthy()
  expect(store.history.folders[0].chats).toHaveLength(1)
  expect(store.history.folders[0].chats[0]).toBe(store.history.chats[1].uuid)
  expect(wrapper.vm.assistant.chat.uuid).toBe(store.history.chats[1].uuid)
  expect(wrapper.vm.assistant.chat.modelOpts).not.toBeUndefined()
})

test('New chat in folder with defaults', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  setLlmDefaults('mock', 'chat')
  emitEvent('new-chat-in-folder', 'folder2')
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[1].title).toBeTruthy()
  expect(store.history.chats[1].engine).toBe('mock')
  expect(store.history.chats[1].model).toBe('chat')
  expect(store.history.folders[1].chats).toHaveLength(1)
  expect(store.history.folders[1].chats[0]).toBe(store.history.chats[1].uuid)
  expect(wrapper.vm.assistant.chat.uuid).toBe(store.history.chats[1].uuid)
  expect(wrapper.vm.assistant.chat.disableStreaming).toBe(true)
  expect(wrapper.vm.assistant.chat.tools).toStrictEqual(['tool1'])
  expect(wrapper.vm.assistant.chat.locale).toBe('en')
  expect(wrapper.vm.assistant.chat.instructions).toBe('instructions')
  expect(wrapper.vm.assistant.chat.docrepo).toBe('docrepo')
  expect(wrapper.vm.assistant.chat.modelOpts).toStrictEqual({
    temperature: 0.7,
    customOpts: {
      'custom': 'custom'
    }
  })
})

test('Rename chat', async () => {
  mount(ChatView)
  emitEvent('rename-chat', store.history.chats[0])
  expect(Swal.fire).toHaveBeenLastCalledWith(expect.objectContaining({
    title: 'main.chat.rename',
    showCancelButton: true,
    input: 'text',
    inputValue: 'title',
  }))
  await flushPromises()
  expect(store.history.chats[0].title).toBe('user-input')
})

test('Move chat', async () => {
  expect(store.history.folders[0].chats).not.toHaveLength(1)
  mount(ChatView)
  emitEvent('move-chat', 'chat')
  expect(Swal.fire).toHaveBeenLastCalledWith(expect.objectContaining({
    title: 'main.chat.moveToFolder',
    showCancelButton: true,
    input: 'select',
    inputValue: 'root',
    inputOptions: {
      root: 'Unsorted',
      folder1: 'Folder',
      folder2: 'Folder',
    }
  }))
  await flushPromises()
  expect(store.history.folders[0].chats).toHaveLength(1)
})

test('Delete chat', async () => {
  mount(ChatView)
  emitEvent('delete-chat', 'chat')
  expect(window.api.showDialog).toHaveBeenLastCalledWith(expect.objectContaining({
    message: 'main.chat.confirmDeleteSingle',
    detail: 'common.confirmation.cannotUndo',
  }))
  await flushPromises()
  expect(store.history.chats).toHaveLength(0) 
})

test('Rename folder', async () => {
  mount(ChatView)
  emitEvent('rename-folder', 'folder1')
  expect(Swal.fire).toHaveBeenLastCalledWith(expect.objectContaining({
    title: 'main.folder.rename',
    showCancelButton: true,
    input: 'text',
    inputValue: 'Folder',
  }))
  await flushPromises()
  expect(store.history.folders[0].name).toBe('user-input')
})

test('Delete folder', async () => {
  mount(ChatView)
  emitEvent('delete-folder', 'folder1')
  expect(window.api.showDialog).toHaveBeenLastCalledWith(expect.objectContaining({
    message: 'main.folder.confirmDelete',
    detail: 'common.confirmation.cannotUndo',
  }))
  await flushPromises()
  expect(store.history.folders).toHaveLength(1)
})

test('Select chat', async () => {
  store.config.llm.engine = 'mock'
  const wrapper: VueWrapper<any> = mount(ChatView)
  emitEvent('select-chat', store.history.chats[0])
  expect(Assistant.prototype.setChat).toHaveBeenLastCalledWith(store.history.chats[0])
  expect(wrapper.vm.assistant.chat.tools).toBeNull()
  expect(wrapper.vm.assistant.chat.modelOpts).toBeUndefined()
  await wrapper.vm.chatArea.$emit('prompt', { prompt: 'prompt' })
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(wrapper.vm.assistant.chat.engine).toBe('openai')
  expect(Assistant.prototype.prompt).toHaveBeenLastCalledWith('prompt', {
    model: 'gpt-4.1', attachments: [], docrepo: null, expert: null, deepResearch: false,
  }, expect.any(Function), expect.any(Function))
})

test('Fork Chat on Assistant Message', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  emitEvent('select-chat', store.history.chats[0])
  wrapper.vm.forkChat(store.history.chats[0], store.history.chats[0].messages[2], 'title2', 'engine2', 'model2')
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[1].title).toBe('title2')
  expect(store.history.chats[1].engine).toBe('engine2')
  expect(store.history.chats[1].model).toBe('model2')
  expect(store.history.chats[1].messages).toHaveLength(3)
  expect(Assistant.prototype.initLlm).not.toHaveBeenCalled()
  expect(Assistant.prototype.prompt).not.toHaveBeenCalled()
})

test('Fork Chat on User Message', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  expect(store.history.chats).toHaveLength(1)
  emitEvent('select-chat', store.history.chats[0])
  expect(store.history.chats).toHaveLength(1)
  wrapper.vm.forkChat(store.history.chats[0], store.history.chats[0].messages[3], 'title2', 'engine2', 'model2')
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[1].title).toBe('title2')
  expect(store.history.chats[1].engine).toBe('engine2')
  expect(store.history.chats[1].model).toBe('model2')
  expect(store.history.chats[1].messages).toHaveLength(3)
  expect(Assistant.prototype.initLlm).toHaveBeenCalled()
  expect(Assistant.prototype.prompt).toHaveBeenLastCalledWith('prompt2', {
    model: 'model2',
    attachments: [ expect.objectContaining({
      content: 'attachment',
    }) ],
    docrepo: 'docrepo',
    expert: expect.objectContaining({ id: 'expert'}),
    deepResearch: false,
  }, expect.any(Function), expect.any(Function))
})

test('Delete Message', async () => {
  const wrapper: VueWrapper<any> = mount(ChatView)
  emitEvent('select-chat', store.history.chats[0])
  const chat = wrapper.vm.assistant.chat
  expect(chat.messages).toHaveLength(5)
  await wrapper.vm.onDeleteMessage(chat.messages[3])
  expect(chat.messages).toHaveLength(3)
  expect(window.api.file.delete).toHaveBeenCalledTimes(1)
  expect(window.api.file.delete).toHaveBeenLastCalledWith('url')
  await wrapper.vm.onDeleteMessage(chat.messages[1])
  expect(chat.messages).toHaveLength(1)
  expect(window.api.file.delete).toHaveBeenCalledTimes(1)
})
