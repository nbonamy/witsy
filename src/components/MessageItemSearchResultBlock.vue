<template>
  <div v-if="!expanded" class="tool-search-result" @click="expanded = true">
    <div class="tool-search-result-icons">
      <img v-for="result in toolCall.result.results" :src="getFaviconUrl(result.url)" class="favicon" @error="onFaviconError" />
    </div>
    {{ t('plugins.search.completed', { query: toolCall.params.query, count: toolCall.result.results.length }) }}
  </div>
  <div v-else class="expanded">
    <div class="header" @click="expanded = false">
      <XIcon class="close" />
      {{ t('plugins.search.completed', { query: toolCall.params.query, count: toolCall.result.results.length }) }}
    </div>
    <MessageItemSearchToolBlock class="results" :tool-call="toolCall"  />
  </div>
</template>

<script setup lang="ts">

import { XIcon } from 'lucide-vue-next'
import { ref } from 'vue'
import { t } from '../services/i18n'
import { ToolCall } from '../types/index'
import MessageItemSearchToolBlock from './MessageItemSearchToolBlock.vue'

defineProps({
  toolCall: {
    type: Object as () => ToolCall,
    required: true,
  },
})

const expanded = ref(false)

const getFaviconUrl = (url: string): string => {
  return `https://s2.googleusercontent.com/s2/favicons?domain_url=${url}`
}

const onFaviconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.remove()
}

</script>

<style scoped>

.tool-search-result {
  margin: 1rem 0px;
  padding: 0.5rem 0px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--faded-text-color);
  font-size: .9em;
  cursor: pointer;
}

.tool-search-result-icons {
  display: flex;
  align-items: center;
  gap: -0.25rem;
}

.favicon {
  margin-left: -0.375rem;
  width: var(--icon-md);
  height: var(--icon-md);
  flex-shrink: 0;
  border-radius: 0.5rem;
  border: 1.5px solid var(--message-list-bg-color);

  &:first-child {
    margin-left: 0px;
  }
}

.expanded {
  margin: 1rem 0px;
  border: 1px solid var(--control-border-color);
  border-radius: 8px;
  position: relative;

  .header {
    background-color: color-mix(in srgb, var(--control-border-color), transparent 80%);
    padding: 0.5rem 1rem;
    font-size: .9em;
    cursor: pointer;
  }

  .close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    color: var(--dimmed-text-color);
  }

  .results {
    padding: 1rem;
  }
}

</style>
