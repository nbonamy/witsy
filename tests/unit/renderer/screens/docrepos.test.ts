
import { vi, beforeAll, beforeEach, expect, test, afterAll, Mock } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18nMock } from '../mocks'
import { useWindowMock } from '../mocks/window'
import { stubTeleport } from '../mocks/stubs'
import { store } from '../../src/renderer/services/store'
import DocRepos from '../../src/renderer/screens/DocRepos.vue'
import Dialog from '../../src/renderer/utils/dialog'

enableAutoUnmount(afterAll)

vi.mock('../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
  window.api.file.pickFile = vi.fn(() => [ 'file4', 'file5' ])
  window.api.file.pickDirectory = vi.fn(() => 'folder2')
  window.api.file.openInExplorer = vi.fn()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders correctly', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.split-pane').exists()).toBe(true)
  expect(wrapper.find('.split-pane .sp-sidebar').exists()).toBe(true)
  expect(wrapper.find('.split-pane .sp-main').exists()).toBe(true)
})

test('Initializes correctly', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.findAll('.split-pane .list-item')).toHaveLength(2)
  expect(wrapper.find('.split-pane .list-item:nth-child(1) .text').text()).toBe('docrepo1')
  expect(wrapper.find('.split-pane .list-item:nth-child(2) .text').text()).toBe('docrepo2')
})

test('Automatically selects first repository on load', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  // Verify that the first repository is automatically selected
  expect(wrapper.vm.selectedRepo?.name).toBe('docrepo1')
  expect(wrapper.vm.selectedRepo?.uuid).toBe('uuid1')
  expect(wrapper.vm.mode).toBe('view')
})

test('Renders documents', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  expect(wrapper.findAll('.split-pane .list-item')).toHaveLength(2)
  await wrapper.find('.split-pane .list-item:nth-child(2)').trigger('click')
  expect(wrapper.vm.selectedRepo?.name).toBe('docrepo2')
  expect(wrapper.vm.mode).toBe('view')
  expect(wrapper.findAll('.split-pane .sp-main .documents .panel-item')).toHaveLength(2)
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(1) .icon').exists()).toBe(true)
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(1) .text').text()).toBe('file1')
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(1) .subtext').text()).toBe('1 B')
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(1) .actions').exists()).toBe(true)
  expect(wrapper.findAll('.split-pane .sp-main .documents .panel-item:nth-child(1) .actions > *').length).toBe(4)
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(2) .icon').exists()).toBe(true)
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(2) .text').text()).toBe('folder1')
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(2) .subtext').text()).toBe('docRepo.list.documentsCount_default_count=2')
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(2) .actions').exists()).toBe(true)
  expect(wrapper.findAll('.split-pane .sp-main .documents .panel-item:nth-child(2) .actions > *').length).toBe(4)
})

test('Shows create dialog', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos, { ...stubTeleport })
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .sp-sidebar footer button').trigger('click')
  expect(wrapper.findComponent({ name: 'Create' }).exists()).toBe(true)
})

test('Creates a docrepo', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos, { ...stubTeleport })
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  
  // Open create dialog
  await wrapper.find('.split-pane .sp-sidebar footer button').trigger('click')
  const createComponent = wrapper.findComponent({ name: 'Create' })
  expect(createComponent.exists()).toBe(true)
  
  // Fill out the form
  const nameInput = createComponent.find('input[type="text"]')
  await nameInput.setValue('Test Repository')
  
  // Submit the form
  await createComponent.find('button[name="save"]').trigger('click')
  
  // Verify that window.api.docrepo.create was called with correct parameters
  expect(window.api.docrepo.create).toHaveBeenCalledWith(
    store.config.workspaceId, // Use actual workspaceId from store
    'Test Repository',
    'openai',
    'text-embedding-3-large'
  )
})

test('Shows configuration', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .sp-sidebar header .config').trigger('click')
  expect(wrapper.findComponent({ name: 'Config' }).exists()).toBe(true)
})

test('Updates configuration', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos, { ...stubTeleport })
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .sp-sidebar header .config').trigger('click')
  await wrapper.vm.$nextTick()
  const config = wrapper.findComponent({ name: 'Config' })
  console.log(config.html())

  expect(config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').element.value).toBe('1')
  expect(config.find<HTMLInputElement>('[name=chunkSize]').element.value).toBe('500')
  expect(config.find<HTMLInputElement>('[name=chunkOverlap]').element.value).toBe('50')
  expect(config.find<HTMLInputElement>('[name=searchResultCount]').element.value).toBe('5')
  expect(config.find<HTMLInputElement>('[name=relevanceCutOff]').element.value).toBe('0.2')

  // Test reset
  await config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').setValue('2')
  await config.find<HTMLButtonElement>('button[name=reset]').trigger('click')
  expect(config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').element.value).toBe('1')

  // Update values and save
  await config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').setValue('2')
  await config.find<HTMLInputElement>('[name=chunkSize]').setValue('600')
  await config.find<HTMLInputElement>('[name=chunkOverlap]').setValue('60')
  await config.find<HTMLInputElement>('[name=searchResultCount]').setValue('6')
  await config.find<HTMLInputElement>('[name=relevanceCutOff]').setValue('0.3')
  await config.find('button[name=save]').trigger('click')

  expect(store.config.rag.maxDocumentSizeMB).toBe(2)
  expect(store.config.rag.chunkSize).toBe(600)
  expect(store.config.rag.chunkOverlap).toBe(60)
  expect(store.config.rag.searchResultCount).toBe(6)
  expect(store.config.rag.relevanceCutOff).toBe(0.3)

  // Test cancel behavior  
  await wrapper.find('.split-pane .sp-sidebar header .config').trigger('click')
  await config.find<HTMLInputElement>('[name=maxDocumentSizeMB]').setValue('3')
  await config.find<HTMLButtonElement>('button[name=cancel]').trigger('click')
  expect(store.config.rag.maxDocumentSizeMB).toBe(2)
})

test('Deletes base', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .list-item:nth-child(1)').trigger('click')
  await wrapper.find('.split-pane .sp-main .delete').trigger('click')
  expect(Dialog.show).toHaveBeenCalled()
  expect(window.api.docrepo.delete).toHaveBeenLastCalledWith('uuid1')
})

test('Adds documents', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .list-item:nth-child(1)').trigger('click')
  await wrapper.find('.split-pane .sp-main button[name=addDocs]').trigger('click')
  expect(window.api.file.pickFile).toHaveBeenCalled()
  expect(window.api.docrepo.addDocument).toHaveBeenCalledTimes(2)
  expect((window.api.docrepo.addDocument as Mock).mock.calls[0]).toStrictEqual(['uuid1', 'file', 'file4'])
  expect((window.api.docrepo.addDocument as Mock).mock.calls[1]).toStrictEqual(['uuid1', 'file', 'file5'])
  await wrapper.find('.split-pane .sp-main button[name=addFolder]').trigger('click')
  expect(window.api.file.pickDirectory).toHaveBeenCalled()
  expect(window.api.docrepo.addDocument).toHaveBeenCalledTimes(3)
  expect((window.api.docrepo.addDocument as Mock).mock.calls[2]).toStrictEqual(['uuid1', 'folder', 'folder2'])
})

test('Adds supported documents successfully', async () => {
  // Mock pickFile to return supported file
  window.api.file.pickFile = vi.fn(() => ['file'])
  
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .list-item:nth-child(1)').trigger('click')
  await wrapper.find('.split-pane .sp-main button[name=addDocs]').trigger('click')
  
  expect(window.api.docrepo.isSourceSupported).toHaveBeenCalledWith('file', 'file')
  expect(window.api.docrepo.addDocument).toHaveBeenCalledWith('uuid1', 'file', 'file')
  expect(Dialog.alert).not.toHaveBeenCalled()
})

test('Shows error for unsupported documents', async () => {
  // Mock pickFile to return unsupported file
  window.api.file.pickFile = vi.fn(() => ['invalid'])
  
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .list-item:nth-child(1)').trigger('click')
  await wrapper.find('.split-pane .sp-main button[name=addDocs]').trigger('click')
  
  expect(window.api.docrepo.isSourceSupported).toHaveBeenCalledWith('file', 'invalid')
  expect(window.api.docrepo.addDocument).not.toHaveBeenCalled()
  expect(Dialog.show).toHaveBeenCalledWith({
    title: 'docRepo.file.error.formatNotSupported.title',
    html: 'invalid'
  })
})

test('Shows error for mixed supported and unsupported documents', async () => {
  // Mock pickFile to return mix of supported and unsupported files
  window.api.file.pickFile = vi.fn(() => ['file', 'invalid1', 'invalid2'])
  
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .list-item:nth-child(1)').trigger('click')
  await wrapper.find('.split-pane .sp-main button[name=addDocs]').trigger('click')
  
  expect(window.api.docrepo.isSourceSupported).toHaveBeenCalledWith('file', 'file')
  expect(window.api.docrepo.isSourceSupported).toHaveBeenCalledWith('file', 'invalid1')
  expect(window.api.docrepo.isSourceSupported).toHaveBeenCalledWith('file', 'invalid2')
  expect(window.api.docrepo.addDocument).not.toHaveBeenCalled()
  expect(Dialog.show).toHaveBeenCalledWith({
    title: 'docRepo.file.error.formatNotSupported.title',
    html: 'invalid1<br/>invalid2'
  })
})

test('Deletes documents', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .list-item:nth-child(2)').trigger('click')
  await wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(1) .actions .icon.remove').trigger('click')
  expect(Dialog.show).toHaveBeenCalled()
  // Wait for the dialog promise to resolve and the delete to be called
  await vi.waitUntil(() => (window.api.docrepo.removeDocument as Mock).mock.calls.length > 0)
  expect(window.api.docrepo.removeDocument).toHaveBeenLastCalledWith('uuid2', 'uuid3')
  await wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(2) .actions .icon.remove').trigger('click')
  expect(Dialog.show).toHaveBeenCalled()
  // Wait for the second delete call
  await vi.waitUntil(() => (window.api.docrepo.removeDocument as Mock).mock.calls.length > 1)
  expect(window.api.docrepo.removeDocument).toHaveBeenLastCalledWith('uuid2', 'uuid4')
})

test('Opens files and folders in explorer', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .list-item:nth-child(2)').trigger('click')
  
  // Test opening file in explorer
  await wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(1) .actions .icon.open-in-explorer').trigger('click')
  expect(window.api.file.openInExplorer).toHaveBeenCalledWith('/tmp/file1')
  
  // Test opening folder in explorer
  await wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(2) .actions .icon.open-in-explorer').trigger('click')
  expect(window.api.file.openInExplorer).toHaveBeenCalledWith('/tmp/folder1')
})

test('Shows folder contents modal', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  await wrapper.find('.split-pane .list-item:nth-child(2)').trigger('click')
  
  // Check that folder has view contents action
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(2) .actions .icon.view-contents').exists()).toBe(true)
  
  // Check that file does not have view contents action
  // @ts-expect-error cast missing
  expect(wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(1) .actions .icon.view-contents').element.style.visibility).toBe('hidden')
  
  // Click view contents for folder
  await wrapper.find('.split-pane .sp-main .documents .panel-item:nth-child(2) .actions .icon.view-contents').trigger('click')
  
  // Check that the folder modal is displayed and has correct content
  const folderComponent = wrapper.findComponent({ name: 'Folder' })
  expect(folderComponent.exists()).toBe(true)
  expect(folderComponent.props('folder')).toBeDefined()
  expect(folderComponent.props('folder').type).toBe('folder')
  expect(folderComponent.props('folder').title).toBe('folder1')
})

test('Shows pencil icon for title editing', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  // First repo should be auto-selected
  expect(wrapper.vm.selectedRepo?.name).toBe('docrepo1')
  expect(wrapper.find('.split-pane .sp-main header .title-display .title').text()).toBe('docrepo1')
  expect(wrapper.find('.split-pane .sp-main header .title-display .edit-title').exists()).toBe(true)
})

test('Enters edit mode when pencil is clicked', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  // First repo should be auto-selected
  expect(wrapper.vm.isEditingTitle).toBe(false)
  
  // Click the pencil icon
  await wrapper.find('.split-pane .sp-main header .title-display .edit-title').trigger('click')
  expect(wrapper.vm.isEditingTitle).toBe(true)
  
  // Check that input field is shown
  expect(wrapper.find('.split-pane .sp-main header .title-edit input').exists()).toBe(true)
  expect(wrapper.find<HTMLInputElement>('.split-pane .sp-main header .title-edit input').element.value).toBe('docrepo1')
  
  // Check that action buttons are shown
  expect(wrapper.find('.split-pane .sp-main header .title-edit .actions .cancel').exists()).toBe(true)
  expect(wrapper.find('.split-pane .sp-main header .title-edit .actions .save').exists()).toBe(true)
})

test('Cancels editing when cancel button is clicked', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  
  // Enter edit mode
  await wrapper.find('.split-pane .sp-main header .title-display .edit-title').trigger('click')
  expect(wrapper.vm.isEditingTitle).toBe(true)
  
  // Change the input value
  await wrapper.find('.split-pane .sp-main header .title-edit input').setValue('changed-name')
  
  // Click cancel
  await wrapper.find('.split-pane .sp-main header .title-edit .actions .cancel').trigger('click')
  
  // Should exit edit mode without saving
  expect(wrapper.vm.isEditingTitle).toBe(false)
  expect(wrapper.vm.selectedRepo?.name).toBe('docrepo1') // Should remain unchanged
  expect(window.api.docrepo.update).not.toHaveBeenCalled()
})

test('Saves changes when save button is clicked', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  
  // Enter edit mode
  await wrapper.find('.split-pane .sp-main header .title-display .edit-title').trigger('click')
  expect(wrapper.vm.isEditingTitle).toBe(true)
  
  // Change the input value
  await wrapper.find('.split-pane .sp-main header .title-edit input').setValue('new-name')
  
  // Click save
  await wrapper.find('.split-pane .sp-main header .title-edit .actions .save').trigger('click')
  
  // Should exit edit mode and save
  expect(wrapper.vm.isEditingTitle).toBe(false)
  expect(window.api.docrepo.update).toHaveBeenLastCalledWith('uuid1', 'new-name', undefined)
})

test('Saves changes when Enter key is pressed', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)
  
  // Enter edit mode
  await wrapper.find('.split-pane .sp-main header .title-display .edit-title').trigger('click')
  expect(wrapper.vm.isEditingTitle).toBe(true)
  
  // Change the input value
  const input = wrapper.find('.split-pane .sp-main header .title-edit input')
  await input.setValue('enter-save-name')
  
  // Press Enter
  await input.trigger('keyup.enter')
  await nextTick()
  
  // Should exit edit mode and save
  expect(wrapper.vm.isEditingTitle).toBe(false)
  expect(window.api.docrepo.update).toHaveBeenLastCalledWith('uuid1', 'enter-save-name', undefined)
})

test('Cancels editing when Escape key is pressed', async () => {
  const wrapper: VueWrapper<any> = mount(DocRepos)
  await vi.waitUntil(async () => wrapper.vm.docRepos != null)

  // Enter edit mode
  await wrapper.find('.split-pane .sp-main header .title-display .edit-title').trigger('click')
  expect(wrapper.vm.isEditingTitle).toBe(true)

  // Change the input value
  const input = wrapper.find('.split-pane .sp-main header .title-edit input')
  await input.setValue('escape-cancel-name')

  // Press Escape
  await input.trigger('keyup.escape')
  await nextTick()

  // Should exit edit mode without saving
  expect(wrapper.vm.isEditingTitle).toBe(false)
  expect(wrapper.vm.selectedRepo?.name).toBe('docrepo1') // Should remain unchanged
  expect(window.api.docrepo.update).not.toHaveBeenCalled()
})
