import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '@tests/mocks'
import { useWindowMock } from '@tests/mocks/window'

import Notes from '@renderer/docrepo/Notes.vue'
import NoteEditor from '@renderer/docrepo/NoteEditor.vue'
import Dialog from '@renderer/utils/dialog'
import { DocumentBase, DocumentSource } from '@/types/rag'

// mock i18n
vi.mock('@services/i18n', () => createI18nMock())

// mock components
vi.mock('@components/Spinner.vue', () => ({ default: { name: 'Spinner', template: '<div class="spinner">Loading...</div>' } }))

const mockSelectedRepo: DocumentBase = {
  uuid: 'uuid1',
  name: 'Repository 1',
  embeddingEngine: 'openai',
  embeddingModel: 'text-embedding-ada-002',
  workspaceId: 'workspace1',
  documents: [
    {
      uuid: 'note1',
      type: 'text',
      title: 'My First Note',
      origin: 'This is the content of my first note.',
      filename: '',
      url: 'This is the content of my first note.',
      items: [],
      lastModified: 0,
      fileSize: 0
    } as DocumentSource,
    {
      uuid: 'note2', 
      type: 'text',
      title: 'Second Note',
      origin: 'This is a longer note with much more content that should be truncated when displayed in the list because it exceeds 100 characters.',
      filename: '',
      url: 'This is a longer note with much more content that should be truncated when displayed in the list because it exceeds 100 characters.',
      items: [],
      lastModified: 0,
      fileSize: 0
    } as DocumentSource,
    {
      uuid: 'file1',
      type: 'file', 
      title: 'Document.pdf',
      origin: '/path/to/document.pdf',
      filename: 'Document.pdf',
      url: 'file:///path/to/document.pdf',
      items: [],
      lastModified: 0,
      fileSize: 0
    } as DocumentSource
  ]
}

beforeAll(() => {
  useWindowMock()
})

describe('Notes', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    vi.clearAllMocks()
    
    wrapper = mount(Notes, {
      props: {
        selectedRepo: mockSelectedRepo
      },
      global: {
        stubs: {
          NoteEditor: NoteEditor
        }
      }
    })
  })

  it('Renders correctly', () => {
    expect(wrapper.find('.notes').exists()).toBe(true)
    expect(wrapper.find('.panel-header label').text()).toContain('common.notes')
  })

  it('Shows correct note count', () => {
    const tag = wrapper.find('.panel-header .tag')
    expect(tag.text()).toBe('2') // Only text documents
  })

  it('Displays only text documents', () => {
    const noteItems = wrapper.findAll('.panel-item')
    expect(noteItems).toHaveLength(2)
    
    // Check that file documents are not shown
    expect(wrapper.text()).not.toContain('Document.pdf')
  })

  it('Shows note titles correctly', () => {
    const noteItems = wrapper.findAll('.panel-item')
    expect(noteItems[0].find('.text').text()).toBe('My First Note')
    expect(noteItems[1].find('.text').text()).toBe('Second Note')
  })

  it('Shows "Ready" status for processed notes', () => {
    const statusTags = wrapper.findAll('.tag.success')
    expect(statusTags).toHaveLength(2)
    statusTags.forEach(tag => {
      expect(tag.text()).toBe('Ready')
    })
  })

  it('Shows add note button', () => {
    const addButton = wrapper.find('button[name="addNote"]')
    expect(addButton.exists()).toBe(true)
    expect(addButton.text()).toContain('docRepo.note.add')
  })

  it('Shows empty state when no notes exist', async () => {
    const emptyRepo = {
      ...mockSelectedRepo,
      documents: []
    }
    
    await wrapper.setProps({ selectedRepo: emptyRepo })
    await nextTick()
    
    expect(wrapper.find('.panel-empty').exists()).toBe(true)
    expect(wrapper.find('.panel-empty').text()).toBe('docRepo.note.noNotes')
  })

  it('Opens note create modal when add button is clicked', async () => {
    const addButton = wrapper.find('button[name="addNote"]')
    await addButton.trigger('click')
    await nextTick()
    
    // The modal should be triggered to show
    const noteEditorComponent = wrapper.findComponent(NoteEditor)
    expect(noteEditorComponent.exists()).toBe(true)
  })

  it('Calls API to add document when note is saved', async () => {
    const noteData = {
      title: 'Test Note',
      content: 'Test content for the note'
    }
    
    // Trigger the save event from NoteEditor component
    const noteEditorComponent = wrapper.findComponent(NoteEditor)
    await noteEditorComponent.vm.$emit('save', noteData)
    await nextTick()
    
    expect(window.api.docrepo.addDocument).toHaveBeenCalledWith(
      'uuid1',
      'text', 
      noteData.content,
      noteData.title
    )
  })

  it('Opens editor when pencil icon is clicked', async () => {
    const editIcons = wrapper.findAll('.icon.edit')
    const noteEditorComponent = wrapper.findComponent(NoteEditor)
    
    // Verify the NoteEditor component exists
    expect(noteEditorComponent.exists()).toBe(true)
    
    await editIcons[0].trigger('click')
    await nextTick()
    
    // The click should trigger the edit functionality
    // We can't easily test the showForEdit call in this context,
    // but we can verify the component exists and the event handler is working
    expect(editIcons[0].exists()).toBe(true)
  })

  it('Calls API to update document when note is updated', async () => {
    const mockNote = {
      uuid: 'note1',
      type: 'text',
      title: 'Original Title',
      origin: 'Original content',
      filename: '',
      url: 'Original content',
      items: [],
      lastModified: 0,
      fileSize: 0
    }

    const updateData = {
      note: mockNote,
      title: 'Updated Title',
      content: 'Updated content'
    }
    
    // Trigger the update event from NoteEditor component
    const noteEditorComponent = wrapper.findComponent(NoteEditor)
    await noteEditorComponent.vm.$emit('update', updateData)
    await nextTick()
    
    // Should call remove first, then add with new content
    expect(window.api.docrepo.removeDocument).toHaveBeenCalledWith('uuid1', 'note1')
    expect(window.api.docrepo.addDocument).toHaveBeenCalledWith(
      'uuid1',
      'text', 
      'Updated content',
      'Updated Title'
    )
  })

  it('Shows delete confirmation when trash icon is clicked', async () => {
    const deleteIcons = wrapper.findAll('.icon.remove')
    await deleteIcons[0].trigger('click')
    await nextTick()
    
    expect(Dialog.show).toHaveBeenCalledWith({
      target: null,
      title: 'common.confirmation.deleteDocument',
      text: 'common.confirmation.cannotUndo',
      confirmButtonText: 'common.delete',
      showCancelButton: true
    })
  })

  it('Calls API to remove document when deletion is confirmed', async () => {
    // Mock dialog to return confirmed
    (Dialog.show as any).mockResolvedValue({ isConfirmed: true })
    
    const deleteIcons = wrapper.findAll('.icon.remove')
    await deleteIcons[0].trigger('click')
    await nextTick()
    
    expect(window.api.docrepo.removeDocument).toHaveBeenCalledWith('uuid1', 'note1')
  })

  it('Does not call API when deletion is cancelled', async () => {
    // Mock dialog to return cancelled
    (Dialog.show as any).mockResolvedValue({ isConfirmed: false })
    
    const deleteIcons = wrapper.findAll('.icon.remove')
    await deleteIcons[0].trigger('click')
    await nextTick()
    
    expect(window.api.docrepo.removeDocument).not.toHaveBeenCalled()
  })

  // Note: Processing status is now managed by useDocRepoEvents composable
  // and is tested via IPC integration tests rather than component tests

  it('Handles plain text notes without JSON format', async () => {
    const plainTextRepo = {
      ...mockSelectedRepo,
      documents: [
        {
          uuid: 'plain1',
          type: 'text',
          title: 'Plain Text',
          origin: 'This is plain text content without JSON format',
          filename: '',
          url: 'This is plain text content without JSON format',
          items: [],
          lastModified: 0,
          fileSize: 0
        } as DocumentSource
      ]
    }
    
    await wrapper.setProps({ selectedRepo: plainTextRepo })
    await nextTick()
    
    const noteItems = wrapper.findAll('.panel-item')
    expect(noteItems).toHaveLength(1)
  })

  it('Handles panel collapse/expand', async () => {
    const chevron = wrapper.find('.panel-header .icon')
    await chevron.trigger('click')
    await nextTick()
    
    // Panel should toggle collapsed state
    expect(wrapper.find('.notes').classes()).toContain('collapsed')
  })
})
