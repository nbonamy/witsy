import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, test, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { useDocRepoEvents } from '@composables/useDocRepoEvents'
import { useWindowMock } from '@tests/mocks/window'

// Mock dialog
vi.mock('@renderer/utils/dialog', () => ({
  default: {
    alert: vi.fn(() => Promise.resolve()),
  }
}))

beforeAll(() => {
  useWindowMock()
})

describe('useDocRepoEvents', () => {

  // Create a test component that uses the composable
  const TestComponent = defineComponent({
    setup() {
      const events = useDocRepoEvents()
      return { ...events }
    },
    template: '<div></div>'
  })

  test('initializes with default values', () => {
    const wrapper = mount(TestComponent)

    expect(wrapper.vm.loading).toBe(false)
    expect(wrapper.vm.processingItems).toEqual([])
    expect(wrapper.vm.processingBases).toEqual([])

    wrapper.unmount()
  })

  test('onMounted - registers event listeners', async () => {
    const wrapper = mount(TestComponent)

    expect(window.api._on).toHaveBeenCalledWith('docrepo-process-item-start', expect.any(Function))
    expect(window.api._on).toHaveBeenCalledWith('docrepo-process-item-done', expect.any(Function))
    expect(window.api._on).toHaveBeenCalledWith('docrepo-add-document-done', expect.any(Function))
    expect(window.api._on).toHaveBeenCalledWith('docrepo-add-document-error', expect.any(Function))
    expect(window.api._on).toHaveBeenCalledWith('docrepo-del-document-done', expect.any(Function))
    expect(window.api.docrepo.getCurrentQueueItem).toHaveBeenCalled()

    wrapper.unmount()
  })

  test('onMounted - processes current queue item if exists', async () => {
    vi.mocked(window.api.docrepo.getCurrentQueueItem).mockResolvedValueOnce({
      uuid: 'doc1',
      baseId: 'base1',
      type: 'file',
      origin: '/tmp/file1'
    } as any)

    const wrapper = mount(TestComponent)
    await nextTick()
    await nextTick()

    expect(wrapper.vm.processingItems).toEqual(['doc1'])
    expect(wrapper.vm.processingBases).toEqual(['base1'])

    wrapper.unmount()
  })

  test('onMounted - processes current queue item with parentDocId', async () => {
    vi.mocked(window.api.docrepo.getCurrentQueueItem).mockResolvedValueOnce({
      uuid: 'doc1',
      baseId: 'base1',
      parentDocId: 'parent1',
      type: 'file',
      origin: '/tmp/file1'
    } as any)

    const wrapper = mount(TestComponent)
    await nextTick()
    await nextTick()

    expect(wrapper.vm.processingItems).toEqual(['parent1'])
    expect(wrapper.vm.processingBases).toEqual(['base1'])

    wrapper.unmount()
  })

  test('onBeforeUnmount - unregisters event listeners', () => {
    const wrapper = mount(TestComponent)

    wrapper.unmount()

    expect(window.api._off).toHaveBeenCalledWith('docrepo-process-item-start', expect.any(String))
    expect(window.api._off).toHaveBeenCalledWith('docrepo-process-item-done', expect.any(String))
    expect(window.api._off).toHaveBeenCalledWith('docrepo-add-document-done', expect.any(String))
    expect(window.api._off).toHaveBeenCalledWith('docrepo-add-document-error', expect.any(String))
    expect(window.api._off).toHaveBeenCalledWith('docrepo-del-document-done', expect.any(String))
  })

  // Note: Event handler tests would require triggering actual window.api events
  // The current implementation registers closures in onMounted that are hard to test in isolation
  // Coverage for event handlers is obtained through integration/E2E tests
  // The main logic covered here is:
  // - Initialization (loading=false, processingItems=[])
  // - Event listener registration/unregistration
  // - Processing of current queue item on mount
})
