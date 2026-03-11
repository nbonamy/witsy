<template>
  <div class="search-bar">
    <input
      v-if="showInput"
      ref="searchInput"
      type="text"
      class="search-input"
      :placeholder="t('common.search')"
      :value="query"
      @input="onInput"
      @keydown="onKeyDown"
    />
    <span v-if="matchCount > 0" class="match-count">
      {{ t('chat.search.matchCount', { current: currentIndex + 1, total: matchCount }) }}
    </span>
    <span v-else-if="showInput" class="match-count">
      {{ t('chat.search.noMatches') }}
    </span>
    <ButtonIcon class="nav-prev" @click="emit('navigate', -1)" :disabled="matchCount === 0" v-tooltip="{ text: t('chat.search.previousMatch'), position: 'left' }">
      <ArrowUpIcon />
    </ButtonIcon>
    <ButtonIcon class="nav-next" @click="emit('navigate', 1)" :disabled="matchCount === 0" v-tooltip="{ text: t('chat.search.nextMatch'), position: 'right' }">
      <ArrowDownIcon />
    </ButtonIcon>
    <ButtonIcon class="nav-close" @click="emit('close')">
      <XIcon />
    </ButtonIcon>
  </div>
</template>

<script setup lang="ts">
import { t } from '@services/i18n'
import { ArrowDownIcon, ArrowUpIcon, XIcon } from 'lucide-vue-next'
import { ref } from 'vue'
import ButtonIcon from './ButtonIcon.vue'

defineProps({
  showInput: {
    type: Boolean,
    default: true,
  },
  query: {
    type: String,
    default: '',
  },
  matchCount: {
    type: Number,
    default: 0,
  },
  currentIndex: {
    type: Number,
    default: -1,
  },
})

const emit = defineEmits<{
  'update:query': [value: string]
  'navigate': [direction: number]
  'close': []
}>()

const searchInput = ref<HTMLInputElement | null>(null)

const onInput = (e: Event) => {
  emit('update:query', (e.target as HTMLInputElement).value)
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    emit('navigate', e.shiftKey ? -1 : 1)
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

const focus = () => {
  searchInput.value?.focus()
  searchInput.value?.select()
}

defineExpose({ focus })
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 0rem;
  font-size: var(--font-size-12);
  color: var(--text-color);
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
</style>
