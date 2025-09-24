
<template>
  
  <VueSelect ref="select" :inputId="id" 
    v-model="value" :options="engines"
    :is-clearable="false" :is-disabled="disabled"
    :is-searchable="false"
    :should-autofocus-option="false"
    @menu-opened="onMenuOpened"
    @option-selected="(option) => $emit('change', option.value)"
    @keydown="onKeyDown"
  >

    <template #value="{ option }">
      <EngineLogo class="logo" :engine="option.value" />
      <span class="label">{{ option.label }}</span>
    </template>

    <template #option="{ option }">
      <div class="engine">
        <EngineLogo class="logo" :engine="option.value" :grayscale="true" :background="true" />
        <span class="label">{{ option.label }}</span>
      </div>
    </template>

  </VueSelect>
  
</template>

<script setup lang="ts">

import { computed, nextTick, PropType, ref } from 'vue'
import VueSelect from 'vue3-select-component'
import { engineNames } from '../llms/base'
import LlmFactory from '../llms/llm'
import LlmManager from '../llms/manager'
import { store } from '../services/store'
import EngineLogo from './EngineLogo.vue'

const llmManager: LlmManager = LlmFactory.manager(store.config) as LlmManager

const select = ref<typeof VueSelect|null>(null)

const engines = computed(() => {
  return llmManager.getStandardEngines()
    .filter((e: string) => {
      if (props.filter === 'local') return llmManager.isEngineLocal(e)
      if (props.filter === 'online') return llmManager.isEngineOnline(e)
      return true
    })
    .map((e: string) => {
      return {
        value: e,
        label: engineNames[e]
      }
    })
})

export type EngineFilter = 'all' | 'local' | 'online'

const props = defineProps({
  id: {
    type: String,
    default: 'engine'
  },
  filter: {
    type: String as PropType<EngineFilter>,
    default: 'all'
  },
  height: {
    type: Number,
    default: 200
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const value = defineModel()
const emit = defineEmits(['change']);

const onMenuOpened = async () => {
  await nextTick()
  //@ts-expect-error typing stuff
  const menu = select.value.$el.querySelector('.menu')
  if (!menu) return
  const selected = menu.querySelector('.selected')
  if (selected) {
    const selectedRect = selected.getBoundingClientRect()
    const menuTop = menu.getBoundingClientRect().top
    const offset = selectedRect.top - menuTop - selectedRect.height
    menu.scrollTop = offset
  }
  menu.classList.add('visible')
}

const onKeyDown = (event: KeyboardEvent) => {
  // Allow arrow keys, enter, escape, tab for navigation
  const allowedKeys = ['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab', ' ']
  
  if (!allowedKeys.includes(event.key)) {
    event.preventDefault()
    event.stopPropagation()
  }
}

</script>


<style scoped>

:deep() {

  --vs-min-height: auto;
  --vs-menu-height: v-bind(`${height}px`);
  --vs-menu-z-index: 100;
  --vs-padding: 2.75px 12px;
  --vs-font-size: var(--form-large-font-size);
  --vs-text-color: var(--control-text-color);
  --vs-background-color: var(--control-bg-color);
  --vs-border: 1px solid var(--control-border-color);
  --vs-border-radius: var(--control-border-radius);
  --vs-indicator-icon-color: var(--control-text-color);
  --vs-placeholder-color: var(--dimmed-text-color);
  --vs-menu-offset-top: 0.25rem;
  --vs-menu-background-color: var(--background-color);
  --vs-menu-border: 1px solid var(--control-border-color);
  --vs-option-opacity-menu-open: 0.7;
  --vs-option-padding: 0.5rem 0.75rem;
  --vs-option-hover-background-color: var(--settings-selected-bg-color);
  --vs-option-hover-text-color: var(--settings-selected-text-color);
  --vs-option-selected-background-color: var(--highlight-color);
  --vs-option-selected-text-color: var(--highlighted-color);
  --vs-option-text-color: var(--text-color);

  --capabilty-active-opacity: 0.50;
  --capabilty-inactive-opacity: 0.15;

  .control .single-value .label, .menu .menu-option .model .label, .menu .menu-option .id {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
  } 

  .control {
  
    .value-container {

      padding-right: 0px;

      .single-value {

        display: flex;
        align-items: center;
        padding: 0.5rem;
        gap: 0.6em;

        .logo {
          width: var(--icon-xl);
          height: var(--icon-xl);
        }

      }

      .search-input {
        margin: 0 !important;
        padding: 0 !important;
        display: none !important;
      }

    }

  }

  .menu {
    
    /* wait until we have scrolled to the selected item */
    opacity: 0;
    &.visible {
      opacity: 1;
    }

    z-index: 1000;

    .menu-option {
    
      display: flex;
      align-items: center;
      padding: 0.5rem 1rem;
      gap: 0.6em;

      .engine {
        
        flex: 1;
        display: flex;
        flex-direction: row;
        overflow-x: hidden;
        gap: 0.6em;

        .logo {
          width: var(--icon-xl);
          height: var(--icon-xl);
        }

        .label, .id {
          font-size: var(--vs-font-size);
        }

      }

    }
  }

}

@media (prefers-color-scheme: dark) {
  :deep() {
    --vs-menu-border: 2px solid var(--control-border-color);
  }
}

</style>
