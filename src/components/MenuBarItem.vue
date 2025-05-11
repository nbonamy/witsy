
<template>
  <div ref="item" class="item" :class="{ active: active }" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @click="onClick">
    <slot />
    <div class="tooltip" v-if="showTooltip">
      {{ tooltipText }}
    </div>
  </div>
</template>

<script setup lang="ts">

import { onMounted, ref } from 'vue'

const item = ref<HTMLElement | null>(null)
const showTooltip = ref(false)
const tooltipText = ref('')

let tipTimeout: NodeJS.Timeout | null = null

const emit = defineEmits(['click'])

const props = defineProps({
  action: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
})

onMounted(() => {
  const span = item.value.querySelector('span') as HTMLElement
  tooltipText.value = span ? span.innerText : ''
})

const onClick = () => {
  showTooltip.value = false
  clearTimeout(tipTimeout)
  emit('click', props.action)
}

const onMouseMove = () => {
  showTooltip.value = false
  clearTimeout(tipTimeout)
  tipTimeout = setTimeout(() => {
    showTooltip.value = true
  }, 250)
}

const onMouseLeave = () => {
  clearTimeout(tipTimeout)
  tipTimeout = null
}

</script>

<style scoped>

.item {
  border-radius: 50%;
  padding: 0.5rem;
  cursor: pointer;
  color: var(--chatarea-toolbar-text-color);
  position: relative;

  &.active, &:hover {
    background-color: var(--background-color);
  }

  &.active {
    color: var(--menubar-highlight-color);
  }

  &:deep() {

    svg {
      width: 1.125rem;
      height: 1.125rem;
    }

    span {
      display: none;
    }

  }

}

.tooltip {
  position: absolute;
  top: 4%;
  z-index: 1000;
  left: 140%;
  font-size: 10pt;
  background: var(--text-color);
  color: var(--background-color);
  white-space: nowrap;
  padding: .5rem;
  border-radius: 6px;

  &::after {
    content: " ";
    position: absolute;
    top: 50%;
    right: 100%; /* To the left of the tooltip */
    margin-top: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: transparent var(--text-color) transparent transparent;
  }

}

</style>
