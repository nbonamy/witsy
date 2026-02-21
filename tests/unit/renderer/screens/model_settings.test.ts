
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '@tests/mocks/index'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import ModelSettings from '@screens/ModelSettings.vue'
import Chat from '@models/chat'
import { defaultCapabilities } from 'multi-llm-ts'
import { nextTick } from 'vue'
import { ModelDefaults } from '@/types/config'

enableAutoUnmount(afterAll)

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  store.config.engines.mock = {
    label: 'mock',
    models: { chat: [{ id: 'chat', name: 'chat', capabilities: defaultCapabilities.capabilities }], image: [] },
    model: { chat: 'chat', image: '' }
  }
  store.config.engines.openai = {
    label: 'openai',
    models: { chat: [{ id: 'gpt-4', name: 'gpt-4', capabilities: defaultCapabilities.capabilities }], image: [] },
    model: { chat: 'gpt-4', image: '' }
  }
})

let chat: Chat
beforeEach(() => {
  vi.clearAllMocks()
  store.config.llm.defaults = []
  chat = new Chat('Test Chat')
  chat.setEngineModel('mock', 'chat')
})

const mountSettings = async (c?: Chat) => {
  const wrapper: VueWrapper<any> = mount(ModelSettings, {
    props: { chat: c ?? chat }
  })
  await nextTick()
  return wrapper
}

// rendering

test('Renders all form elements', async () => {
  const wrapper = await mountSettings()
  expect(wrapper.find('.model-settings').exists()).toBe(true)
  expect(wrapper.find('.header .title').exists()).toBe(true)
  expect(wrapper.find('.close').exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'EngineModelSelect' }).exists()).toBe(true)
  expect(wrapper.find('textarea[name="instructions"]').exists()).toBe(true)
  expect(wrapper.find('select[name="plugins"]').exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'LangSelect' }).exists()).toBe(true)
  expect(wrapper.find('button[name="load"]').exists()).toBe(true)
  expect(wrapper.find('button[name="save"]').exists()).toBe(true)
  expect(wrapper.find('button[name="clear"]').exists()).toBe(true)
})

test('Does not show advanced settings by default', async () => {
  const wrapper = await mountSettings()
  expect(wrapper.find('select[name="streaming"]').exists()).toBe(false)
  expect(wrapper.findComponent({ name: 'ModelAdvancedSettings' }).exists()).toBe(false)
})

test('Toggles advanced settings on click', async () => {
  const wrapper = await mountSettings()
  await wrapper.find('.toggle').trigger('click')
  await nextTick()
  expect(wrapper.find('select[name="streaming"]').exists()).toBe(true)
  expect(wrapper.findComponent({ name: 'ModelAdvancedSettings' }).exists()).toBe(true)
  await wrapper.find('.toggle').trigger('click')
  await nextTick()
  expect(wrapper.find('select[name="streaming"]').exists()).toBe(false)
})

test('Does not show create ollama model button for non-ollama engines', async () => {
  const wrapper = await mountSettings()
  expect(wrapper.find('button[name="create"]').exists()).toBe(false)
})

test('Close button emits close event', async () => {
  const wrapper = await mountSettings()
  await wrapper.find('.close').trigger('click')
  expect(wrapper.emitted('close')).toHaveLength(1)
})

// initialization from chat

test('Loads engine and model from chat', async () => {
  const wrapper = await mountSettings()
  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  expect(engineModelSelect.props('engine')).toBe('mock')
  expect(engineModelSelect.props('model')).toBe('chat')
})

test('Loads instructions from chat', async () => {
  chat.instructions = 'Custom prompt'
  const wrapper = await mountSettings()
  expect(wrapper.find('textarea[name="instructions"]').element.value).toBe('Custom prompt')
})

test('Loads empty instructions when chat has none', async () => {
  const wrapper = await mountSettings()
  expect(wrapper.find('textarea[name="instructions"]').element.value).toBe('')
})

test('Loads streaming setting from chat', async () => {
  chat.disableStreaming = true
  const wrapper = await mountSettings()
  await wrapper.find('.toggle').trigger('click')
  await nextTick()
  expect(wrapper.find('select[name="streaming"]').element.value).toBe('true')
})

test('Loads tools setting from chat', async () => {
  chat.tools = []
  const wrapper = await mountSettings()
  expect(wrapper.find('select[name="plugins"]').element.value).toBe('true')
})

// model change

test('Model change updates chat engine and model', async () => {
  const wrapper = await mountSettings()
  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'gpt-4')
  await nextTick()
  expect(chat.engine).toBe('openai')
  expect(chat.model).toBe('gpt-4')
})

test('Model change preserves instructions when new model has no defaults', async () => {
  chat.instructions = 'My custom system prompt'
  const wrapper = await mountSettings()
  expect(wrapper.find('textarea[name="instructions"]').element.value).toBe('My custom system prompt')

  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'gpt-4')
  await nextTick()

  expect(wrapper.find('textarea[name="instructions"]').element.value).toBe('My custom system prompt')
  expect(chat.instructions).toBe('My custom system prompt')
})

test('Model change applies instructions from defaults when they exist', async () => {
  store.config.llm.defaults = [{
    engine: 'openai',
    model: 'gpt-4',
    disableStreaming: false,
    instructions: 'Default instructions for GPT-4',
  } as ModelDefaults]

  chat.instructions = 'My custom system prompt'
  const wrapper = await mountSettings()

  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'gpt-4')
  await nextTick()

  expect(wrapper.find('textarea[name="instructions"]').element.value).toBe('Default instructions for GPT-4')
  expect(chat.instructions).toBe('Default instructions for GPT-4')
})

test('Model change preserves instructions when defaults exist but have no instructions', async () => {
  store.config.llm.defaults = [{
    engine: 'openai',
    model: 'gpt-4',
    disableStreaming: true,
  } as ModelDefaults]

  chat.instructions = 'My custom system prompt'
  const wrapper = await mountSettings()

  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'gpt-4')
  await nextTick()

  expect(wrapper.find('textarea[name="instructions"]').element.value).toBe('My custom system prompt')
  expect(chat.instructions).toBe('My custom system prompt')
})

test('Model change applies streaming setting from defaults', async () => {
  store.config.llm.defaults = [{
    engine: 'openai',
    model: 'gpt-4',
    disableStreaming: true,
  } as ModelDefaults]

  const wrapper = await mountSettings()
  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'gpt-4')
  await nextTick()

  expect(chat.disableStreaming).toBe(true)
})

test('Model change applies tools setting from defaults', async () => {
  store.config.llm.defaults = [{
    engine: 'openai',
    model: 'gpt-4',
    disableStreaming: false,
    tools: ['tool1', 'tool2'],
  } as ModelDefaults]

  const wrapper = await mountSettings()
  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'gpt-4')
  await nextTick()

  expect(chat.tools).toEqual(['tool1', 'tool2'])
})

test('Model change resets streaming when no defaults', async () => {
  chat.disableStreaming = true
  const wrapper = await mountSettings()

  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'gpt-4')
  await nextTick()

  expect(chat.disableStreaming).toBe(false)
})

test('Model change preserves locale when defaults have no locale', async () => {
  chat.locale = 'fr'
  const wrapper = await mountSettings()

  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'gpt-4')
  await nextTick()

  expect(chat.locale).toBe('fr')
})

test('Model change applies locale from defaults', async () => {
  store.config.llm.defaults = [{
    engine: 'openai',
    model: 'gpt-4',
    disableStreaming: false,
    locale: 'de',
  } as ModelDefaults]

  chat.locale = 'fr'
  const wrapper = await mountSettings()

  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', 'openai', 'gpt-4')
  await nextTick()

  expect(chat.locale).toBe('de')
})

test('Model change with null engine/model does not crash', async () => {
  const wrapper = await mountSettings()
  const engineModelSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineModelSelect.vm.$emit('modelSelected', null, null)
  await nextTick()

  // Should still have original engine/model
  expect(chat.engine).toBe('mock')
  expect(chat.model).toBe('chat')
})

// defaults buttons

test('Load and clear buttons are disabled when no defaults exist', async () => {
  const wrapper = await mountSettings()
  expect(wrapper.find('button[name="load"]').element.disabled).toBe(true)
  expect(wrapper.find('button[name="clear"]').element.disabled).toBe(true)
})

test('Load and clear buttons are enabled when defaults exist', async () => {
  store.config.llm.defaults = [{
    engine: 'mock',
    model: 'chat',
    disableStreaming: true,
  } as ModelDefaults]

  const wrapper = await mountSettings()
  expect(wrapper.find('button[name="load"]').element.disabled).toBe(false)
  expect(wrapper.find('button[name="clear"]').element.disabled).toBe(false)
})

test('Save button is disabled when no settings differ from defaults', async () => {
  const wrapper = await mountSettings()
  expect(wrapper.find('button[name="save"]').element.disabled).toBe(true)
})

test('Save button is enabled when instructions are set', async () => {
  chat.instructions = 'Some prompt'
  const wrapper = await mountSettings()
  expect(wrapper.find('button[name="save"]').element.disabled).toBe(false)
})

test('Save button is enabled when streaming is disabled', async () => {
  chat.disableStreaming = true
  const wrapper = await mountSettings()
  expect(wrapper.find('button[name="save"]').element.disabled).toBe(false)
})

test('Save button is enabled when tools are disabled', async () => {
  chat.tools = []
  const wrapper = await mountSettings()
  expect(wrapper.find('button[name="save"]').element.disabled).toBe(false)
})

test('Load defaults applies all default settings', async () => {
  store.config.llm.defaults = [{
    engine: 'mock',
    model: 'chat',
    disableStreaming: true,
    instructions: 'Default instructions',
    locale: 'es',
    tools: ['tool1'],
    modelOpts: { temperature: 0.5 },
  } as ModelDefaults]

  const wrapper = await mountSettings()
  await wrapper.find('button[name="load"]').trigger('click')
  await nextTick()

  expect(wrapper.find('textarea[name="instructions"]').element.value).toBe('Default instructions')
  expect(chat.disableStreaming).toBe(true)
  expect(chat.instructions).toBe('Default instructions')
  expect(chat.locale).toBe('es')
  expect(chat.tools).toEqual(['tool1'])
})

test('Clear defaults clears all settings', async () => {
  store.config.llm.defaults = [{
    engine: 'mock',
    model: 'chat',
    disableStreaming: true,
    instructions: 'Default instructions',
    locale: 'es',
  } as ModelDefaults]

  chat.instructions = 'My custom prompt'
  chat.locale = 'fr'
  chat.disableStreaming = true

  const wrapper = await mountSettings()
  await wrapper.find('button[name="clear"]').trigger('click')
  await nextTick()

  expect(wrapper.find('textarea[name="instructions"]').element.value).toBe('')
  expect(chat.instructions).toBeUndefined()
  expect(chat.locale).toBeUndefined()
  expect(chat.disableStreaming).toBe(false)
})

test('Clear defaults removes entry from store', async () => {
  store.config.llm.defaults = [{
    engine: 'mock',
    model: 'chat',
    disableStreaming: true,
  } as ModelDefaults]

  const wrapper = await mountSettings()
  await wrapper.find('button[name="clear"]').trigger('click')
  await nextTick()

  expect(store.config.llm.defaults).toHaveLength(0)
})

test('Save defaults persists settings to store', async () => {
  chat.instructions = 'My prompt'
  chat.disableStreaming = true

  const wrapper = await mountSettings()
  await wrapper.find('button[name="save"]').trigger('click')
  await nextTick()

  expect(store.config.llm.defaults).toHaveLength(1)
  expect(store.config.llm.defaults[0].engine).toBe('mock')
  expect(store.config.llm.defaults[0].model).toBe('chat')
  expect(store.config.llm.defaults[0].instructions).toBe('My prompt')
  expect(store.config.llm.defaults[0].disableStreaming).toBe(true)
})

test('Save defaults replaces existing defaults for same model', async () => {
  store.config.llm.defaults = [{
    engine: 'mock',
    model: 'chat',
    disableStreaming: false,
    instructions: 'Old instructions',
  } as ModelDefaults]

  chat.instructions = 'New instructions'
  const wrapper = await mountSettings()
  await wrapper.find('button[name="save"]').trigger('click')
  await nextTick()

  expect(store.config.llm.defaults).toHaveLength(1)
  expect(store.config.llm.defaults[0].instructions).toBe('New instructions')
})

// tools

test('Disabling tools updates chat', async () => {
  const wrapper = await mountSettings()
  const pluginsSelect = wrapper.find('select[name="plugins"]')

  // Disable tools
  await pluginsSelect.setValue(true)
  await nextTick()

  expect(chat.tools).toEqual([])
})

test('Enabling tools updates chat', async () => {
  chat.tools = []
  const wrapper = await mountSettings()
  const pluginsSelect = wrapper.find('select[name="plugins"]')

  // Enable tools
  await pluginsSelect.setValue(false)
  await nextTick()

  expect(chat.tools).toBeNull()
})

test('Customize button is visible when tools are enabled', async () => {
  const wrapper = await mountSettings()
  expect(wrapper.find('.tools button').exists()).toBe(true)
})

test('Customize button is not visible when tools are disabled', async () => {
  chat.tools = []
  const wrapper = await mountSettings()
  expect(wrapper.find('.tools button').exists()).toBe(false)
})

// instructions change

test('Editing instructions updates chat on change', async () => {
  const wrapper = await mountSettings()
  const textarea = wrapper.find('textarea[name="instructions"]')
  await textarea.setValue('Updated prompt')
  await textarea.trigger('change')
  await nextTick()

  expect(chat.instructions).toBe('Updated prompt')
})

test('Clearing instructions sets chat instructions to undefined', async () => {
  chat.instructions = 'Some prompt'
  const wrapper = await mountSettings()
  const textarea = wrapper.find('textarea[name="instructions"]')
  await textarea.setValue('')
  await textarea.trigger('change')
  await nextTick()

  expect(chat.instructions).toBeUndefined()
})
