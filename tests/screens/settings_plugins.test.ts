
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { switchToTab } from './settings_utils'
import Settings from '../../src/screens/Settings.vue'
import { ModelsList, loadOpenAIModels } from 'multi-llm-ts'
import { wait } from '../../src/main/utils'

vi.mock('multi-llm-ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    loadOpenAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
  }
})

HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()

let wrapper: VueWrapper<any>
const pluginIndex = 6

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  store.config.engines.huggingface.apiKey = 'hf-api-key'
  store.config.engines.replicate.apiKey = 'repl-api-key'
  store.config.plugins.tavily.apiKey = 'tavily-api-key'
  store.config.plugins.python.binpath = 'python3'
    
  // wrapper
  document.body.innerHTML = `<dialog id="settings"></dialog>`
  wrapper = mount(Settings, { attachTo: '#settings' })
})

beforeEach(async () => {
  vi.clearAllMocks()
})

test('should render', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  expect(tab.find('.list-panel').exists()).toBeTruthy()
  expect(tab.findComponent({ name: 'SettingsImage' }).exists()).toBeTruthy()
})

test('image settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(1)').trigger('click')
  const image = tab.findComponent({ name: 'SettingsImage' })
  expect(image.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(image.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
  await image.find('input[type=checkbox]').setValue(false)
  expect(store.config.plugins.image.enabled).toBe(false)

  // openai
  expect(image.findAll('select')[0].element.value).toBe('openai')
  expect(image.find('input[type=text]').exists()).toBeFalsy()
  await image.find('button').trigger('click')
  await wait(750)
  expect(loadOpenAIModels).toHaveBeenCalled()

  // huggingface
  await image.findAll('select')[0].setValue('huggingface')
  expect(image.find<HTMLInputElement>('input[type=password]').element.value).toBe('hf-api-key')
  expect(image.findAll('select')[1].find('option').text()).toBe('black-forest-labs/FLUX.1-dev')
  const hfoption2 = image.findAll('select')[1].findAll('option')[1]
  await image.findAll('select')[1].setValue(hfoption2.element.value)
  expect(store.config.engines.huggingface.model.image).toBe(hfoption2.element.value)

  // replicate
  await image.findAll('select')[0].setValue('replicate')
  expect(image.find<HTMLInputElement>('input[type=password]').element.value).toBe('repl-api-key')
  expect(image.findAll('select')[1].find('option').text()).toBe('black-forest-labs/flux-1.1-pro')
  const reploption2 = image.findAll('select')[1].findAll('option')[1]
  await image.findAll('select')[1].setValue(reploption2.element.value)
  expect(store.config.engines.replicate.model.image).toBe(reploption2.element.value)
})

test('video settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(2)').trigger('click')
  const video = tab.findComponent({ name: 'SettingsVideo' })
  expect(video.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(video.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
  await video.find('input[type=checkbox]').trigger('click')
  expect(store.config.plugins.video.enabled).toBe(false)

  // replicate
  await video.findAll('select')[0].setValue('replicate')
  expect(video.find<HTMLInputElement>('input[type=password]').element.value).toBe('repl-api-key')
  expect(video.findAll('select')[1].find('option').text()).toBe(store.config.engines.replicate.model.video)
  const reploption2 = video.findAll('select')[1].findAll('option')[1]
  await video.findAll('select')[1].setValue(reploption2.element.value)
  expect(store.config.engines.replicate.model.video).toBe(reploption2.element.value)
})

test('browse settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(3)').trigger('click')
  const browse = tab.findComponent({ name: 'SettingsBrowse' })
  expect(browse.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(browse.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
  await browse.find('input[type=checkbox]').setValue(false)
  expect(store.config.plugins.browse.enabled).toBe(false)
})

test('youtube settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(4)').trigger('click')
  const youtube = tab.findComponent({ name: 'SettingsYouTube' })
  expect(youtube.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(youtube.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
  await youtube.find('input[type=checkbox]').setValue(false)
  expect(store.config.plugins.youtube.enabled).toBe(false)
})

test('tavily settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(5)').trigger('click')
  const tavily = tab.findComponent({ name: 'SettingsTavily' })
  expect(tavily.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(tavily.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
  await tavily.find<HTMLInputElement>('input[type=checkbox]').setValue(true)
  expect(store.config.plugins.tavily.enabled).toBe(true)
  expect(tavily.find<HTMLInputElement>('input[type=password]').element.value).toBe('tavily-api-key')
})

test('memory settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(6)').trigger('click')
  const memory = tab.findComponent({ name: 'SettingsMemory' })
  expect(memory.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(memory.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
  await memory.find<HTMLInputElement>('input[type=checkbox]').setValue(true)
  expect(store.config.plugins.memory.enabled).toBe(true)

  // openai
  expect(memory.findAll('select')[0].element.value).toBe('openai')
  expect(memory.find('input[type=text]').exists()).toBeFalsy()

  // view
  await memory.findAll('button')[0].trigger('click')
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()

  // reset
  await memory.findAll('button')[1].trigger('click')
  expect(window.api.memory.reset).toHaveBeenCalled()
})

test('python settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(7)').trigger('click')
  const python = tab.findComponent({ name: 'SettingsPython' })
  expect(python.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(python.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
  await python.find<HTMLInputElement>('input[type=checkbox]').setValue(true)
  expect(store.config.plugins.python.enabled).toBe(true)
  expect(python.find<HTMLInputElement>('input[type=text]').element.value).toBe('python3')
  await python.findAll('button')[0].trigger('click')
  expect(window.api.file.pick).toHaveBeenCalled()
  expect(python.find<HTMLInputElement>('input[type=text]').element.value).toBe('image.png')
  expect(store.config.plugins.python.binpath).toBe('image.png')
  await python.findAll('button')[1].trigger('click')
  expect(window.api.file.find).toHaveBeenCalled()
  expect(python.find<HTMLInputElement>('input[type=text]').element.value).toBe('file.ext')
  expect(store.config.plugins.python.binpath).toBe('file.ext')
})

test('nestor settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(8)').trigger('click')
  const nestor = tab.findComponent({ name: 'SettingsNestor' })
  expect(nestor.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(nestor.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
  await nestor.find<HTMLInputElement>('input[type=checkbox]').setValue(true)
  expect(store.config.plugins.nestor.enabled).toBe(true)
})