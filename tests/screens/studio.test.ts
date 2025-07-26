
import { vi, beforeAll, beforeEach, expect, test, afterEach } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { createDialogMock } from '../mocks'
import { useWindowMock } from '../mocks/window'
import { stubTeleport } from '../mocks/stubs'
import { store, kMediaChatId } from '../../src/services/store'
import { Configuration } from '../../src/types/config'
import ImageCreator from '../../src/services/image'
import DesignStudio from '../../src/screens/DesignStudio.vue'
import defaultSettings from '../../defaults/settings.json'
import Attachment from '../../src/models/attachment'
import Message from '../../src/models/message'
import Chat from '../../src/models/chat'
import Dialog from '../../src/composables/dialog'

enableAutoUnmount(afterEach)

vi.mock('../../src/composables/dialog', async () => {
  return createDialogMock()
})

vi.mock('../../src/services/image', async (importOriginal) => {
  const mod: any = await importOriginal()
  mod.default.prototype.execute = vi.fn(async (engine: string, model: string, parameters: any) => {
    return { url: `file://${engine}/${model}/${parameters.prompt}` }
  })
  return mod
})

beforeAll(() => {
  
  useWindowMock({ dialogResponse: 1, modelDefaults: true })
  
  window.api.config.load = () => {
    const settings = defaultSettings as unknown as Configuration
    settings.studio.engines.image = 'openai'
    settings.engines.openai = {
      apiKey: 'openai',
      models: { chat: [], image: [
        { id: 'gpt-image-1', name: 'gpt-image-1' },
        { id: 'dall-e-3', name: 'dall-e-3' }
      ] }, model: { chat: '', image: 'gpt-image-1'}
    }
    settings.engines.google = {
      apiKey: 'google ',
      models: { chat: [], image: [
        { id: 'gemini-2', name: 'gemini-2' },
      ] }, model: { chat: '', image: 'gemini-2'}
    }
    settings.engines.huggingface = {
      apiKey: 'huggingface',
      models: { chat: [], image: [
        { id: 'huggingface1', name: 'huggingface1' },
        { id: 'huggingface2', name: 'huggingface2' }
      ] }, model: { chat: '', image: 'huggingface1' }
    }
    settings.engines.replicate = {
      apiKey: 'replicate',
      models: { chat: [], image: [
        { id: 'replicate1', name: 'replicate1' },
        { id: 'replicate2', name: 'replicate2' }
      ] }, model: { chat: '', image: 'replicate1', video: 'facehugging1'}
    }
    return settings
  }
  
  window.api.history.load = vi.fn(() => ({
    folders: [],
    chats: [
      Chat.fromJson({
        uuid: kMediaChatId,
        messages: [
          new Message('system', 'This is a system message.'),
          Message.fromJson({
            uuid: '1',
            role: 'user',
            type: 'text',
            createdAt: 1,
            content: 'prompt1',
            engine: 'openai',
            model: 'dall-e-3',
            attachment: new Attachment('', 'image/jpeg', 'file://url1.jpg')
          }),
          Message.fromJson({
            uuid: '2',
            role: 'user',
            type: 'image',
            createdAt: 2,
            content: 'prompt2',
            engine: 'replicate',
            model: 'replicate1',
            attachment: new Attachment('', 'image/jpeg', 'file://url2.jpg') // Updated to include .jpg
          })
        ]
      })      
    ],
    quickPrompts: []
  }))


})

beforeEach(() => {
  store.loadSettings()
  store.loadHistory()
})

test('Renders', async () => {
  const wrapper = mount(DesignStudio)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'Settings' }).exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'Settings' }).classes()).not.toContain('hidden')
  expect(wrapper.findComponent({ name: 'History' }).exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'History' }).classes()).toContain('hidden')
  expect(wrapper.findComponent({ name: 'Preview' }).exists()).toBe(true)
})

test('Settings', async () => {
  const wrapper = mount(DesignStudio)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await wrapper.vm.$nextTick()
  expect(settings.find<HTMLSelectElement>('[name=type]').element.value).toBe('image')
  expect(settings.find<HTMLSelectElement>('[name=engine]').element.value).toBe('openai')
  expect(settings.find<HTMLSelectElement>('[name=model]').element.value).toBe('gpt-image-1')
  expect(settings.find<HTMLTextAreaElement>('[name=prompt]').element.value).toBe('')
  expect(settings.find('.expander').exists()).toBe(true)
  expect(settings.find('.list-with-actions').exists()).toBe(false)

  await settings.find<HTMLSelectElement>('[name=engine]').setValue('replicate')
  expect(settings.find<HTMLInputElement>('[name=model]').element.value).toBe('replicate1')
  expect(settings.find('.expander').exists()).toBe(true)
  await settings.find('.expander').trigger('click')
  expect(settings.find('.list-with-actions').exists()).toBe(true)

  await settings.find<HTMLSelectElement>('[name=engine]').setValue('huggingface')
  expect(settings.find<HTMLSelectElement>('[name=model]').element.value).toBe('huggingface1')
  expect(settings.find('.expander').exists()).toBe(true)
  expect(settings.find('.list-with-actions').exists()).toBe(false)

  await settings.find<HTMLSelectElement>('[name=type]').setValue('video')
  expect(settings.find<HTMLSelectElement>('[name=engine]').element.value).toBe('replicate')
  expect(settings.find<HTMLSelectElement>('[name=model]').element.value).toBe('facehugging1')
  expect(settings.find('.expander').exists()).toBe(true)
})

test('Favorites', async () => {

  const wrapper = mount(DesignStudio)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await wrapper.vm.$nextTick()

  await settings.find<HTMLSelectElement>('[name=type]').setValue('image')
  await settings.find<HTMLSelectElement>('[name=engine]').setValue('openai')
  expect(settings.find<HTMLButtonElement>('[name=favorite]').exists()).toBe(false)

  await settings.find<HTMLSelectElement>('[name=engine]').setValue('replicate')
  expect(settings.find<HTMLButtonElement>('[name=favorite]').exists()).toBe(true)
  await settings.find<HTMLButtonElement>('[name=favorite]').trigger('click')
  expect(store.config.studio.favorites).toStrictEqual([ { engine: 'replicate', model: 'replicate1' } ])

  await settings.find<HTMLButtonElement>('[name=favorite]').trigger('click')
  expect(store.config.studio.favorites).toStrictEqual([])

})
  
test('History', async () => {

  const wrapper = mount(DesignStudio)
  await wrapper.find('.button-group button:nth-child(2)').trigger('click')
  expect(wrapper.findComponent({ name: 'Settings' }).classes()).toContain('hidden')
  const history = wrapper.findComponent({ name: 'History' })
  expect(history.classes()).not.toContain('hidden')
  expect(history.exists()).toBe(true)
  expect(history.findAll('.message').length).toBe(2)
  expect(history.find<HTMLElement>('.message:nth-child(1) .prompt').text()).toBe('prompt2')
  expect(history.find<HTMLImageElement>('.message:nth-child(1) img').element.src).toBe('file://url2.jpg/')
  expect(history.find<HTMLElement>('.message:nth-child(2) .prompt').text()).toBe('prompt1')
  expect(history.find<HTMLImageElement>('.message:nth-child(2) img').element.src).toBe('file://url1.jpg/') // Updated to include .jpg

  await history.find('.message:nth-child(1)').trigger('click')
  await history.vm.$nextTick()
  expect(history.emitted()['select-message']).toHaveLength(1)
  expect(history.emitted()['select-message'][0]).toStrictEqual([
    expect.objectContaining({ event: expect.any(Object), message: expect.objectContaining({ uuid: '2' }) })
  ])

  await history.find('.message:nth-child(2)').trigger('contextmenu')
  await history.vm.$nextTick()
  expect(history.emitted()['context-menu']).toHaveLength(1)
  expect(history.emitted()['context-menu'][0]).toStrictEqual([
    { event: expect.any(Object), message: expect.objectContaining({ uuid: '1' }) }
  ])
    
})

test('Generates - Basic', async () => {

  const wrapper: VueWrapper<any> = mount(DesignStudio)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await settings.find<HTMLSelectElement>('[name=type]').setValue('image')

  await settings.find<HTMLButtonElement>('[name=generate]').trigger('click')
  await wrapper.vm.$nextTick()
  expect(settings.emitted()['generate']).toBeUndefined()

  await settings.find<HTMLTextAreaElement>('[name=prompt]').setValue('prompt')
  await settings.find<HTMLButtonElement>('[name=generate]').trigger('click')
  await wrapper.vm.$nextTick()
  expect(settings.emitted()['generate']).toHaveLength(1)
  expect(settings.emitted()['generate'][0]).toStrictEqual([
    expect.objectContaining({
      action: 'create',
      mediaType: 'image',
      engine: 'openai',
      model: 'gpt-image-1',
      prompt: 'prompt',
      params: {}
    })
  ])

  expect(ImageCreator.prototype.execute).toHaveBeenLastCalledWith(
    'openai', 'gpt-image-1', { prompt: 'prompt' }, undefined
  )

  expect(wrapper.vm.selection).toHaveLength(1)
  expect(wrapper.vm.selection[0]).toMatchObject({
    role: 'user',
    content: 'prompt',
    attachments: [ expect.objectContaining({
      url: 'file://openai/gpt-image-1/prompt'
    }) ]
  })

  expect(wrapper.vm.undoStack).toHaveLength(0)
  expect(wrapper.vm.redoStack).toHaveLength(0)

  expect(store.history.chats[0].messages).toHaveLength(4)
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.selection[0])

})

test('Generates - Custom Params OpenAI', async () => {

  const wrapper: VueWrapper<any> = mount(DesignStudio)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await settings.find<HTMLSelectElement>('[name=type]').setValue('image')
  await settings.find<HTMLSelectElement>('[name=engine]').setValue('openai')
  await settings.find<HTMLSelectElement>('[name=model]').setValue('dall-e-3')
  await settings.find('.expander').trigger('click')

  expect(settings.find<HTMLSelectElement>('[name=custom-size]').exists()).toBe(true)
  expect(settings.find<HTMLSelectElement>('[name=custom-style]').exists()).toBe(true)
  expect(settings.find<HTMLSelectElement>('[name=custom-quality]').exists()).toBe(true)

  await settings.find<HTMLSelectElement>('[name=custom-quality]').setValue('hd')
  await settings.find<HTMLSelectElement>('[name=custom-style]').setValue('vivid')

  await settings.find<HTMLTextAreaElement>('[name=prompt]').setValue('prompt')
  await settings.find<HTMLButtonElement>('[name=generate]').trigger('click')
  await wrapper.vm.$nextTick()
  expect(settings.emitted()['generate']).toHaveLength(1)
  expect(settings.emitted()['generate'][0]).toStrictEqual([
    expect.objectContaining({
      action: 'create',
      mediaType: 'image',
      engine: 'openai',
      model: 'dall-e-3',
      prompt: 'prompt',
      params: { quality: 'hd', style: 'vivid' },
    })
  ])

  expect(ImageCreator.prototype.execute).toHaveBeenLastCalledWith(
    'openai', 'dall-e-3', { prompt: 'prompt', quality: 'hd', style: 'vivid' }, undefined
  )

  expect(wrapper.vm.selection).toHaveLength(1)
  expect(wrapper.vm.selection[0]).toMatchObject({
    role: 'user',
    content: 'prompt',
    attachments: [ expect.objectContaining({
      url: 'file://openai/dall-e-3/prompt'
    }) ],
    toolCalls: [ expect.objectContaining({ params: { quality: 'hd', style: 'vivid' } }) ]
  })

  expect(store.history.chats[0].messages).toHaveLength(4)
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.selection[0])

})

test('Generates - Custom Params HuggingFace', async () => {

  const wrapper: VueWrapper<any> = mount(DesignStudio)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await settings.find<HTMLSelectElement>('[name=type]').setValue('image')
  await settings.find<HTMLSelectElement>('[name=engine]').setValue('huggingface')
  await settings.find('.expander').trigger('click')

  expect(settings.find<HTMLTextAreaElement>('[name=custom-negative_prompt]').exists()).toBe(true)
  expect(settings.find<HTMLInputElement>('[name=custom-width]').exists()).toBe(true)
  expect(settings.find<HTMLInputElement>('[name=custom-height]').exists()).toBe(true)

  await settings.find<HTMLTextAreaElement>('[name=custom-negative_prompt]').setValue('no no no')
  await settings.find<HTMLSelectElement>('[name=custom-width]').setValue('1000')

  await settings.find<HTMLTextAreaElement>('[name=prompt]').setValue('prompt')
  await settings.find<HTMLButtonElement>('[name=generate]').trigger('click')
  await wrapper.vm.$nextTick()
  expect(settings.emitted()['generate']).toHaveLength(1)
  expect(settings.emitted()['generate'][0]).toStrictEqual([
    expect.objectContaining({
      action: 'create',
      mediaType: 'image',
      engine: 'huggingface',
      model: 'huggingface1',
      prompt: 'prompt',
      params: { negative_prompt: 'no no no', width: '1000' },
    }),
  ])

  expect(ImageCreator.prototype.execute).toHaveBeenLastCalledWith(
    'huggingface', 'huggingface1', { prompt: 'prompt', negative_prompt: 'no no no', width: 1000 }, undefined
  )

  expect(wrapper.vm.selection).toHaveLength(1)
  expect(wrapper.vm.selection[0]).toMatchObject({
    role: 'user',
    content: 'prompt',
    attachments: [ expect.objectContaining({
      url: 'file://huggingface/huggingface1/prompt'
    }) ],
    toolCalls: [ expect.objectContaining({ params: { negative_prompt: 'no no no', width: 1000 } }) ]
  })

  expect(store.history.chats[0].messages).toHaveLength(4)
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.selection[0])

})

test('Generates - User Params', async () => {

  const wrapper: VueWrapper<any> = mount(DesignStudio, { ...stubTeleport })
  const settings = wrapper.findComponent({ name: 'Settings' })
  await settings.find<HTMLSelectElement>('[name=type]').setValue('image')
  await settings.find<HTMLSelectElement>('[name=engine]').setValue('replicate')
  await settings.find('.expander').trigger('click')

  const table = settings.findComponent({ name: 'VariableTable' })
  await table.find<HTMLButtonElement>('.button.add').trigger('click')

  const editor = wrapper.findComponent({ name: 'VariableEditor' })
  await editor.find<HTMLSelectElement>('[name=key]').setValue('string')
  await editor.find<HTMLSelectElement>('[name=value]').setValue('value')
  await editor.find<HTMLButtonElement>('[name=save]').trigger('click')

  await editor.find<HTMLSelectElement>('[name=key]').setValue('number')
  await editor.find<HTMLSelectElement>('[name=value]').setValue('100')
  await editor.find<HTMLButtonElement>('[name=save]').trigger('click')

  await editor.find<HTMLSelectElement>('[name=key]').setValue('boolean')
  await editor.find<HTMLSelectElement>('[name=value]').setValue('true')
  await editor.find<HTMLButtonElement>('[name=save]').trigger('click')

  await settings.find<HTMLTextAreaElement>('[name=prompt]').setValue('prompt')
  await settings.find<HTMLButtonElement>('[name=generate]').trigger('click')
  await wrapper.vm.$nextTick()
  expect(settings.emitted()['generate']).toHaveLength(1)
  expect(settings.emitted()['generate'][0]).toStrictEqual([
    expect.objectContaining({
      action: 'create',
      mediaType: 'image',
      engine: 'replicate',
      model: 'replicate1',
      prompt: 'prompt',
      params: { string: 'value', number: '100', boolean: 'true' },
    }),
  ])

  expect(ImageCreator.prototype.execute).toHaveBeenLastCalledWith(
    'replicate', 'replicate1', { prompt: 'prompt', string: 'value', number: 100, boolean: true }, undefined
  )

  expect(wrapper.vm.selection).toHaveLength(1)
  expect(wrapper.vm.selection[0]).toMatchObject({
    role: 'user',
    content: 'prompt',
    attachments: [ expect.objectContaining({
      url: 'file://replicate/replicate1/prompt'
    }) ],
    toolCalls: [ expect.objectContaining({ params: { string: 'value', number: 100, boolean: true } }) ]
  })

  expect(store.history.chats[0].messages).toHaveLength(4)
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.selection[0])

})

test('Preview', async () => {

  const wrapper: VueWrapper<any> = mount(DesignStudio)
  wrapper.vm.selection = [store.history.chats[0].messages[1]]
  await wrapper.vm.$nextTick()

  // rendered
  const preview = wrapper.findComponent({ name: 'Preview' })
  expect(preview.exists()).toBe(true)
  expect(preview.find<HTMLImageElement>('img').element.src).toBe('file://url1.jpg/')

  // info
  await preview.find<HTMLElement>('.icon.info').trigger('click')
  expect(Dialog.show).toHaveBeenLastCalledWith(expect.objectContaining({
    title: 'prompt1',
    text: 'Engine: openai\nModel: dall-e-3',
  }))

  // fullscreen
  await preview.find<HTMLElement>('.icon.fullscreen').trigger('click')
  expect(preview.emitted()['fullscreen']).toHaveLength(1)

  // copy
  await preview.find<HTMLElement>('.icon.copy').trigger('click')
  expect(window.api.clipboard.writeImage).toHaveBeenLastCalledWith('file://url1.jpg')

  // save
  await preview.find<HTMLElement>('.icon.save').trigger('click')
  expect(window.api.file.download).toHaveBeenLastCalledWith({
    url: 'file://url1.jpg',
    properties: {
      prompt: true,
      directory: 'downloads',
      filename: 'image.jpg'
    }
  })

  // delete
  await preview.find<HTMLElement>('.icon.delete').trigger('click')
  expect(preview.emitted()['delete']).toHaveLength(1)

})

test('Upload', async () => {

  const wrapper: VueWrapper<any> = mount(DesignStudio)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await settings.find<HTMLSelectElement>('[name=type]').setValue('image')
  await settings.find<HTMLSelectElement>('[name=engine]').setValue('openai')
  await settings.find<HTMLButtonElement>('[name=upload]').trigger('click')
  expect(settings.emitted()['upload']).toHaveLength(1)
  expect(window.api.file.pickFile).toHaveBeenLastCalledWith({ filters: [
    { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
  ] })
  expect(window.api.file.save).toHaveBeenLastCalledWith({
    contents: 'image64',
    properties: {
      filename: expect.any(String),
      directory: 'userData',
      subdir: 'images',
      prompt: false
    }
  })
  expect(wrapper.vm.selection).toHaveLength(1)
  expect(wrapper.vm.selection[0]).toMatchObject({
    role: 'user',
    content: 'common.upload',
    engine: 'upload',
    model: 'image.png',
    attachments: [ expect.objectContaining({
      url: 'file://file_saved'
    }) ],
    toolCalls: []
  })
  expect(wrapper.vm.undoStack).toHaveLength(0)
  expect(wrapper.vm.redoStack).toHaveLength(0)


})

test('Edit', async () => {

  const wrapper: VueWrapper<any> = mount(DesignStudio)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await settings.find<HTMLSelectElement>('[name=type]').setValue('image')
  await settings.find<HTMLButtonElement>('[name=upload]').trigger('click')
  await settings.find<HTMLSelectElement>('[name=engine]').setValue('openai')
  await settings.find<HTMLInputElement>('[name=transform]').setValue(true)
  await settings.find<HTMLTextAreaElement>('[name=prompt]').setValue('prompt')
  await settings.find<HTMLButtonElement>('[name=generate]').trigger('click')
  expect(settings.emitted()['generate']).toHaveLength(1)
  expect(settings.emitted()['generate'][0]).toStrictEqual([
    expect.objectContaining({
      action: 'edit',
      mediaType: 'image',
      engine: 'openai',
      model: 'gpt-image-1',
      prompt: 'prompt',
      params: { },
    }),
  ])

  expect(window.api.file.delete).toHaveBeenLastCalledWith('file://file_saved')

  expect(wrapper.vm.selection).toHaveLength(1)
  expect(store.history.chats[0].messages).toHaveLength(4)
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.selection[0])

  expect(wrapper.vm.undoStack).toHaveLength(1)
  expect(wrapper.vm.redoStack).toHaveLength(0)

  expect(wrapper.vm.undoStack[0]).toMatchObject({
    role: 'user',
    content: 'common.upload',
    engine: 'upload',
    model: 'image.png',
    attachments: [ expect.objectContaining({
      url: 'file://file_saved',
      content: 'file://file_saved_encoded'
    }) ],
    toolCalls: []
  })

  expect(wrapper.vm.selection[0]).toMatchObject({
    role: 'user',
    content: 'common.upload / prompt',
    engine: 'openai',
    model: 'gpt-image-1',
    attachments: [ expect.objectContaining({
      url: 'file://openai/gpt-image-1/prompt'
    }) ],
    toolCalls: []
  })

})

test('Edit with preserve', async () => {

  const wrapper: VueWrapper<any> = mount(DesignStudio)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await settings.find<HTMLSelectElement>('[name=type]').setValue('image')
  await settings.find<HTMLButtonElement>('[name=upload]').trigger('click')
  await settings.find<HTMLSelectElement>('[name=engine]').setValue('openai')
  await settings.find<HTMLTextAreaElement>('[name=prompt]').setValue('prompt')
  await settings.find<HTMLInputElement>('[name=transform]').setValue(true)
  await settings.find<HTMLInputElement>('[name=preserve]').setValue(true)
  await settings.find<HTMLButtonElement>('[name=generate]').trigger('click')
  expect(settings.emitted()['generate']).toHaveLength(1)
  expect(settings.emitted()['generate'][0]).toStrictEqual([
    expect.objectContaining({
      action: 'transform',
      mediaType: 'image',
      engine: 'openai',
      model: 'gpt-image-1',
      prompt: 'prompt',
      params: { },
    }),
  ])

  expect(window.api.file.delete).toHaveBeenLastCalledWith('file://file_saved')

  expect(wrapper.vm.selection).toHaveLength(1)
  expect(store.history.chats[0].messages).toHaveLength(4)
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.selection[0])

  expect(wrapper.vm.undoStack).toHaveLength(0)
  expect(wrapper.vm.redoStack).toHaveLength(0)

  expect(wrapper.vm.selection[0]).toMatchObject({
    role: 'user',
    content: 'prompt',
    engine: 'openai',
    model: 'gpt-image-1',
    attachments: [ expect.objectContaining({
      url: 'file://openai/gpt-image-1/prompt'
    }) ],
    toolCalls: []
  })

})

test('Undo / Redo', async () => {

  const wrapper: VueWrapper<any> = mount(DesignStudio)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await settings.find<HTMLSelectElement>('[name=type]').setValue('image')
  await settings.find<HTMLButtonElement>('[name=upload]').trigger('click')
  await settings.find<HTMLSelectElement>('[name=engine]').setValue('openai')
  await settings.find<HTMLTextAreaElement>('[name=prompt]').setValue('prompt')
  await settings.find<HTMLInputElement>('[name=transform]').setValue(true)
  await settings.find<HTMLButtonElement>('[name=generate]').trigger('click')

  const preview = wrapper.findComponent({ name: 'Preview' })
  expect(preview.find('.icon.undo').exists()).toBe(true)
  expect(preview.find('.icon.redo').exists()).toBe(true)
  expect(preview.find('.icon.undo').classes()).not.toContain('disabled')
  expect(preview.find('.icon.redo').classes()).toContain('disabled')

  await preview.find<HTMLElement>('.icon.undo').trigger('click')

  expect(window.api.file.delete).toHaveBeenLastCalledWith('file://openai/gpt-image-1/prompt')

  expect(wrapper.vm.undoStack).toHaveLength(0)
  expect(wrapper.vm.redoStack).toHaveLength(1)

  expect(wrapper.vm.selection).toHaveLength(1)
  expect(store.history.chats[0].messages).toHaveLength(4)
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.selection[0])

  expect(wrapper.vm.selection[0]).toMatchObject({
    role: 'user',
    content: 'common.upload',
    engine: 'upload',
    model: 'image.png',
    attachments: [ expect.objectContaining({
      url: 'file://file_saved',
      content: '',
    }) ],
    toolCalls: []
  })

  expect(wrapper.vm.redoStack[0]).toMatchObject({
    role: 'user',
    content: 'common.upload / prompt',
    engine: 'openai',
    model: 'gpt-image-1',
    attachments: [ expect.objectContaining({
      url: 'file://openai/gpt-image-1/prompt',
      content: 'file://openai/gpt-image-1/prompt_encoded',
    }) ],
    toolCalls: []
  })

  expect(preview.find('.icon.undo').classes()).toContain('disabled')
  expect(preview.find('.icon.redo').classes()).not.toContain('disabled')

  await preview.find<HTMLElement>('.icon.redo').trigger('click')

  expect(window.api.file.delete).toHaveBeenLastCalledWith('file://file_saved')

  expect(wrapper.vm.undoStack).toHaveLength(1)
  expect(wrapper.vm.redoStack).toHaveLength(0)

  expect(wrapper.vm.selection).toHaveLength(1)
  expect(store.history.chats[0].messages).toHaveLength(4)
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.selection[0])

  expect(wrapper.vm.undoStack[0]).toMatchObject({
    role: 'user',
    content: 'common.upload',
    engine: 'upload',
    model: 'image.png',
    attachments: [ expect.objectContaining({
      url: 'file://file_saved',
      content: 'file://file_saved_encoded'
    }) ],
    toolCalls: []
  })

  expect(wrapper.vm.selection[0]).toMatchObject({
    role: 'user',
    content: 'common.upload / prompt',
    engine: 'openai',
    model: 'gpt-image-1',
    attachments: [ expect.objectContaining({
      url: 'file://file_saved'
    }) ],
    toolCalls: []
  })

})
