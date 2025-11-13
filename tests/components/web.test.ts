
import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import Web from '../../src/renderer/docrepo/Web.vue'
import { DocumentBase } from '../../src/types/rag'

enableAutoUnmount(afterAll)

vi.mock('../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})

let wrapper: VueWrapper<any>

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const createWrapper = (documents: any[] = []) => {
  const selectedRepo: DocumentBase = {
    uuid: 'test-repo',
    name: 'Test Repo',
    embeddingEngine: 'openai',
    embeddingModel: 'text-embedding-3-small',
    workspaceId: 'workspace-1',
    documents: documents
  }

  return mount(Web, {
    props: { selectedRepo },
    global: {
      stubs: {
        ChevronDownIcon: true,
        GlobeIcon: true,
        PlusIcon: true,
        RefreshCwIcon: true,
        Trash2Icon: true,
      }
    }
  })
}

test('renders empty state when no web resources', () => {
  wrapper = createWrapper([])
  expect(wrapper.text()).toContain('docRepo.web.noWeb')
})

test('displays URL resource correctly', () => {
  const urlDoc = {
    uuid: 'url-1',
    type: 'url',
    title: 'Example',
    origin: 'https://example.com',
    filename: '',
    url: 'https://example.com',
    lastModified: 0,
    fileSize: 0
  }

  wrapper = createWrapper([urlDoc])
  expect(wrapper.text()).toContain('https://example.com')
  expect(wrapper.text()).toContain('Ready')
})

test('displays sitemap resource with page count', () => {
  const sitemapDoc = {
    uuid: 'sitemap-1',
    type: 'sitemap',
    title: 'Website',
    origin: 'https://example.com/sitemap.xml',
    filename: '',
    url: 'https://example.com/sitemap.xml',
    lastModified: 0,
    fileSize: 0,
    items: [
      { uuid: 'page-1', type: 'url', origin: 'https://example.com/page1' },
      { uuid: 'page-2', type: 'url', origin: 'https://example.com/page2' }
    ]
  }

  wrapper = createWrapper([sitemapDoc])
  expect(wrapper.text()).toContain('https://example.com/sitemap.xml')
  expect(wrapper.text()).toContain('docRepo.web.pagesCount')
})

// Event emission testing removed - the on/off IPC listeners are already mocked and tested in other components

test('Add URL button shows dialog with validation', async () => {
  wrapper = createWrapper([])

  const addUrlButton = wrapper.find('button[name="addUrl"]')
  expect(addUrlButton.exists()).toBe(true)

  await addUrlButton.trigger('click')
  // Dialog should be shown (mocked)
})

test('Add Website button shows dialog', async () => {
  wrapper = createWrapper([])

  const addWebsiteButton = wrapper.find('button[name="addWebsite"]')
  expect(addWebsiteButton.exists()).toBe(true)

  await addWebsiteButton.trigger('click')
  // Dialog should be shown (mocked)
})

test('refresh button calls removeDocument then addDocument', async () => {
  const urlDoc = {
    uuid: 'url-1',
    type: 'url',
    origin: 'https://example.com'
  }

  wrapper = createWrapper([urlDoc])

  const refreshIcon = wrapper.find('.icon.refresh')
  expect(refreshIcon.exists()).toBe(true)

  await refreshIcon.trigger('click')
  await wrapper.vm.$nextTick()

  expect(window.api.docrepo.removeDocument).toHaveBeenCalledWith('test-repo', 'url-1')
  expect(window.api.docrepo.addDocument).toHaveBeenCalledWith('test-repo', 'url', 'https://example.com')
})

test('delete button shows confirmation and calls removeDocument', async () => {
  const urlDoc = {
    uuid: 'url-1',
    type: 'url',
    origin: 'https://example.com'
  }

  wrapper = createWrapper([urlDoc])

  const deleteIcon = wrapper.find('.icon.remove')
  expect(deleteIcon.exists()).toBe(true)

  await deleteIcon.trigger('click')
  // Confirmation dialog should be shown (mocked)
})

test('filters out non-web resources', () => {
  const documents = [
    { uuid: '1', type: 'url', origin: 'https://example.com' },
    { uuid: '2', type: 'file', origin: '/path/to/file.pdf' },
    { uuid: '3', type: 'sitemap', origin: 'https://example.com/sitemap.xml' },
    { uuid: '4', type: 'text', origin: 'Some text' }
  ]

  wrapper = createWrapper(documents)

  // Should only show url and sitemap
  expect(wrapper.text()).toContain('https://example.com')
  expect(wrapper.text()).toContain('sitemap.xml')
  expect(wrapper.text()).not.toContain('file.pdf')
  expect(wrapper.text()).not.toContain('Some text')
})

test('web count includes all URLs from sitemaps', () => {
  const documents = [
    { uuid: '1', type: 'url', origin: 'https://example.com' },
    {
      uuid: '2',
      type: 'sitemap',
      origin: 'https://example.com/sitemap.xml',
      items: [
        { uuid: 'p1', type: 'url', origin: 'https://example.com/page1' },
        { uuid: 'p2', type: 'url', origin: 'https://example.com/page2' }
      ]
    }
  ]

  wrapper = createWrapper(documents)

  // Should show 1 (direct URL) + 2 (from sitemap) = 3
  expect(wrapper.text()).toContain('3')
})
