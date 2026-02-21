<template>
  <div v-if="visible" class="search-nav">
    <input v-if="searchState?.localSearch.value" ref="searchInput" class="search-input" type="text" :placeholder="t('common.search')"
      :value="searchState?.filter.value ?? ''" @input="onLocalSearchInput" @keydown="onLocalSearchKeyDown" />
    <span v-if="searchMatchCount > 0" class="match-count">{{ t('chat.search.matchCount', { current: searchCurrentIndex + 1, total: searchMatchCount }) }}</span>
    <span v-else class="match-count">{{ t('chat.search.noMatches') }}</span>
    <ButtonIcon class="nav-prev" @click="navigateMatch(-1)" v-tooltip="{ text: t('chat.search.previousMatch'), position: 'left' }">
      <ArrowUpIcon />
    </ButtonIcon>
    <ButtonIcon class="nav-next" @click="navigateMatch(1)" v-tooltip="{ text: t('chat.search.nextMatch'), position: 'right' }">
      <ArrowDownIcon />
    </ButtonIcon>
    <ButtonIcon class="nav-close" @click="closeSearch">
      <XIcon />
    </ButtonIcon>
  </div>
</template>

<script setup lang="ts">

import Chat from '@models/chat'
import { SearchState } from '@screens/Chat.vue'
import { t } from '@services/i18n'
import { ArrowDownIcon, ArrowUpIcon, XIcon } from 'lucide-vue-next'
import { computed, inject, nextTick, ref, watch } from 'vue'
import ButtonIcon from './ButtonIcon.vue'

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
const searchInput = ref<HTMLInputElement | null>(null)
const visible = computed(() => searchState?.localSearch.value || searchMatchCount.value > 0)
const searchCurrentIndex = ref(-1)
const searchMatchCount = ref(0)
const searchMarks = ref<HTMLElement[]>([])
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

const onLocalSearchInput = (e: Event) => {
  if (!searchState) return
  const value = (e.target as HTMLInputElement).value.trim()
  searchState.filter.value = value || null
}

const onLocalSearchKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    navigateMatch(e.shiftKey ? -1 : 1)
  } else if (e.key === 'Escape') {
    closeSearch()
  }
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
      searchInput.value?.focus()
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

  .search-input {
    outline: none;
    border: 0.75px solid var(--control-border-color);
    border-radius: 0px;
    background: transparent;
    color: var(--text-color);
    font-size: var(--font-size-12);
    width: 8rem;
    padding: 0.25rem 0.5rem;
    margin-right: 0.5rem;
  }

  .match-count {
    margin-right: 0.5rem;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &:has(.search-input) {
    .match-count {
      min-width: 64px;
    }
  }
}

</style>
