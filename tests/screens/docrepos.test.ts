
import { vi, beforeAll, beforeEach, expect, test, afterAll, Mock } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import DocRepos from '../../src/screens/DocRepos.vue'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn()

vi.mock('../../src/services/i18n', async () => {
  return {
    t: (key: string) => `${key}`,
  }
})

vi.mock('../../src/composables/event_bus', async () => {
  return { default: () => ({
    onEvent: onEventMock,
    emitEvent: emitEventMock
  })}
})

beforeAll(() => {
  useWindowMock()
  window.api.file.pick = vi.fn(() => [ 'file4', 'file5' ])
  window.api.file.pickDir = vi.fn(() => 'folder2')
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.list-large-with-header').exists()).toBe(true)
  expect(wrapper.find('.list-large-with-header .list').exists()).toBe(true)
  expect(wrapper.find('.content').exists()).toBe(true)
})

test('Initializes correctly', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.findAll('.list-large-with-header .item')).toHaveLength(2)
  expect(wrapper.find('.list-large-with-header .item:nth-child(1) .text').text()).toBe('docrepo1')
  expect(wrapper.find('.list-large-with-header .item:nth-child(2) .text').text()).toBe('docrepo2')
})

test('Renders documents', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.findAll('.list-large-with-header .item')).toHaveLength(2)
  await wrapper.find('.list-large-with-header .item:nth-child(2)').trigger('click')
  expect(wrapper.vm.selectedRepo?.name).toBe('docrepo2')
  expect(wrapper.vm.mode).toBe('view')
  // Wait for the view to be visible and check the content
  await vi.waitUntil(() => wrapper.find('.sliding-pane.visible').exists())
  expect(wrapper.find<HTMLInputElement>('.sliding-pane input[type="text"]').element.value).toBe('docrepo2')
  expect(wrapper.findAll('.sliding-pane .documents .item')).toHaveLength(2)
  expect(wrapper.find('.sliding-pane .documents .item:nth-child(1) .icon').exists()).toBe(true)
  expect(wrapper.find('.sliding-pane .documents .item:nth-child(1) .text').text()).toBe('file1')
  expect(wrapper.find('.sliding-pane .documents .item:nth-child(1) .subtext').text()).toBe('/tmp/file1')
  expect(wrapper.find('.sliding-pane .documents .item:nth-child(1) .actions').exists()).toBe(true)
  expect(wrapper.findAll('.sliding-pane .documents .item:nth-child(1) .actions > *').length).toBe(1)
  expect(wrapper.find('.sliding-pane .documents .item:nth-child(2) .icon').exists()).toBe(true)
  expect(wrapper.find('.sliding-pane .documents .item:nth-child(2) .text').text()).toBe('folder1 (2 common.files)')
  expect(wrapper.find('.sliding-pane .documents .item:nth-child(2) .subtext').text()).toBe('/tmp/folder1')
  expect(wrapper.find('.sliding-pane .documents .item:nth-child(2) .actions').exists()).toBe(true)
  expect(wrapper.findAll('.sliding-pane .documents .item:nth-child(2) .actions > *').length).toBe(1)
})

test('Shows create editor', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.list-large-with-header .header .icon.create').trigger('click')
  expect(wrapper.vm.mode).toBe('create')
})

test('Shows configuration', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.list-large-with-header .header .icon.config').trigger('click')
  expect(wrapper.vm.mode).toBe('config')
  await vi.waitUntil(() => wrapper.find('.sliding-pane.editor.visible').exists())
  expect(wrapper.find('.docrepo-config').exists()).toBe(true)
})

test('Updates configuration', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.list-large-with-header .header .icon.config').trigger('click')
  await vi.waitUntil(() => wrapper.find('.sliding-pane.editor.visible').exists())

  const config = wrapper.findComponent({ name: 'Config' })

  expect(config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').element.value).toBe('1')
  expect(config.find<HTMLInputElement>('[name=chunkSize]').element.value).toBe('500')
  expect(config.find<HTMLInputElement>('[name=chunkOverlap]').element.value).toBe('50')
  expect(config.find<HTMLInputElement>('[name=searchResultCount]').element.value).toBe('5')
  expect(config.find<HTMLInputElement>('[name=relevanceCutOff]').element.value).toBe('0.2')

  // Test reset
  await config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').setValue('2')
  await config.find<HTMLButtonElement>('.docrepo-config button.reset').trigger('click')
  expect(config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').element.value).toBe('1')

  // Update values and save
  await config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').setValue('2')
  await config.find<HTMLInputElement>('[name=chunkSize]').setValue('600')
  await config.find<HTMLInputElement>('[name=chunkOverlap]').setValue('60')
  await config.find<HTMLInputElement>('[name=searchResultCount]').setValue('6')
  await config.find<HTMLInputElement>('[name=relevanceCutOff]').setValue('0.3')
  await config.find('button[type=submit]').trigger('click')

  // Wait for save to complete and mode to change back to list
  await vi.waitUntil(() => wrapper.vm.mode === 'list')

  expect(store.config.rag.maxDocumentSizeMB).toBe(2)
  expect(store.config.rag.chunkSize).toBe(600)
  expect(store.config.rag.chunkOverlap).toBe(60)
  expect(store.config.rag.searchResultCount).toBe(6)
  expect(store.config.rag.relevanceCutOff).toBe(0.3)

  // Test cancel behavior  
  await wrapper.find('.list-large-with-header .header .icon.config').trigger('click')
  await vi.waitUntil(() => wrapper.find('.sliding-pane.editor.visible').exists())
  await config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').setValue('3')
  await config.find<HTMLButtonElement>('.docrepo-config button.cancel').trigger('click')
  expect(store.config.rag.maxDocumentSizeMB).toBe(2)
})

test('Deletes base', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.list-large-with-header .item:nth-child(1) .delete').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalled()
  expect(window.api.docrepo.delete).toHaveBeenLastCalledWith('uuid1')
})

test('Renames base', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.list-large-with-header .item:nth-child(1)').trigger('click')
  await wrapper.find('.sliding-pane input[type="text"]').setValue('docrepo1-new')
  expect(window.api.docrepo.rename).toHaveBeenLastCalledWith('uuid1', 'docrepo1-new')
})

test('Adds documents', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.list-large-with-header .item:nth-child(1)').trigger('click')
  await wrapper.find('.sliding-pane .icon.add-file').trigger('click')
  expect(window.api.file.pick).toHaveBeenCalled()
  expect(window.api.docrepo.addDocument).toHaveBeenCalledTimes(2)
  expect((window.api.docrepo.addDocument as Mock).mock.calls[0]).toStrictEqual(['uuid1', 'file', 'file4'])
  expect((window.api.docrepo.addDocument as Mock).mock.calls[1]).toStrictEqual(['uuid1', 'file', 'file5'])
  await wrapper.find('.sliding-pane .icon.add-folder').trigger('click')
  expect(window.api.file.pickDir).toHaveBeenCalled()
  expect(window.api.docrepo.addDocument).toHaveBeenCalledTimes(3)
  expect((window.api.docrepo.addDocument as Mock).mock.calls[2]).toStrictEqual(['uuid1', 'folder', 'folder2'])
})

test('Deletes documents', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.list-large-with-header .item:nth-child(2)').trigger('click')
  await wrapper.find('.sliding-pane .documents .item:nth-child(1) .actions .icon.remove').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalled()
  // Wait for the dialog promise to resolve and the delete to be called
  await vi.waitUntil(() => (window.api.docrepo.removeDocument as Mock).mock.calls.length > 0)
  expect(window.api.docrepo.removeDocument).toHaveBeenLastCalledWith('uuid2', 'uuid3')
  await wrapper.find('.sliding-pane .documents .item:nth-child(2) .actions .icon.remove').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalled()
  // Wait for the second delete call
  await vi.waitUntil(() => (window.api.docrepo.removeDocument as Mock).mock.calls.length > 1)
  expect(window.api.docrepo.removeDocument).toHaveBeenLastCalledWith('uuid2', 'uuid4')
})
