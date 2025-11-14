
import { vi, beforeAll, expect, test, beforeEach, afterAll } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../../../mocks/window'
import { store } from '../../../../src/renderer/services/store'
import OllamaModelPull from '../../../../src/renderer/components/OllamaModelPull.vue'
import Combobox from '../../../../src/renderer/components/Combobox.vue'
import { Ollama } from 'multi-llm-ts'
import { EngineConfig } from '../../../../src/types/config'

enableAutoUnmount(afterAll)

let wrapper: VueWrapper<any>

const progressGenerator = vi.fn(async function* (): AsyncGenerator<any> {
  for (let i = 0; i <= 100; i += 10) {
    yield {
      completed: i,
      total: 100,
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
})

vi.mock('multi-llm-ts', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, any>
  const Ollama = vi.fn()
  Ollama.prototype.pullModel = vi.fn(async () => {
    const generator = progressGenerator()
    return {
      [Symbol.asyncIterator]: () => generator,
      abort: vi.fn(),
      return: vi.fn(),
      throw: vi.fn(),
      next: () => generator.next(),
    }
  })
  Ollama.prototype.getModels = vi.fn()
  Ollama.prototype.stop = vi.fn()
  return { ...actual, Ollama }
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  store.config.engines.ollama = { models: { chat: [] } } as unknown as EngineConfig
})

beforeEach(() => {
  wrapper = mount(OllamaModelPull, {
    props: {
      pullableModels: [
        { id: 'model1', name: 'Model 1' },
      ]
    }
  })
})

test('Create', async () => {
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.findComponent(Combobox).exists()).toBe(true)
  expect(wrapper.find('button[name=pull]').exists()).toBe(true)
  expect(wrapper.find('button[name=stop]').exists()).toBe(false)
  expect(wrapper.find('div.progrsss').exists()).toBe(false)
  expect(wrapper.findAll<HTMLOptionElement>('select option').length).toBe(1) 
})

test('Pull', async () => {
  await wrapper.find<HTMLInputElement>('input[name=pull_model]').setValue('model1')
  await wrapper.find('button[name=pull]').trigger('click')
  expect(Ollama.prototype.pullModel).toHaveBeenCalledWith('model1')
  await vi.waitUntil(() => wrapper.emitted('done') !== undefined)
  expect(wrapper.emitted()).toHaveProperty('done')
  expect(progressGenerator).toHaveBeenCalledTimes(1)
})

test('Stop', async () => {
  await wrapper.find<HTMLInputElement>('input[name=pull_model]').setValue('model1')
  await wrapper.find('button[name=pull]').trigger('click')
  await wrapper.vm.$nextTick()
  await wrapper.find('button[name=stop]').trigger('click')
  expect(Ollama.prototype.stop).toHaveBeenCalled()
})