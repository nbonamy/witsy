
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../../../mocks/window'
import { store } from '../../../../src/renderer/services/store'
import { switchToTab, tabs } from './settings_utils'
import { ModelsList, loadOpenAIModels } from 'multi-llm-ts'
import { wait } from '../../../../src/main/utils'
import Settings from '../../../../src/renderer/screens/Settings.vue'

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
const pluginIndex = tabs.indexOf('settingsPlugins')

beforeAll(() => {
  useWindowMock()
  useBrowserMock()
  store.loadSettings()
  store.load = () => {}

  store.config.engines.huggingface.apiKey = 'hf-api-key'
  store.config.engines.replicate.apiKey = 'repl-api-key'
  store.config.engines.falai.apiKey = 'falai-api-key'
  store.config.plugins.search.tavilyApiKey = 'tavily-api-key'
  store.config.plugins.python.binpath = 'python3'
  store.config.plugins.filesystem = {
    enabled: false,
    allowedPaths: []
  }

  store.config.engines.replicate.models = {
    chat: [],
    image: [
      { id: 'repl-image1', name: 'repl-image1' },
      { id: 'repl-image2', name: 'repl-image2' },
    ],
    video: [
      { id: 'repl-video1', name: 'repl-video1' },
      { id: 'repl-video2', name: 'repl-video2' },
    ]
  }

  store.config.engines.falai.models = {
    chat: [],
    image: [
      { id: 'falai-image1', name: 'falai-image1' },
      { id: 'falai-image2', name: 'falai-image2' },
    ],
    video: [
      { id: 'falai-video1', name: 'falai-video1' },
      { id: 'falai-video2', name: 'falai-video2' },
    ]
  }

  store.config.engines.huggingface.models = {
    chat: [],
    image: [
      { id: 'hf1', name: 'hf1' },
      { id: 'hf2', name: 'hf2' },
    ]
  }
    
  // wrapper
  wrapper = mount(Settings)
})

beforeEach(async () => {
  vi.clearAllMocks()
})

test('should render', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  expect(tab.find('.master-detail').exists()).toBeTruthy()
})

test('image settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=image]').trigger('click')
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
  expect(store.config.plugins.image.engine).toBe('huggingface')
  expect(image.find<HTMLInputElement>('input[type=password]').element.value).toBe('hf-api-key')
  expect(image.findAll('select')[1].find('option').text()).toBe('hf1')
  await image.findAll('select')[1].setValue('hf2')
  expect(store.config.plugins.image.engine).toBe('huggingface')
  expect(store.config.plugins.image.model).toBe('hf2')

  // replicate
  await image.findAll('select')[0].setValue('replicate')
  expect(store.config.plugins.image.engine).toBe('replicate')
  expect(image.find<HTMLInputElement>('input[type=password]').element.value).toBe('repl-api-key')
  expect(image.findAll('select')[1].find('option').text()).toBe('repl-image1')
  await image.findAll('select')[1].setValue('repl-image2')
  expect(store.config.plugins.image.engine).toBe('replicate')
  expect(store.config.plugins.image.model).toBe('repl-image2')

  // falai
  await image.findAll('select')[0].setValue('falai')
  expect(store.config.plugins.image.engine).toBe('falai')
  expect(image.find<HTMLInputElement>('input[type=password]').element.value).toBe('falai-api-key')
  expect(image.findAll('select')[1].find('option').text()).toBe('falai-image1')
  await image.findAll('select')[1].setValue('falai-image2')
  expect(store.config.plugins.image.engine).toBe('falai')
  expect(store.config.plugins.image.model).toBe('falai-image2')

})

test('image settings reload', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=image]').trigger('click')
  const image = tab.findComponent({ name: 'SettingsImage' })
  expect(image.vm.model).toBe('falai-image2')
})

test('video settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=video]').trigger('click')
  const video = tab.findComponent({ name: 'SettingsVideo' })
  expect(video.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(video.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
  await video.find('input[type=checkbox]').setValue(false)
  expect(store.config.plugins.video.enabled).toBe(false)

  // replicate
  await video.findAll('select')[0].setValue('replicate')
  expect(store.config.plugins.video.engine).toBe('replicate')
  expect(video.find<HTMLInputElement>('input[type=password]').element.value).toBe('repl-api-key')
  expect(video.findAll('select')[1].find('option').text()).toBe('repl-video1')
  await video.findAll('select')[1].setValue('repl-video2')
  expect(store.config.plugins.video.engine).toBe('replicate')
  expect(store.config.plugins.video.model).toBe('repl-video2')

  // falai
  await video.findAll('select')[0].setValue('falai')
  expect(store.config.plugins.video.engine).toBe('falai')
  expect(video.find<HTMLInputElement>('input[type=password]').element.value).toBe('falai-api-key')
  expect(video.findAll('select')[1].find('option').text()).toBe('falai-video1')
  await video.findAll('select')[1].setValue('falai-video2')
  expect(store.config.plugins.video.engine).toBe('falai')
  expect(store.config.plugins.video.model).toBe('falai-video2')
})

test('video settings reload', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=video]').trigger('click')
  const video = tab.findComponent({ name: 'SettingsVideo' })
  expect(video.vm.model).toBe('falai-video2')
})

test('browse settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=browse').trigger('click')
  const browse = tab.findComponent({ name: 'SettingsBrowse' })
  expect(browse.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(browse.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
  await browse.find('input[type=checkbox]').setValue(false)
  expect(store.config.plugins.browse.enabled).toBe(false)
})

test('youtube settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=youtube]').trigger('click')
  const youtube = tab.findComponent({ name: 'SettingsYouTube' })
  expect(youtube.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(youtube.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
  await youtube.find('input[type=checkbox]').setValue(false)
  expect(store.config.plugins.youtube.enabled).toBe(false)
})

test('search settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=search]').trigger('click')
  const tavily = tab.findComponent({ name: 'SettingsSearch' })
  expect(tavily.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(tavily.find<HTMLInputElement>('input[name=enabled]').element.checked).toBe(false)
  await tavily.find<HTMLInputElement>('input[name=enabled]').setValue(true)
  expect(store.config.plugins.search.enabled).toBe(true)
  await tavily.find<HTMLSelectElement>('select[name=engine]').setValue('tavily')
  expect(tavily.find<HTMLInputElement>('input[type=password]').element.value).toBe('tavily-api-key')
})

test('memory settings', async () => {
  
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=memory]').trigger('click')
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
  expect(memory.findComponent({ name: 'MemoryInspector' }).exists()).toBeTruthy()

  // reset
  await memory.findAll('button')[1].trigger('click')
  expect(window.api.memory.reset).toHaveBeenCalled()
})

test('python settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=python]').trigger('click')
  const python = tab.findComponent({ name: 'SettingsPython' })

  // Test enable checkbox
  expect(python.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(python.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
  await python.find<HTMLInputElement>('input[type=checkbox]').setValue(true)
  expect(store.config.plugins.python.enabled).toBe(true)

  // Test runtime select dropdown (default is embedded)
  const runtimeSelect = python.find('select[name=runtime]')
  expect(runtimeSelect.exists()).toBeTruthy()
  const options = runtimeSelect.findAll('option')
  expect(options.length).toBe(2)
  expect(options[0].element.value).toBe('embedded')
  expect(options[1].element.value).toBe('native')
  expect(store.config.plugins.python.runtime).toBe('embedded')

  // Switch to native runtime to show binpath input
  await runtimeSelect.setValue('native')
  expect(store.config.plugins.python.runtime).toBe('native')
  await python.vm.$nextTick()

  // Now test binpath input (only visible when native is selected)
  expect(python.find<HTMLInputElement>('input[type=text]').element.value).toBe('python3')
  await python.findAll('button')[0].trigger('click')
  expect(window.api.file.find).toHaveBeenCalled()
  expect(python.find<HTMLInputElement>('input[type=text]').element.value).toBe('file.ext')
  expect(store.config.plugins.python.binpath).toBe('file.ext')
  await python.findAll('button')[1].trigger('click')
  expect(window.api.file.pickFile).toHaveBeenCalled()
  expect(python.find<HTMLInputElement>('input[type=text]').element.value).toBe('image.png')
  expect(store.config.plugins.python.binpath).toBe('image.png')
})

test('filesystem settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item[data-id=filesystem]').trigger('click')
  const filesystem = tab.findComponent({ name: 'SettingsFilesystem' })
  expect(filesystem.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(filesystem.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
  await filesystem.find<HTMLInputElement>('input[type=checkbox]').setValue(true)
  expect(store.config.plugins.filesystem.enabled).toBe(true)
  
  // Test allowed paths table
  expect(filesystem.find('.sticky-table-container table').exists()).toBeTruthy()
  expect(filesystem.find('.actions .button.add').exists()).toBeTruthy()
  expect(filesystem.find('.actions .button.remove').exists()).toBeTruthy()
  
  // Test remove button is initially disabled (no selection)
  expect(filesystem.find('.actions .button.remove').attributes('disabled')).toBeDefined()
})
