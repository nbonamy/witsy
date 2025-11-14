
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../../../mocks/window'
import { stubTeleport } from '../../../mocks/stubs'
import { store } from '../../../../src/renderer/services/store'
import { switchToTab, tabs } from './settings_utils'
import Settings from '../../../../src/renderer/screens/Settings.vue'
import { ModelsList, loadAzureModels, loadOpenAIModels } from 'multi-llm-ts'
import { CustomEngineConfig } from '../../../../src/types/config'

vi.mock('multi-llm-ts', async (importOriginal) => {
  const mod: any = await importOriginal()
  return {
    ...mod,
    loadAzureModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
    loadOpenAIModels: vi.fn((): ModelsList => ({ chat: [], image: [] })),
  }
})

let wrapper: VueWrapper<any>
const llmIndex = tabs.indexOf('settingsModels')

beforeAll(() => {
  useWindowMock({ customEngine: true })
  useBrowserMock()
  store.loadSettings()
  store.load = () => {}
  store.isFeatureEnabled = (feature: string) => feature !== 'workspaces'
    
  // wrapper
  wrapper = mount(Settings, { ...stubTeleport })
})

beforeEach(async () => {
  vi.clearAllMocks()
})

test('should render', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  expect(tab.findAll('.master-detail .md-master-list .md-master-list-item').length).toBe(16)
})

test('custom settings openai', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item:nth-child(15)').trigger('click')
  await tab.vm.$nextTick()
  const custom = tab.findComponent({ name: 'SettingsCustomLLM' })
  expect(custom.exists()).toBe(true)
  expect(custom.find<HTMLInputElement>('input[name=label]').element.value).toBe('custom_openai')
  expect(custom.find<HTMLSelectElement>('select[name=api]').element.value).toBe('openai')
  expect(custom.find<HTMLSelectElement>('select[name=api]').element.disabled).toBe(true)
  expect(custom.find<HTMLInputElement>('input[name=apiKey]').element.value).toBe('456')
  expect(custom.find<HTMLInputElement>('input[name=baseURL]').element.value).toBe('http://localhost/api/v1')
  expect(custom.find<HTMLInputElement>('input[name=deployment]').exists()).toBe(false)
  expect(custom.find<HTMLInputElement>('input[name=apiVersion]').exists()).toBe(false)
  expect(custom.find<HTMLInputElement>('input[name=models]').exists()).toBe(true)
  await custom.find('input[name=apiKey]').setValue('api-key')
  await custom.find('input[name=apiKey]').trigger('blur')
  expect(store.config.engines.custom1.apiKey).toBe('api-key')
  await custom.find('button[name=refresh]').trigger('click')
  expect(loadOpenAIModels).toHaveBeenLastCalledWith({
    baseURL: 'http://localhost/api/v1',
    apiKey: 'api-key',
    models: { chat: [], image: [] },
  })
  expect(store.config.engines.custom1.disableTools).toBeFalsy()
  await custom.find('[name=disableTools]').setValue(true)
  expect(store.config.engines.custom1.disableTools).toBeTruthy()
})

test('custom settings azure', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item:nth-child(16)').trigger('click')
  await tab.vm.$nextTick()
  const custom = tab.findComponent({ name: 'SettingsCustomLLM' })
  expect(custom.exists()).toBe(true)
  expect(custom.find<HTMLInputElement>('input[name=label]').element.value).toBe('custom_azure')
  expect(custom.find<HTMLSelectElement>('select[name=api]').element.value).toBe('azure')
  expect(custom.find<HTMLSelectElement>('select[name=api]').element.disabled).toBe(true)
  expect(custom.find<HTMLInputElement>('input[name=apiKey]').element.value).toBe('789')
  expect(custom.find<HTMLInputElement>('input[name=baseURL]').element.value).toBe('http://witsy.azure.com/')
  expect(custom.find<HTMLInputElement>('input[name=deployment]').element.value).toBe('witsy_deployment')
  expect(custom.find<HTMLInputElement>('input[name=apiVersion]').element.value).toBe('2024-04-03')
  expect(custom.find<HTMLInputElement>('input[name=models]').exists()).toBe(false)
  expect(custom.find<HTMLButtonElement>('button[name=refresh]').exists()).toBe(false)
  await custom.find('input[name=apiKey]').setValue('api-key')
  await custom.find('input[name=apiKey]').trigger('blur')
  expect(store.config.engines.custom2.apiKey).toBe('api-key')
  expect(loadAzureModels).toHaveBeenLastCalledWith({
    baseURL: 'http://witsy.azure.com/',
    apiKey: 'api-key',
    deployment: 'witsy_deployment',
    apiVersion: '2024-04-03',
  })
  await custom.find('[name=disableTools]').setValue(true)
  expect(store.config.engines.custom2.disableTools).toBeTruthy()
})

test('delete custom engine', async () => {
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item:nth-child(16)').trigger('click')
  await tab.vm.$nextTick()
  await tab.find<HTMLButtonElement>('.icon.delete').trigger('click')
  expect(store.config.engines.custom1).toBeDefined()
  expect(store.config.engines.custom2).toBeUndefined()
})

test('create custom engine openai', async () => {
  const enginesCount = Object.keys(store.config.engines).length
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find<HTMLButtonElement>('.logo.create').trigger('click')
  const create = tab.findComponent({ name: 'CreateEngine' })
  expect(create.exists()).toBe(true)
  expect(create.find<HTMLInputElement>('input[name=label]').element.value).toBe('')
  expect(create.find<HTMLSelectElement>('select[name=api]').element.value).toBe('openai')
  expect(create.find<HTMLInputElement>('input[name=baseURL]').element.value).toBe('')
  expect(create.find<HTMLInputElement>('input[name=apiKey]').element.value).toBe('')
  expect(create.find<HTMLInputElement>('input[name=label]').element.value).toBe('')
  expect(create.find<HTMLInputElement>('input[name=label]').element.value).toBe('')
  expect(create.find<HTMLInputElement>('input[name=deployment]').exists()).toBe(false)
  expect(create.find<HTMLInputElement>('input[name=apiVersion]').exists()).toBe(false)
  await create.find('input[name=label]').setValue('custom_openai2')
  await create.find('input[name=baseURL]').setValue('http://localhost/api/v2')
  await create.find('input[name=apiKey]').setValue('012')
  await create.find('button[name=save]').trigger('click')
  expect(Object.keys(store.config.engines)).toHaveLength(enginesCount + 1)
  const engineId = Object.keys(store.config.engines).pop()
  expect((store.config.engines[engineId!] as CustomEngineConfig).label).toBe('custom_openai2')
  expect((store.config.engines[engineId!] as CustomEngineConfig).api).toBe('openai')
  expect((store.config.engines[engineId!] as CustomEngineConfig).baseURL).toBe('http://localhost/api/v2')
  expect((store.config.engines[engineId!] as CustomEngineConfig).apiKey).toBe('012')
  expect((store.config.engines[engineId!] as CustomEngineConfig).models).toEqual({ chat: [], image: [] })
})

test('create custom engine azure', async () => {
  const enginesCount = Object.keys(store.config.engines).length
  const tab = await switchToTab(wrapper, llmIndex)
  await tab.find<HTMLButtonElement>('.logo.create').trigger('click')
  const create = tab.findComponent({ name: 'CreateEngine' })
  expect(create.exists()).toBe(true)
  await create.find<HTMLSelectElement>('select[name=api]').setValue('azure')
  expect(create.find<HTMLInputElement>('input[name=deployment]').exists()).toBe(true)
  expect(create.find<HTMLInputElement>('input[name=apiVersion]').exists()).toBe(true)
  await create.find('input[name=label]').setValue('custom_azure2')
  await create.find('input[name=baseURL]').setValue('https://witsy2.azure.com/')
  await create.find('input[name=apiKey]').setValue('345')
  await create.find('input[name=deployment]').setValue('deployment')
  await create.find('input[name=apiVersion]').setValue('2025-04-03')
  await create.find('button[name=save]').trigger('click')
  expect(Object.keys(store.config.engines)).toHaveLength(enginesCount + 1)
  const engineId = Object.keys(store.config.engines).pop()
  expect((store.config.engines[engineId!] as CustomEngineConfig).label).toBe('custom_azure2')
  expect((store.config.engines[engineId!] as CustomEngineConfig).api).toBe('azure')
  expect((store.config.engines[engineId!] as CustomEngineConfig).baseURL).toBe('https://witsy2.azure.com/')
  expect((store.config.engines[engineId!] as CustomEngineConfig).apiKey).toBe('345')
  expect((store.config.engines[engineId!] as CustomEngineConfig).deployment).toBe('deployment')
  expect((store.config.engines[engineId!] as CustomEngineConfig).apiVersion).toBe('2025-04-03')
  expect(store.config.engines[engineId!].models).toEqual({ chat: [], image: [] })
})
