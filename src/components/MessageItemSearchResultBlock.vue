<template>
  <div class="tool-search-result">
    <div class="tool-search-result-icons">
      <img v-for="result in toolCall.result.results" :src="getFaviconUrl(result.url)" class="favicon" @error="onFaviconError" />
    </div>
    {{ t('plugins.search.completed', { query: toolCall.params.query, count: toolCall.result.results.length }) }}
  </div>
</template>

<script setup lang="ts">

import { ToolCall } from '../types/index'
import { t } from '../services/i18n'

defineProps({
  toolCall: {
    type: Object as () => ToolCall,
    required: true,
  },
})

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
  padding: 0.5rem 0px;
  padding-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--faded-text-color);
  font-size: .9em;
}

.tool-search-result-icons {
  display: flex;
  align-items: center;
  gap: -0.25rem;
}

.favicon {
  margin-left: -0.375rem;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  border-radius: 0.5rem;
  border: 1.5px solid var(--message-list-bg-color);

  &:first-child {
    margin-left: 0px;
  }
}

</style>
