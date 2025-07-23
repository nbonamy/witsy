<template>
  <div class="tooltip-container" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @click="onClick">
    <slot />
    <div class="tooltip" :class="[position]" v-if="showTooltip">
      {{ tooltipText }}
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, PropType } from 'vue'

const showTooltip = ref(false)

let tipTimeout: NodeJS.Timeout | null = null

defineProps({
  tooltipText: {
    type: String,
    required: true,
  },
  position: {
    type: String as PropType<'right' | 'top' | 'top-right'>,
    default: 'right',
  },
})

const hideTooltip = () => {
  showTooltip.value = false
  clearTimeout(tipTimeout)
  tipTimeout = null
}

const onMouseMove = () => {
  if (tipTimeout) {
    clearTimeout(tipTimeout)
  }
  if (!showTooltip.value) {
    tipTimeout = setTimeout(() => {
      showTooltip.value = true
    }, 250)
  }
}

const onMouseLeave = () => {
  hideTooltip()
}

const onClick = () => {
  hideTooltip()
}

defineExpose({
  hide: hideTooltip,
})

</script>

<style scoped>

.tooltip-container {
  position: relative;
}

.tooltip {
  position: absolute;
  z-index: 1000;
  font-size: 10pt !important;
  background: var(--text-color);
  color: var(--background-color);
  white-space: nowrap;
  padding: .5rem;
  border-radius: 6px;

  &::after {
    position: absolute;
    border-style: solid;
    border-color: transparent var(--text-color) transparent transparent;
  }

  &.right {
    top: 4%;
    left: 140%;
    
    &::after {
      content: " ";
      top: 50%;
      right: 100%; /* To the left of the tooltip */
      margin-top: -5px;
      border-width: 5px;
    }
  }

  &.top {
    bottom: 140%;
    left: 50%;
    transform: translateX(-50%);
    
    &::after {
      content: " ";
      top: 100%; /* Below the tooltip */
      left: 50%;
      margin-left: -5px;
      border-width: 5px;
      border-color: var(--text-color) transparent transparent transparent;
    }
  }

  &.top-right {
    
    bottom: 140%;
    left: -25%;
    
    &::after {
      content: " ";
      top: 100%;
      left: 10%;
      margin-left: -5px;
      border-width: 5px;
      border-color: var(--text-color) transparent transparent transparent;
    }
  }

}

</style>
