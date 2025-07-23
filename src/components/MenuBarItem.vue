
<template>
  <Tooltip :tooltipText="tooltipText" position="right">
    <div ref="item" class="item" :class="{ active: active }" @click="onClick">
      <slot />
    </div>
  </Tooltip>
</template>

<script setup lang="ts">

import { onMounted, ref } from 'vue'
import Tooltip from './Tooltip.vue'

const item = ref<HTMLElement | null>(null)
const tooltipText = ref('')

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
  emit('click', props.action)
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


</style>
