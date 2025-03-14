
import { vi, beforeAll, expect, test, afterEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store, mediaChatId } from '../../src/services/store'
import { Configuration } from '../../src/types/config'
import ImageCreator from '../../src/services/image'
import CreateMedia from '../../src/screens/CreateMedia.vue'
import defaultSettings from '../../defaults/settings.json'
import Attachment from '../../src/models/attachment'
import Message from '../../src/models/message'
import Chat from '../../src/models/chat'

enableAutoUnmount(afterEach)

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
    settings.create.model = 'dall-e-2'
    settings.engines.openai = {
      apiKey: 'openai',
      // @ts-expect-error mock
      models: { image: [
        { id: 'dall-e-2', name: 'dall-e-2' },
        { id: 'dall-e-3', name: 'dall-e-3' }
      ] }
    }
    settings.engines.huggingface = {
      apiKey: 'huggingface',
      // @ts-expect-error mock
      models: { image: [
        { id: 'huggingface1', name: 'huggingface1' },
        { id: 'huggingface2', name: 'huggingface2' }
      ] }
    }
    settings.engines.replicate = {
      apiKey: 'replicate',
      // @ts-expect-error mock
      models: { image: [
        { id: 'replicate1', name: 'replicate1' },
        { id: 'replicate2', name: 'replicate2' }
      ] }
    }
    return settings
  }
  
  window.api.history.load = vi.fn(() => ({
    folders: [],
    chats: [
      Chat.fromJson({
        uuid: mediaChatId,
        messages: [
          new Message('system', 'This is a system message.'),
          Message.fromJson({
            uuid: '1',
            role: 'user',
            type: 'text',
            createdAt: 1,
            content: 'prompt1',
            engine: 'openai',
            model: 'dall-e-2',
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
    ]
  }))

  // @ts-expect-error mock
  Element.prototype.showModal = vi.fn()

})

test('Renders', async () => {
  const wrapper = mount(CreateMedia)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'Settings' }).exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'Settings' }).classes()).not.toContain('hidden')
  expect(wrapper.findComponent({ name: 'History' }).exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'History' }).classes()).toContain('hidden')
  expect(wrapper.findComponent({ name: 'Preview' }).exists()).toBe(true)
})

test('Settings', async () => {
  const wrapper = mount(CreateMedia)
  const settings = wrapper.findComponent({ name: 'Settings' })
  await wrapper.vm.$nextTick()
  expect(settings.find<HTMLSelectElement>('[name=type]').element.value).toBe('image')
  expect(settings.find<HTMLSelectElement>('[name=engine]').element.value).toBe('openai')
  expect(settings.find<HTMLSelectElement>('[name=model]').element.value).toBe('dall-e-2')
  expect(settings.find<HTMLTextAreaElement>('[name=prompt]').element.value).toBe('')
  expect(settings.find('.expander').exists()).toBe(true)
  expect(settings.find('.list-with-actions').exists()).toBe(false)

  await settings.find<HTMLSelectElement>('[name=engine]').setValue('replicate')
  expect(settings.find('.expander').exists()).toBe(true)
  await settings.find('.expander').trigger('click')
  expect(settings.find('.list-with-actions').exists()).toBe(true)

  await settings.find<HTMLSelectElement>('[name=engine]').setValue('huggingface')
  expect(settings.find('.expander').exists()).toBe(true)
  expect(settings.find('.list-with-actions').exists()).toBe(false)

  await settings.find<HTMLSelectElement>('[name=type]').setValue('video')
  expect(settings.find<HTMLSelectElement>('[name=engine]').element.value).toBe('replicate')
  expect(settings.find('.expander').exists()).toBe(true)
})
  
test('History', async () => {

  const wrapper = mount(CreateMedia)
  await wrapper.find('.actions > *').trigger('click')
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
    expect.objectContaining({ uuid: '2' })
  ])

  await history.find('.message:nth-child(2)').trigger('contextmenu')
  await history.vm.$nextTick()
  expect(history.emitted()['context-menu']).toHaveLength(1)
  expect(history.emitted()['context-menu'][0]).toStrictEqual([
    { event: expect.any(Object), message: expect.objectContaining({ uuid: '1' }) }
  ])
    
})

test('Generates - Basic', async () => {

  const wrapper = mount(CreateMedia)
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
      mediaType: 'image',
      engine: 'openai',
      model: 'dall-e-2',
      prompt: 'prompt',
      params: {}
    })
  ])

  expect(ImageCreator.prototype.execute).toHaveBeenLastCalledWith(
    'openai', 'dall-e-2', { prompt: 'prompt' }
  )

  // @ts-expect-error mock
  expect (wrapper.vm.message).toMatchObject({
    role: 'user',
    content: 'prompt',
    attachment: expect.objectContaining({
      url: 'file://openai/dall-e-2/prompt'
    })
  })

  expect(store.history.chats[0].messages).toHaveLength(4)
  // @ts-expect-error mock
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.message)

})

test('Generates - Custom Params OpenAI', async () => {

  const wrapper = mount(CreateMedia)
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
      mediaType: 'image',
      engine: 'openai',
      model: 'dall-e-3',
      prompt: 'prompt',
      params: { quality: 'hd', style: 'vivid' },
    })
  ])

  expect(ImageCreator.prototype.execute).toHaveBeenLastCalledWith(
    'openai', 'dall-e-3', { prompt: 'prompt', quality: 'hd', style: 'vivid' }
  )

  // @ts-expect-error mock
  expect (wrapper.vm.message).toMatchObject({
    role: 'user',
    content: 'prompt',
    attachment: expect.objectContaining({
      url: 'file://openai/dall-e-3/prompt'
    }),
    toolCall: {
      status: expect.any(String),
      calls: [ expect.objectContaining({ params: { quality: 'hd', style: 'vivid' } }) ]
    }
  })

  expect(store.history.chats[0].messages).toHaveLength(4)
  // @ts-expect-error mock
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.message)

})

test('Generates - Custom Params HuggingFace', async () => {

  const wrapper = mount(CreateMedia)
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
      mediaType: 'image',
      engine: 'huggingface',
      model: 'black-forest-labs/FLUX.1-dev',
      prompt: 'prompt',
      params: { negative_prompt: 'no no no', width: '1000' },
    })
  ])

  expect(ImageCreator.prototype.execute).toHaveBeenLastCalledWith(
    'huggingface', 'black-forest-labs/FLUX.1-dev', { prompt: 'prompt', negative_prompt: 'no no no', width: 1000 }
  )

  // @ts-expect-error mock
  expect (wrapper.vm.message).toMatchObject({
    role: 'user',
    content: 'prompt',
    attachment: expect.objectContaining({
      url: 'file://huggingface/black-forest-labs/FLUX.1-dev/prompt'
    }),
    toolCall: {
      status: expect.any(String),
      calls: [ expect.objectContaining({ params: { negative_prompt: 'no no no', width: 1000 } }) ]
    }
  })

  expect(store.history.chats[0].messages).toHaveLength(4)
  // @ts-expect-error mock
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.message)

})

test('Generates - User Params', async () => {

  const wrapper = mount(CreateMedia)
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
      mediaType: 'image',
      engine: 'replicate',
      model: 'black-forest-labs/flux-1.1-pro',
      prompt: 'prompt',
      params: { string: 'value', number: '100', boolean: 'true' },
    })
  ])

  expect(ImageCreator.prototype.execute).toHaveBeenLastCalledWith(
    'replicate', 'black-forest-labs/flux-1.1-pro', { prompt: 'prompt', string: 'value', number: 100, boolean: true }
  )

  // @ts-expect-error mock
  expect (wrapper.vm.message).toMatchObject({
    role: 'user',
    content: 'prompt',
    attachment: expect.objectContaining({
      url: 'file://replicate/black-forest-labs/flux-1.1-pro/prompt'
    }),
    toolCall: {
      status: expect.any(String),
      calls: [ expect.objectContaining({ params: { string: 'value', number: 100, boolean: true } }) ]
    }
  })

  expect(store.history.chats[0].messages).toHaveLength(4)
  // @ts-expect-error mock
  expect(store.history.chats[0].messages[3]).toMatchObject(wrapper.vm.message)

})

test('Preview', async () => {

  const wrapper = mount(CreateMedia)
  // @ts-expect-error mock
  wrapper.vm.message = store.history.chats[0].messages[1]
  await wrapper.vm.$nextTick()

  // rendered
  const preview = wrapper.findComponent({ name: 'Preview' })
  expect(preview.exists()).toBe(true)
  expect(preview.find<HTMLImageElement>('img').element.src).toBe('file://url1.jpg/')

  // info
  await preview.find<HTMLElement>('.action.info').trigger('click')
  expect(window.api.showDialog).toHaveBeenLastCalledWith(expect.objectContaining({
    message: 'prompt1',
    detail: 'Engine: openai\nModel: dall-e-2',
  }))

  // fullscreen
  await preview.find<HTMLElement>('.action.fullscreen').trigger('click')
  expect(preview.emitted()['fullscreen']).toHaveLength(1)

  // copy
  await preview.find<HTMLElement>('.action.copy').trigger('click')
  expect(window.api.clipboard.writeImage).toHaveBeenLastCalledWith('file://url1.jpg')

  // save
  await preview.find<HTMLElement>('.action.save').trigger('click')
  expect(window.api.file.download).toHaveBeenLastCalledWith({
    url: 'file://url1.jpg',
    properties: {
      prompt: true,
      directory: 'downloads',
      filename: 'image.jpg'
    }
  })

  // delete
  await preview.find<HTMLElement>('.action.delete').trigger('click')
  expect(preview.emitted()['delete']).toHaveLength(1)

})

