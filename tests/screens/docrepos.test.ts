
import { vi, beforeAll, beforeEach, expect, test, afterAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import DocRepos from '../../src/screens/DocRepos.vue'
import { DocumentBase } from '../../src/types/rag.d'

enableAutoUnmount(afterAll)

const onEventMock = vi.fn()
const emitEventMock = vi.fn()

vi.mock('../../src/composables/event_bus.js', async () => {
  return { default: () => {
    return {
      onEvent: onEventMock,
      emitEvent: emitEventMock
    }
  }}
})

beforeAll(() => {

  window.api = {
    on: vi.fn(),
    showDialog: vi.fn(async () => { return { response: 1, checkboxChecked: false }}),
    file: {
      pick: vi.fn(() => [ 'file4', 'file5' ]),
      pickDir: vi.fn(() => 'folder2'),
    },
    docrepo: {
      list: vi.fn((): DocumentBase[] => {
        return [
          { uuid: 'uuid1', name: 'docrepo1', embeddingEngine: 'ollama', embeddingModel: 'all-minilm', documents: [] },
          { uuid: 'uuid2', name: 'docrepo2', embeddingEngine: 'openai', embeddingModel: 'text-embedding-ada-002', documents: [
            { uuid: 'uuid3', type: 'file', title: 'file1', origin: '/tmp/file1', filename: 'file1', url: 'file:///tmp/file1' },
            { uuid: 'uuid4', type: 'folder', title: 'folder1', origin: '/tmp/folder1', filename: 'folder1', url: 'file:///tmp/folder1', items: [
              { uuid: 'uuid5', type: 'file', title: 'file2', origin: '/tmp/file2', filename: 'file2', url: 'file:///tmp/file2' },
              { uuid: 'uuid6', type: 'file', title: 'file3', origin: '/tmp/file3', filename: 'file3', url: 'file:///tmp/file3' },
            ]},
          ]},
        ]
      }),
      delete: vi.fn(),
      rename: vi.fn(),
      addDocument: vi.fn(),
      removeDocument: vi.fn(),
      isEmbeddingAvailable: vi.fn(() => true),
    }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', async () => {
  const wrapper = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.master').exists()).toBe(true)
  expect(wrapper.find('.master .list').exists()).toBe(true)
  expect(wrapper.find('.master .actions').exists()).toBe(true)
  expect(wrapper.find('.details').exists()).toBe(true)
  expect(wrapper.find('.details .name').exists()).toBe(true)
  expect(wrapper.find('.details .embeddings').exists()).toBe(true)
  expect(wrapper.find('.details .documents .list').exists()).toBe(true)
})

test('Initializes correctly', async () => {
  const wrapper = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.findAll('.master .item')).toHaveLength(2)
  expect(wrapper.find('.master .item:nth-child(1)').text()).toBe('docrepo1')
  expect(wrapper.find('.master .item:nth-child(2)').text()).toBe('docrepo2')
  expect(wrapper.find('.master .item.selected').text()).toBe('docrepo1')
  expect(wrapper.find('.details .name input').element.value).toBe('docrepo1')
  expect(wrapper.find('.details .embeddings input').element.value).toBe('ollama / all-minilm')
  expect(wrapper.findAll('.details .documents .item')).toHaveLength(0)
})

test('Selects correctly', async () => {
  const wrapper = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.findAll('.master .item')).toHaveLength(2)
  await wrapper.find('.master .item:nth-child(2)').trigger('click')
  expect(wrapper.find('.master .item.selected').text()).toBe('docrepo2')
  expect(wrapper.find('.details .name input').element.value).toBe('docrepo2')
  expect(wrapper.find('.details .embeddings input').element.value).toBe('openai / text-embedding-ada-002')
  expect(wrapper.findAll('.details .documents .item')).toHaveLength(2)
  expect(wrapper.find('.details .documents .item:nth-child(1)').text()).toBe('file1 (/tmp/file1)')
  expect(wrapper.find('.details .documents .item:nth-child(2)').text()).toBe('folder1 (2 files) (/tmp/folder1)')
  expect(wrapper.findAll('.details .documents .item.selected')).toHaveLength(1)
  expect(wrapper.find('.details .documents .item.selected').text()).toBe('file1 (/tmp/file1)')
  await wrapper.find('.details .documents .item:nth-child(2)').trigger('click')
  expect(wrapper.findAll('.details .documents .item.selected')).toHaveLength(1)
  expect(wrapper.find('.details .documents .item.selected').text()).toBe('folder1 (2 files) (/tmp/folder1)')
})

test('Shows create editor', async () => {
  const wrapper = mount(DocRepos)
  await wrapper.find('.master .actions button.create').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('open-docrepo-create')
})

test('Shows configuration', async () => {
  const wrapper = mount(DocRepos)
  await wrapper.find('.master .actions button.config').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('open-docrepo-config')
})

test('Deletes base', async () => {
  const wrapper = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.master .actions button.delete').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalled()
  expect(window.api.docrepo.delete).toHaveBeenCalledWith('uuid1')
})

test('Renames base', async () => {
  const wrapper = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.details .name input').setValue('docrepo1-new')
  expect(window.api.docrepo.rename).toHaveBeenCalledWith('uuid1', 'docrepo1-new')
})

test('Adds documents', async () => {
  const wrapper = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.details .actions button.add').trigger('click')
  expect(wrapper.find('.context-menu').exists()).toBe(true)
  expect(wrapper.findAll('.context-menu .item')).toHaveLength(2)
  await wrapper.find('.context-menu .item:nth-child(1)').trigger('click')
  expect(window.api.file.pick).toHaveBeenCalled()
  expect(window.api.docrepo.addDocument).toHaveBeenCalledTimes(2)
  expect(window.api.docrepo.addDocument.mock.calls[0]).toStrictEqual(['uuid1', 'file', 'file4'])
  expect(window.api.docrepo.addDocument.mock.calls[1]).toStrictEqual(['uuid1', 'file', 'file5'])
  await wrapper.find('.details .actions button.add').trigger('click')
  await wrapper.find('.context-menu .item:nth-child(2)').trigger('click')
  expect(window.api.file.pickDir).toHaveBeenCalled()
  expect(window.api.docrepo.addDocument).toHaveBeenCalledTimes(3)
  expect(window.api.docrepo.addDocument.mock.calls[2]).toStrictEqual(['uuid1', 'folder', 'folder2'])
})

test('Deletes documents', async () => {
  const wrapper = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.master .item:nth-child(2)').trigger('click')
  await wrapper.find('.details .actions button.remove').trigger('click')
  expect(window.api.showDialog).toHaveBeenCalled()
  expect(window.api.docrepo.removeDocument).toHaveBeenCalledWith('uuid2', 'uuid3')
})
