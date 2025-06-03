<template>
  <div class="tool-container" @click="toggleOpen">
    <div class="tool-header">
      <div class="tool-name">{{ name }}</div>
      <div v-if="!toolCall.done" class="tool-loader">
        <Loader /><Loader /><Loader />
      </div>
      <BIconChevronDown v-else-if="!isOpen" class="tool-unfold"/>
      <BIconChevronUp v-else class="tool-fold" />
    </div>
    <div class="tool-values tool-params" v-if="toolCall?.params && isOpen">
      <div class="tool-values-header">
        {{ t('message.toolCall.params') }}
      </div>
      <div class="tool-values-list">
        <div class="tool-value" v-for="(value, key) in toolCall.params" :key="key">
          <div class="value-key">{{ key }}</div>
          <div class="value-value">{{ value }}</div>
        </div>
      </div>
    </div>
    <div class="tool-values tool-result" v-if="toolCall?.result && isOpen">
      <div class="tool-values-header">
        {{ t('message.toolCall.results') }}
      </div>
      <div class="tool-values-list">
        <div class="tool-value" v-for="(value, key) in toolCall.result" :key="key">
          <div class="value-key">{{ key }}</div>
          <div class="value-value">{{ value }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ToolCall } from '../types/index'
import { ref, onMounted, computed } from 'vue'
import { t } from '../services/i18n'
import Loader from './Loader.vue'

const props = defineProps({
  toolCall: {
    type: Object as () => ToolCall,
    required: true,
  },
})

const isOpen = ref(false)

const name = computed(() => {
  if (props.toolCall.status) return props.toolCall.status
  const toolName = props.toolCall.name || ''
  const name = window.api.mcp.originalToolName(toolName)
  return t('message.toolCall.call', { name })
})

onMounted(() => {
  const opened = JSON.parse(window.localStorage.getItem('opened-tools') || '[]')
  isOpen.value = opened.includes(props.toolCall.id)
})

const toggleOpen = () => {
  isOpen.value = !isOpen.value
  const opened = JSON.parse(window.localStorage.getItem('opened-tools') || '[]')
  if (isOpen.value) {
    if (!opened.includes(props.toolCall.id)) {
      opened.push(props.toolCall.id)
    }
  } else {
    const index = opened.indexOf(props.toolCall.id)
    if (index > -1) {
      opened.splice(index, 1)
    }
  }
  window.localStorage.setItem('opened-tools', JSON.stringify(opened))
}

</script>

<style scoped>

.tool-container {
  width: 100%;
  margin: 1rem 0;
  background-color: color-mix(in srgb, var(--control-border-color), transparent 95%);
  border: 1px solid var(--control-border-color);
  border-radius: 8px;
  font-size: 0.9em;
  cursor: pointer;

  .tool-header {
    display: flex;
    padding: 0.5rem 1rem;
    align-items: center;
    .tool-name {
      flex: 1;
      font-weight: 600;
    }
    .tool-loader {
      height: 1rem;
      display: flex;
      align-items: center;
      gap: 0.33rem;
      .loader {
        width: 0.375rem;
        height: 0.375rem;
        background-color: var(--dimmed-text-color);
      }
    }
  }

  .tool-values {
    border-top: 1px solid var(--control-border-color);
    padding: 0.5rem;

    .tool-values-header {
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    .tool-values-list {

      padding: 0 0.5rem;
      display: grid;
      grid-template-columns: 1fr 4fr;
      gap: 0.5rem;

      .tool-value {
        display: contents;

        .value-key {
          font-weight: 500;
          color: color-mix(in srgb, var(--dimmed-text-color), transparent 20%);
        }

        .value-value {
          color: var(--highlight-color);
        }
      }
    }
  }

}


</style>
