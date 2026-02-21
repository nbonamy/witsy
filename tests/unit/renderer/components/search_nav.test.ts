
import { vi, beforeAll, beforeEach, afterAll, afterEach, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { SearchState } from '@/renderer/screens/Chat.vue'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import SearchNav from '@components/SearchNav.vue'
import Chat from '@models/chat'
import { ref } from 'vue'

enableAutoUnmount(afterAll)

const searchState: SearchState = { filter: ref<string | null>(null), navigate: ref(0), localSearch: ref(false) }

let scroller: HTMLDivElement
let wrapper: VueWrapper<any>

const mountNav = (chat?: Chat) => {
  return mount(SearchNav, {
    props: { chat: chat ?? new Chat('SearchNav test'), scroller },
    global: { provide: { searchState } },
  })
}

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  scroller = document.createElement('div')
  document.body.appendChild(scroller)
  wrapper = mountNav()
})

beforeEach(() => {
  vi.clearAllMocks()
  scroller.innerHTML = ''
})

afterEach(() => {
  searchState.filter.value = null
  searchState.navigate.value = 0
  searchState.localSearch.value = false
})

afterAll(() => {
  scroller.remove()
})

test('Not shown when no filter', () => {
  expect(wrapper.find('.search-nav').exists()).toBe(false)
})

test('Not shown when filter set but no matches', async () => {
  searchState.filter.value = 'zzzznotfound'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(false)
  }, { timeout: 500 })
})

test('Shown when marks exist', async () => {
  scroller.innerHTML = '<mark>test</mark> some text <mark>test</mark> more <mark>test</mark>'

  searchState.filter.value = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })
  expect(wrapper.find('.match-count').text()).toContain('chat.search.matchCount')
})

test('Navigate to next match', async () => {
  scroller.innerHTML = '<mark>test</mark> some text <mark>test</mark>'

  searchState.filter.value = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  // first match is active
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)

  // navigate to next
  await wrapper.find('.nav-next').trigger('click')
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(false)
})

test('Navigate wraps around', async () => {
  scroller.innerHTML = '<mark>test</mark> some text <mark>test</mark>'

  searchState.filter.value = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  // navigate to last
  await wrapper.find('.nav-next').trigger('click')
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)

  // navigate past last wraps to first
  await wrapper.find('.nav-next').trigger('click')
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)

  // navigate before first wraps to last
  await wrapper.find('.nav-prev').trigger('click')
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)
})

test('Disappears when filter cleared', async () => {
  scroller.innerHTML = '<mark>test</mark>'

  searchState.filter.value = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  searchState.filter.value = null
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.search-nav').exists()).toBe(false)
})

test('Re-scans marks on chat change', async () => {
  scroller.innerHTML = '<mark>hello</mark>'

  const chat1 = new Chat('Chat 1')
  const w = mountNav(chat1)
  searchState.filter.value = 'hello'
  await w.vm.$nextTick()
  await vi.waitFor(() => {
    expect(w.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  // switch to another chat and update scroller content
  const chat2 = new Chat('Chat 2')
  scroller.innerHTML = '<mark>hello</mark> <mark>hello</mark>'
  await w.setProps({ chat: chat2 })
  await w.vm.$nextTick()
  await vi.waitFor(() => {
    expect(w.find('.match-count').text()).toContain('chat.search.matchCount')
  }, { timeout: 500 })
  // verify 2 marks were found
  expect(scroller.querySelectorAll('mark.active').length + scroller.querySelectorAll('mark:not(.active)').length).toBe(2)
  w.unmount()
})

test('Navigate triggers via searchState.navigate', async () => {
  scroller.innerHTML = '<mark>test</mark> text <mark>test</mark> text <mark>test</mark>'

  searchState.filter.value = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
  }, { timeout: 500 })

  // first match is active
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)

  // trigger navigate forward
  searchState.navigate.value = 1
  await wrapper.vm.$nextTick()
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)
  expect(searchState.navigate.value).toBe(0)

  // trigger navigate backward
  searchState.navigate.value = -1
  await wrapper.vm.$nextTick()
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)
  expect(searchState.navigate.value).toBe(0)
})

test('Local search shows input when localSearch is true', async () => {
  searchState.localSearch.value = true
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.search-nav').exists()).toBe(true)
  expect(wrapper.find('.search-input').exists()).toBe(true)
})

test('Local search hides input when localSearch is false', async () => {
  searchState.localSearch.value = false
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.search-input').exists()).toBe(false)
})

test('Local search close button clears state', async () => {
  searchState.localSearch.value = true
  searchState.filter.value = 'test'
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.nav-close').exists()).toBe(true)

  await wrapper.find('.nav-close').trigger('click')
  expect(searchState.localSearch.value).toBe(false)
  expect(searchState.filter.value).toBeNull()
})

test('Local search input updates filter', async () => {
  searchState.localSearch.value = true
  await wrapper.vm.$nextTick()

  const input = wrapper.find('.search-input')
  expect(input.exists()).toBe(true)

  // simulate typing
  const inputEl = input.element as HTMLInputElement
  inputEl.value = 'hello'
  await input.trigger('input')

  expect(searchState.filter.value).toBe('hello')
})

test('Local search input clears filter on empty', async () => {
  searchState.localSearch.value = true
  searchState.filter.value = 'something'
  await wrapper.vm.$nextTick()

  const input = wrapper.find('.search-input')
  const inputEl = input.element as HTMLInputElement
  inputEl.value = ''
  await input.trigger('input')

  expect(searchState.filter.value).toBeNull()
})

test('Local search Enter navigates forward', async () => {
  scroller.innerHTML = '<mark>test</mark> text <mark>test</mark>'
  searchState.localSearch.value = true
  searchState.filter.value = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
    expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)
  }, { timeout: 500 })

  await wrapper.find('.search-input').trigger('keydown', { key: 'Enter' })
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)
})

test('Local search Shift+Enter navigates backward', async () => {
  scroller.innerHTML = '<mark>test</mark> text <mark>test</mark>'
  searchState.localSearch.value = true
  searchState.filter.value = 'test'
  await wrapper.vm.$nextTick()
  await vi.waitFor(() => {
    expect(wrapper.find('.search-nav').exists()).toBe(true)
    expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)
  }, { timeout: 500 })

  // navigate forward first
  await wrapper.find('.search-input').trigger('keydown', { key: 'Enter' })
  expect(scroller.querySelectorAll('mark')[1].classList.contains('active')).toBe(true)

  // navigate backward
  await wrapper.find('.search-input').trigger('keydown', { key: 'Enter', shiftKey: true })
  expect(scroller.querySelectorAll('mark')[0].classList.contains('active')).toBe(true)
})

test('Local search Escape closes search', async () => {
  searchState.localSearch.value = true
  searchState.filter.value = 'test'
  await wrapper.vm.$nextTick()

  await wrapper.find('.search-input').trigger('keydown', { key: 'Escape' })
  expect(searchState.localSearch.value).toBe(false)
  expect(searchState.filter.value).toBeNull()
})
