
import { vi, beforeAll, beforeEach, expect, test, afterAll, Mock } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { stubTeleport } from '../mocks/stubs'
import { store } from '../../src/services/store'
import DocRepos from '../../src/screens/DocRepos.vue'
import DocRepoConfig from '../../src/screens/DocRepoConfig.vue'

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
  expect(wrapper.find('.panel').exists()).toBe(true)
  expect(wrapper.find('.panel .list').exists()).toBe(true)
  expect(wrapper.find('.content').exists()).toBe(true)
  expect(wrapper.find('.content .name').exists()).toBe(true)
  expect(wrapper.find('.content .embeddings').exists()).toBe(true)
  expect(wrapper.find('.content .documents .list').exists()).toBe(true)
})

test('Initializes correctly', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.findAll('.panel .item')).toHaveLength(2)
  expect(wrapper.find('.panel .item:nth-child(1)').text()).toBe('docrepo1')
  expect(wrapper.find('.panel .item:nth-child(2)').text()).toBe('docrepo2')
  expect(wrapper.find('.panel .item.selected').text()).toBe('docrepo1')
  expect(wrapper.find<HTMLInputElement>('.content .name input').element.value).toBe('docrepo1')
  expect(wrapper.find<HTMLInputElement>('.content .embeddings input').element.value).toBe('ollama / all-minilm')
  expect(wrapper.findAll('.content .documents .item')).toHaveLength(0)
})

test('Renders documents', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.findAll('.panel .item')).toHaveLength(2)
  await wrapper.find('.panel .item:nth-child(2)').trigger('click')
  expect(wrapper.find('.panel .item.selected').text()).toBe('docrepo2')
  expect(wrapper.find<HTMLInputElement>('.content .name input').element.value).toBe('docrepo2')
  expect(wrapper.find<HTMLInputElement>('.content .embeddings input').element.value).toBe('openai / text-embedding-ada-002')
  expect(wrapper.findAll('.content .documents .item')).toHaveLength(2)
  expect(wrapper.find('.content .documents .item:nth-child(1) .icon').exists()).toBe(true)
  expect(wrapper.find('.content .documents .item:nth-child(1) .filename').text()).toBe('file1')
  expect(wrapper.find('.content .documents .item:nth-child(1) .origin').text()).toBe('/tmp/file1')
  expect(wrapper.find('.content .documents .item:nth-child(1) .actions').exists()).toBe(true)
  expect(wrapper.findAll('.content .documents .item:nth-child(1) .actions > *').length).toBe(1)
  expect(wrapper.find('.content .documents .item:nth-child(2) .icon').exists()).toBe(true)
  expect(wrapper.find('.content .documents .item:nth-child(2) .filename').text()).toBe('folder1 (2 common.files)')
  expect(wrapper.find('.content .documents .item:nth-child(2) .origin').text()).toBe('/tmp/folder1')
  expect(wrapper.find('.content .documents .item:nth-child(2) .actions').exists()).toBe(true)
  expect(wrapper.findAll('.content .documents .item:nth-child(2) .actions > *').length).toBe(1)
})

test('Shows create editor', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await wrapper.find('.panel header .icon.create').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('open-docrepo-create', null)
})

test('Shows configuration', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await wrapper.find('.panel footer .icon.config').trigger('click')
  expect(emitEventMock).toHaveBeenLastCalledWith('open-docrepo-config', null)
})

test('Updates configuration', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepoConfig, { ...stubTeleport })
  wrapper.vm.load()
  await wrapper.vm.$nextTick()
  expect(wrapper.find<HTMLInputElement>('[name=maxDocumentSizeMB]').element.value).toBe('1')
  expect(wrapper.find<HTMLInputElement>('[name=chunkSize]').element.value).toBe('500')
  expect(wrapper.find<HTMLInputElement>('[name=chunkOverlap]').element.value).toBe('50')
  expect(wrapper.find<HTMLInputElement>('[name=searchResultCount]').element.value).toBe('5')
  expect(wrapper.find<HTMLInputElement>('[name=relevanceCutOff]').element.value).toBe('0.2')

  wrapper.find<HTMLInputElement>('[name=maxDocumentSizeMB]').setValue('2')
  await wrapper.find('button[name=reset]').trigger('click')
  expect(wrapper.find<HTMLInputElement>('[name=maxDocumentSizeMB]').element.value).toBe('1')

  wrapper.find<HTMLInputElement>('[name=maxDocumentSizeMB]').setValue('2')
  wrapper.find<HTMLInputElement>('[name=chunkSize]').setValue('600')
  wrapper.find<HTMLInputElement>('[name=chunkOverlap]').setValue('60')
  wrapper.find<HTMLInputElement>('[name=searchResultCount]').setValue('6')
  wrapper.find<HTMLInputElement>('[name=relevanceCutOff]').setValue('0.3')
  await wrapper.find('button[name=save]').trigger('click')

  expect(store.config.rag.maxDocumentSizeMB).toBe(2)
  expect(store.config.rag.chunkSize).toBe(600)
  expect(store.config.rag.chunkOverlap).toBe(60)
  expect(store.config.rag.searchResultCount).toBe(6)
  expect(store.config.rag.relevanceCutOff).toBe(0.3)

  wrapper.find<HTMLInputElement>('[name=maxDocumentSizeMB]').setValue('3')
  await wrapper.find('button[name=cancel]').trigger('click')
  expect(store.config.rag.maxDocumentSizeMB).toBe(2)

})

test('Deletes base', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.content header .icon.delete').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalled()
  expect(window.api.docrepo.delete).toHaveBeenLastCalledWith('uuid1')
})

test('Renames base', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.content .name input').setValue('docrepo1-new')
  expect(window.api.docrepo.rename).toHaveBeenLastCalledWith('uuid1', 'docrepo1-new')
})

test('Adds documents', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.content .icon.add-file').trigger('click')
  expect(window.api.file.pick).toHaveBeenCalled()
  expect(window.api.docrepo.addDocument).toHaveBeenCalledTimes(2)
  expect((window.api.docrepo.addDocument as Mock).mock.calls[0]).toStrictEqual(['uuid1', 'file', 'file4'])
  expect((window.api.docrepo.addDocument as Mock).mock.calls[1]).toStrictEqual(['uuid1', 'file', 'file5'])
  await wrapper.find('.content .icon.add-folder').trigger('click')
  expect(window.api.file.pickDir).toHaveBeenCalled()
  expect(window.api.docrepo.addDocument).toHaveBeenCalledTimes(3)
  expect((window.api.docrepo.addDocument as Mock).mock.calls[2]).toStrictEqual(['uuid1', 'folder', 'folder2'])
})

test('Deletes documents', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.panel .item:nth-child(2)').trigger('click')
  await wrapper.find('.content .documents .item:nth-child(1) .actions .icon.remove').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalled()
  expect(window.api.docrepo.removeDocument).toHaveBeenLastCalledWith('uuid2', 'uuid3')
  await wrapper.find('.content .documents .item:nth-child(2) .actions .icon.remove').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalled()
  expect(window.api.docrepo.removeDocument).toHaveBeenLastCalledWith('uuid2', 'uuid4')
})
