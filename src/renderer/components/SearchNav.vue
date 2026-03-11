<template>
  <div v-if="visible" class="search-nav">
    <SearchBar
      ref="searchBarRef"
      :show-input="searchState?.localSearch.value ?? false"
      :query="searchState?.filter.value ?? ''"
      :match-count="searchMatchCount"
      :current-index="searchCurrentIndex"
      @update:query="onQueryChange"
      @navigate="navigateMatch"
      @close="closeSearch"
    />
  </div>
</template>

<script setup lang="ts">

import Chat from '@models/chat'
import { SearchState } from '@screens/Chat.vue'
import { computed, inject, nextTick, ref, watch } from 'vue'
import SearchBar from './SearchBar.vue'

const props = defineProps({
  chat: {
    type: Chat,
    required: true,
  },
  scroller: {
    type: HTMLElement,
    default: null,
  },
})

const searchState = inject<SearchState>('searchState')

// search navigation
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null)
const searchCurrentIndex = ref(-1)
const searchMatchCount = ref(0)
const searchMarks = ref<HTMLElement[]>([])
const visible = computed(() => searchState?.localSearch.value || searchMatchCount.value > 0)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const updateSearchMarks = () => {
  if (!props.scroller) return
  searchMarks.value = Array.from(props.scroller.querySelectorAll('mark'))
  searchMatchCount.value = searchMarks.value.length
}

const getOffsetTop = (element: HTMLElement, container: HTMLElement): number => {
  let top = 0
  let el: HTMLElement | null = element
  while (el && el !== container) {
    top += el.offsetTop
    el = el.offsetParent as HTMLElement | null
  }
  return top
}

const scrollToCurrentMatch = () => {
  searchMarks.value.forEach(m => m.classList.remove('active'))
  if (searchCurrentIndex.value >= 0 && searchCurrentIndex.value < searchMarks.value.length) {
    const mark = searchMarks.value[searchCurrentIndex.value]
    mark.classList.add('active')
    if (props.scroller) {
      const markTop = getOffsetTop(mark, props.scroller)
      const scrollTarget = markTop - props.scroller.clientHeight / 2
      props.scroller.scrollTo?.({ top: scrollTarget, behavior: 'auto' })
    }
  }
}

const onQueryChange = (value: string) => {
  if (!searchState) return
  searchState.filter.value = value.trim() || null
}

const closeSearch = () => {
  if (!searchState) return
  searchState.localSearch.value = false
  searchState.filter.value = null
}

const navigateMatch = (direction: number) => {
  if (searchMatchCount.value === 0) return
  searchCurrentIndex.value = (searchCurrentIndex.value + direction + searchMatchCount.value) % searchMatchCount.value
  scrollToCurrentMatch()
}

const resetAndScanMarks = async () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchCurrentIndex.value = -1
  searchMatchCount.value = 0
  searchMarks.value = []
  if (searchState?.filter.value) {
    await nextTick()
    searchTimeout = setTimeout(() => {
      updateSearchMarks()
      if (searchMatchCount.value > 0) {
        searchCurrentIndex.value = 0
        scrollToCurrentMatch()
      }
    }, 200)
  }
}

if (searchState) {
  watch(searchState.filter, (filter) => {
    if (!filter) {
      searchMarks.value.forEach(m => m.classList.remove('active'))
    }
    resetAndScanMarks()
  })

  watch(searchState.navigate, (direction) => {
    if (direction !== 0) {
      navigateMatch(direction)
      searchState.navigate.value = 0
    }
  })

  watch(searchState.localSearch, async (active) => {
    if (active) {
      await nextTick()
      searchBarRef.value?.focus()
    }
  })
}

watch(() => props.chat, () => {
  resetAndScanMarks()
})

</script>

<style scoped>

.search-nav {
  position: absolute;
  top: calc(var(--split-pane-header-height) + 2rem);
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0rem;
  padding: 0.25rem 0.5rem;
  padding-left: 1rem;
  background-color: var(--message-list-bg-color);
  border: 1px solid var(--message-list-overflow-border-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-top: none;
  font-size: var(--font-size-12);
  color: var(--text-color);
  z-index: 1;

  &:has(.search-input) {
    padding-left: 0.75rem;
  }

  &:has(.search-input) {
    :deep(.match-count) {
      min-width: 64px;
    }
  }
}

</style>
