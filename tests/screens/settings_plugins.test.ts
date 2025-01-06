
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
let wrapper: VueWrapper<any>
const pluginIndex = 6

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
    
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

  // openai
  expect(image.findAll('select')[0].element.value).toBe('openai')
  expect(image.find('input[type=text]').exists()).toBeFalsy()
  await image.find('button').trigger('click')
  await wait(750)
  expect(loadOpenAIModels).toHaveBeenCalled()

  // huggingface
  await image.findAll('select')[0].setValue('huggingface')
  expect(image.find('input[type=text]').exists()).toBeTruthy()
  expect(image.findAll('select')[1].find('option').text()).toBe('black-forest-labs/FLUX.1-dev')

  // replicate
  await image.findAll('select')[0].setValue('replicate')
  expect(image.find('input[type=text]').exists()).toBeTruthy()
  expect(image.findAll('select')[1].find('option').text()).toBe('black-forest-labs/flux-1.1-pro')
})

test('video settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(2)').trigger('click')
  const video = tab.findComponent({ name: 'SettingsVideo' })
  expect(video.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(video.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
})

test('browse settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(3)').trigger('click')
  const browse = tab.findComponent({ name: 'SettingsBrowse' })
  expect(browse.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(browse.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
})

test('youtube settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(4)').trigger('click')
  const youtube = tab.findComponent({ name: 'SettingsYouTube' })
  expect(youtube.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(youtube.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(true)
})

test('tavily settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(5)').trigger('click')
  const tavily = tab.findComponent({ name: 'SettingsTavily' })
  expect(tavily.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(tavily.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
})

test('memory settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(6)').trigger('click')
  const memory = tab.findComponent({ name: 'SettingsMemory' })
  expect(memory.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(memory.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
})

test('python settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(7)').trigger('click')
  const python = tab.findComponent({ name: 'SettingsPython' })
  expect(python.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(python.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
})

test('nestor settings', async () => {
  const tab = await switchToTab(wrapper, pluginIndex)
  await tab.find('.list-panel .list .item:nth-child(8)').trigger('click')
  const nestor = tab.findComponent({ name: 'SettingsNestor' })
  expect(nestor.find('input[type=checkbox]').exists()).toBeTruthy()
  expect(nestor.find<HTMLInputElement>('input[type=checkbox]').element.checked).toBe(false)
})
