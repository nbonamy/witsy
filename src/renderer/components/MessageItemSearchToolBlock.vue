<template>
  <div class="tool-search">
    <div class="tool-search-result" v-for="result in toolCall.result.results" :key="result.url">
      <a :href="result.url" target="_blank" rel="noopener noreferrer" class="result-link" @click.stop>
        <img :src="getFaviconUrl(result.url)" class="favicon" @error="onFaviconError" />
        <span class="result-title">{{ result.title }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ToolCall } from 'types/index'

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
  img.src = 'https://icons.veryicon.com/png/o/miscellaneous/foundation-icon-5/link-86.png'
}

</script>

<style scoped>

.tool-search {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tool-search-result a {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
}

.result-title {
  font-size: 14px;
  line-height: 1.4;
  white-space: nowrap;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
}

</style>
