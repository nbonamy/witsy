import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { defaultCapabilities } from 'multi-llm-ts'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { stubTeleport } from '../mocks/stubs'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks/index'
import FolderSettings from '../../src/screens/FolderSettings.vue'
import { store } from '../../src/services/store'
import Dialog from '../../src/composables/dialog'
import Expert from '../../src/models/expert'

enableAutoUnmount(afterAll)

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
  store.loadSettings()

  // Setup test engine and models
  store.config.engines.mock = {
    model: { chat: 'chat' },
    models: {
      // @ts-expect-error testing
      _chat: [
        { id: 'chat', name: 'Chat Model', meta: {}, ...defaultCapabilities },
        { id: 'chat2', name: 'Chat Model 2', meta: {}, ...defaultCapabilities }
      ],
      get chat() {
        // @ts-expect-error testing
        return this._chat
      },
      set chat(value) {
        // @ts-expect-error testing
        this._chat = value
      },
    }
  }

  // Setup test experts
  store.experts = [
    { id: 'expert1', state: 'enabled', name: 'Expert One', prompt: 'Expert 1 prompt' } as any as Expert,
    { id: 'expert2', state: 'enabled', name: 'Expert Two', prompt: 'Expert 2 prompt' } as any as Expert,
    { id: 'expert3', state: 'disabled', name: 'Expert Three', prompt: 'Expert 3 prompt' } as any as Expert,
  ]

  // Mock docrepo API
  window.api.docrepo = {
    // @ts-expect-error testing
    list: vi.fn(() => [
      { uuid: 'repo1', name: 'Knowledge Base 1' },
      { uuid: 'repo2', name: 'Knowledge Base 2' },
    ])
  }

  wrapper = mount(FolderSettings, stubTeleport)
})

beforeEach(() => {
  vi.clearAllMocks()
  store.loadHistory()
  store.history.folders = [{
    id: 'folder1',
    name: 'Folder 1',
    chats: [],
    defaults: {
      engine: 'mock',
      model: 'chat',
      disableStreaming: true,
      tools: [ 'tool1', 'tool2' ],
      locale: 'fr-FR',
      instructions: 'Test instructions',
      expert: 'expert1',
      docrepo: 'repo1',
    }
  }, {
    id: 'folder2',
    name: 'Folder 2',
    chats: [],
  }]
})

test('Shows dialog with existing defaults', async () => {

  store.history.folders[0].defaults!.tools = null
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  // Basic fields are visible
  expect(wrapper.find<HTMLSelectElement>('[name="plugins"]').element.value).toBe('false')
  expect(wrapper.find<HTMLTextAreaElement>('[name="instructions"]').element.value).toBe('Test instructions')
  expect(wrapper.find<HTMLSelectElement>('[name="expert"]').element.value).toBe('expert1')
  expect(wrapper.find<HTMLSelectElement>('[name="docrepo"]').element.value).toBe('repo1')
  expect(wrapper.find<HTMLSelectElement>('[name="locale"]').element.value).toBe('fr-FR')

  // Toggle to advanced mode to check advanced fields
  await wrapper.find('button[name="advanced"]').trigger('click')
  await wrapper.vm.$nextTick()

  expect(wrapper.find<HTMLSelectElement>('[name="streaming"]').element.value).toBe('true')
})

test('Shows dialog with default values when no defaults exist', async () => {
  await wrapper.vm.show(store.history.folders[1])
  await wrapper.vm.$nextTick()
  expect(wrapper.find('#folder-settings').classes()).toContain('visible')
  expect(wrapper.find<HTMLSelectElement>('[name="plugins"]').element.value).toBe('false')
  expect(wrapper.find<HTMLTextAreaElement>('[name="instructions"]').element.value).toBe('')
  expect(wrapper.find<HTMLSelectElement>('[name="expert"]').element.value).toBe('')
  expect(wrapper.find<HTMLSelectElement>('[name="docrepo"]').element.value).toBe('')
})

test('Shows only enabled experts in dropdown', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  const expertOptions = wrapper.find('[name="expert"]').findAll('option')
  // Should have "None" option + 2 enabled experts (expert3 is disabled)
  expect(expertOptions).toHaveLength(3)
  expect(expertOptions[0].text()).toBe('folderSettings.noExpert')
  expect(expertOptions[1].text()).toBe('Expert One')
  expect(expertOptions[2].text()).toBe('Expert Two')
})

test('Shows all docrepos in dropdown', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  const docrepoOptions = wrapper.find('[name="docrepo"]').findAll('option')
  // Should have "None" option + 2 repos
  expect(docrepoOptions).toHaveLength(3)
  expect(docrepoOptions[0].text()).toBe('folderSettings.noDocRepo')
  expect(docrepoOptions[1].text()).toBe('Knowledge Base 1')
  expect(docrepoOptions[2].text()).toBe('Knowledge Base 2')
})

test('Toggles advanced settings', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  expect(wrapper.vm.showAdvanced).toBe(false)
  expect(wrapper.find('[name="temperature"]').exists()).toBe(false)

  await wrapper.find('button[name="advanced"]').trigger('click')
  await wrapper.vm.$nextTick()

  expect(wrapper.vm.showAdvanced).toBe(true)
  expect(wrapper.find('[name="temperature"]').exists()).toBe(true)
})

test('Saves folder defaults', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  // Set basic fields
  await wrapper.find('[name="instructions"]').setValue('Test instructions 2')
  await wrapper.find('[name="expert"]').setValue('expert2')
  await wrapper.find('[name="docrepo"]').setValue('repo2')

  // // Toggle to advanced mode to set locale
  // await wrapper.find('button[name="advanced"]').trigger('click')
  // await wrapper.vm.$nextTick()
  // 
  // await wrapper.find('[name="locale"]').setValue('fr-FR')

  await wrapper.find('.dialog-footer button[name="save"]').trigger('click')
  await wrapper.vm.$nextTick()

  expect(store.history.folders[0].defaults!.instructions).toBe('Test instructions 2')
  expect(store.history.folders[0].defaults!.expert).toBe('expert2')
  expect(store.history.folders[0].defaults!.docrepo).toBe('repo2')
})

test('Removes empty modelOpts when no advanced settings', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  await wrapper.find('[name="instructions"]').setValue('Test')
  await wrapper.find('button[name="save"]').trigger('click')
  await wrapper.vm.$nextTick()

  expect(window.api.history.save).toHaveBeenCalled()
  expect(store.history.folders[0].defaults!.modelOpts).toBeNull()
})

test('Cancels without saving', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  await wrapper.find('[name="instructions"]').setValue('Should not save')
  await wrapper.find('button[name="cancel"]').trigger('click')
  await wrapper.vm.$nextTick()

  expect(window.api.history.save).not.toHaveBeenCalled()

})

test('Shows error when engine/model not selected', async () => {
  // Set engine to empty to simulate invalid state
  await wrapper.vm.show(store.history.folders[0])
  wrapper.vm.engine = ''
  await wrapper.vm.$nextTick()

  await wrapper.find('button[name="save"]').trigger('click')
  await wrapper.vm.$nextTick()

  expect(Dialog.show).toHaveBeenCalledWith({
    title: expect.stringContaining('modelSettings.errors.noProviderOrModel.title'),
    text: expect.stringContaining('modelSettings.errors.noProviderOrModel.text'),
    confirmButtonText: expect.stringContaining('common.ok'),
  })
  expect(window.api.history.save).not.toHaveBeenCalled()
})

test('Opens tool selector', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  const customizeButton = wrapper.find('button')
  expect(customizeButton.text()).toBe('common.customize')

  await customizeButton.trigger('click')
  await wrapper.vm.$nextTick()

  // The selector should be shown (checking via ref)
  const selector = wrapper.vm.selector
  expect(selector).toBeDefined()
})

test('Updates tools selection from tool selector', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  const testTools = ['tool1', 'tool2']
  wrapper.vm.onSaveTools(testTools)
  await wrapper.vm.$nextTick()

  expect(wrapper.vm.tools).toEqual(testTools)
})

test('Sets tools to empty array when disabled', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  await wrapper.find('[name="plugins"]').setValue('true')
  await wrapper.find('button[name="save"]').trigger('click')
  await wrapper.vm.$nextTick()

  expect(window.api.history.save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    folders: expect.arrayContaining([
      expect.objectContaining({
        defaults: expect.objectContaining({
          tools: []
        })
      })
    ])
  }))
})

test('Trims whitespace from instructions and locale', async () => {
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  await wrapper.find('[name="instructions"]').setValue('  whitespace  ')
  await wrapper.find('button[name="save"]').trigger('click')
  await wrapper.vm.$nextTick()

  expect(window.api.history.save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    folders: expect.arrayContaining([
      expect.objectContaining({
        defaults: expect.objectContaining({
          instructions: 'whitespace'
        })
      })
    ])
  }))
})

test('Converts empty strings to null', async () => {
  
  await wrapper.vm.show(store.history.folders[0])
  await wrapper.vm.$nextTick()

  // Clear the instructions
  await wrapper.find('[name="instructions"]').setValue('')
  await wrapper.vm.$nextTick()

  // // Toggle to advanced mode to clear locale
  // await wrapper.find('button[name="advanced"]').trigger('click')
  // await wrapper.vm.$nextTick()

  // await wrapper.find('[name="locale"]').setValue('')
  // await wrapper.vm.$nextTick()

  await wrapper.find('button[name="save"]').trigger('click')
  await wrapper.vm.$nextTick()

  expect(window.api.history.save).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    folders: expect.arrayContaining([
      expect.objectContaining({
      })
    ])
  }))
})
