<template>
  <div class="tool-container" :class="{ canceled: toolCall.state === 'canceled' }" @click="toggleOpen" @selectstart="onSelectStart" @mouseup="onMouseUp">
    <div class="tool-header">
      <PluginIcon :tool="name" :tool-call="toolCall"/>
      <div class="tool-name">{{ title }}</div>
      <div v-if="!toolCall.done" class="tool-loader">
        <Loader /><Loader /><Loader />
      </div>
      <ChevronDownIcon v-else-if="!isOpen" class="tool-unfold"/>
      <ChevronRightIcon v-else class="tool-fold" />
    </div>
    <div class="tool-results" v-if="isOpen">
      <MessageItemSearchToolBlock v-if="actualToolCall.name === kSearchPluginName && actualToolCall.result?.results?.length" :toolCall="actualToolCall" /> 
    </div>
    <div class="tool-values tool-params" v-if="actualToolCall?.params && isOpen">
      <div class="tool-values-header">
        {{ t('message.toolCall.params') }}
      </div>
      <div class="tool-values-list">
        <div class="tool-value">
          <div class="value-key">tool</div>
          <div class="value-value">{{ actualToolCall.name }}</div>
        </div>
        <div class="tool-value" v-for="(value, key) in actualToolCall.params" :key="key">
          <div class="value-key">{{ key }}</div>
          <div class="value-value">{{ value }}</div>
        </div>
      </div>
    </div>
    <div class="tool-values tool-result" v-if="actualToolCall?.result && isOpen">
      <div class="tool-values-header">
        {{ t('message.toolCall.results') }}
      </div>
      <div class="tool-values-list">
        <div class="tool-value" v-for="(value, key) in actualToolCall.result" :key="key">
          <div class="value-key">{{ key }}</div>
          <div class="value-value">{{ value }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ChevronDownIcon, ChevronRightIcon } from 'lucide-vue-next'
import { ToolCall } from 'types/index'
import { computed, onMounted, ref } from 'vue'
import { t } from '@services/i18n'
import { kCodeExecutionProxyPluginToolName } from '@services/plugins/code_exec_proxy'
import { kSearchPluginName } from '@services/plugins/search'
import Loader from './Loader.vue'
import MessageItemSearchToolBlock from './MessageItemSearchToolBlock.vue'
import PluginIcon from './PluginIcon.vue'

const props = defineProps({
  toolCall: {
    type: Object as () => ToolCall,
    required: true,
  },
})

const isOpen = ref(false)
const isSelecting = ref(false)

const actualToolCall = computed((): ToolCall => {
  if (props.toolCall.name === kCodeExecutionProxyPluginToolName && props.toolCall.params) {
    return {
      ...props.toolCall,
      name: props.toolCall.params.tool_name,
      params: props.toolCall.params.parameters || {},
    }
  } else {
    return props.toolCall
  }
})

const name = computed(() => {
  if (props.toolCall.status?.includes('MCP')) {
    return 'mcp'
  } else {
    return actualToolCall.value.name || ''
  }
})

const title = computed(() => {
  if (props.toolCall.status) return props.toolCall.status
  const toolName = actualToolCall.value.name || ''
  const name = window.api.mcp.originalToolName(toolName)
  return t('message.toolCall.call', { name })
})

onMounted(() => {
  const opened = JSON.parse(window.sessionStorage.getItem('opened-tools') || '[]')
  isOpen.value = opened.includes(props.toolCall.id)
})

const toggleOpen = () => {

  if (isSelecting.value) {
    return
  }
  
  isOpen.value = !isOpen.value
  const opened = JSON.parse(window.sessionStorage.getItem('opened-tools') || '[]')
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
  window.sessionStorage.setItem('opened-tools', JSON.stringify(opened))
}

const onSelectStart = () => {
  isSelecting.value = true
}

const onMouseUp = () => {
  if (!window.getSelection()?.toString().length) {
    isSelecting.value = false
  } else {
    setTimeout(() => {
      isSelecting.value = false
    }, 250)
  }
}

</script>

<style scoped>

.tool-container {
  
  width: 100%;
  margin: 0 0 1rem 0;
  background-color: var(--tool-bg-color);
  border: 1px solid var(--tool-border-color);
  border-radius: 8px;
  font-size: 0.9em;
  cursor: pointer;
  user-select: text;

  .tool-header {
    display: flex;
    padding: 0.5rem 1rem;
    align-items: center;
    gap: 0.5rem;
    
    .tool-name {
      flex: 1;
      font-weight: var(--font-weight-semibold);
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

  .tool-results {
    padding: 1rem;
    padding-top: 0.5rem;
    &:empty {
      display: none;
    }
  }

  .tool-values {
    border-top: 1px solid var(--tool-border-color);
    padding: 0.5rem;

    .tool-values-header {
      font-weight: var(--font-weight-medium);
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
          font-weight: var(--font-weight-medium);
          color: var(--tool-key-text-color);
        }

        .value-value {
          color: var(--tool-value-text-color);
          word-break: break-all;
        }
      }
    }
  }

  &.canceled {
    opacity: 0.6;

    .tool-header .tool-name {
      text-decoration: line-through;
      color: var(--dimmed-text-color);
    }
  }

}


</style>
