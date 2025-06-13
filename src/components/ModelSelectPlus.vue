
<template>
  
  <VueSelect ref="select" :inputId="id" 
    v-model="value" :options="models"
    :is-clearable="false" :is-disabled="disabled"
    :should-autofocus-option="false"
    :placeholder="defaultText || ''"
    :classes="{ singleValue: capsHoverOnly ? 'caps-hover-only' : '', }"
    @menu-opened="onMenuOpened"
    @option-selected="(option) => $emit('change', option.value)"
  >

    <template #value="{ option }">
      <span class="label">{{ option.label }}</span>
      <BIconTools :class="{ active: option.capabilities?.tools }" class="capability" />
      <BIconImage :class="{ active: option.capabilities?.vision }" class="capability" />
      <BIconLightningChargeFill :class="{ active: option.capabilities?.reasoning }" class="capability" />
    </template>

    <template #option="{ option }">
      <div class="model">
        <span class="label">{{ option.label }}</span>
        <span class="id" v-if="showId">{{ option.value }}</span>
      </div>
      <div class="capabilities">
        <BIconTools :class="{ active: option.capabilities?.tools }" class="capability" />
        <BIconImage :class="{ active: option.capabilities?.vision }" class="capability" />
        <BIconLightningChargeFill :class="{ active: option.capabilities?.reasoning }" class="capability" />
      </div>
    </template>

  </VueSelect>
  
</template>

<script setup lang="ts">

import { ChatModel, defaultCapabilities } from 'multi-llm-ts'
import { ref, computed, ComputedRef, nextTick } from 'vue'
import { store } from '../services/store'
import VueSelect from 'vue3-select-component'
import LlmFactory, { ILlmManager } from '../llms/llm'

const llmManager: ILlmManager = LlmFactory.manager(store.config)

const select = ref<typeof VueSelect|null>(null)

const models = computed(() => {

  const models = props.models ?? llmManager.getChatModels(props.engine)

  return [
  ...(props.defaultText ? [{ label: props.defaultText, value: '', ...defaultCapabilities }] : []),
  ...models.map(model => ({
      label: model.name,
      value: model.id,
      capabilities: model.capabilities,
    }))
  ]

})

const showId = computed(() => {
  return props.showIds && models.value.some(model => model.value != model.label)
})

const props = defineProps({
  id: {
    type: String,
    default: 'model'
  },
  engine: String,
  models: Array<ChatModel>,
  defaultText: String,
  showIds: {
    type: Boolean,
    default: false
  },
  capsHoverOnly: {
    type: Boolean,
    default: false
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

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

:deep() {

  --vs-min-height: auto;
  --vs-menu-height: v-bind(`${height}px`);
  --vs-padding: 2.75px 12px;
  --vs-font-size: var(--form-font-size);
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
  
    .indicators-container {
      opacity: 0.6;
      padding-right: 0 !important;
      transform: scale(0.82, 0.92);
      position: relative;
      left: 3.2px;

      button {
        box-shadow: none;
        filter: brightness(2.0);
      }
    }

    .value-container {

      padding-right: 0px;

      .single-value {

        display: flex;
        align-items: center;
        gap: 0.6em;

        .capability {
          width: 1em;
          opacity: var(--capabilty-inactive-opacity);
          &.active {
            opacity: var(--capabilty-active-opacity);
          }
        }

      }

    }

    &:has(.caps-hover-only) {
      .single-value .capability {
        display: none;
      }
      &:hover {
        .single-value .capability {
          display: inline-block;
        }
      }
    }
  }

  .menu {
    
    /* wait until we have scrolled to the selected item */
    opacity: 0;
    &.visible {
      opacity: 1;
    }

    .menu-option {
    
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .model {
        
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
        gap: 0.25rem;

        .label, .id {
          font-size: var(--vs-font-size);
        }

        .id {
          margin-top: 0;
          opacity: 0.5;
          font-size: 0.8em;
        }
      }

      .capabilities {
        flex-shrink: 0;
        display: flex;
        gap: 0.375rem;
      }

      &.selected {
        .capability {
          &.active {
            opacity: 1;
          }
        }
      }

      .capability {
        width: 0.8em;
        opacity: var(--capabilty-inactive-opacity);
        &.active {
          opacity: var(--capabilty-active-opacity);
        }
      }
    }
  }

}

form.large .vue-select .menu .menu-option {
  .capability {
    width: 0.9em;
  }
}

@media (prefers-color-scheme: dark) {
  :deep() {
    --vs-menu-border: 2px solid var(--control-border-color);
  }
}

</style>
