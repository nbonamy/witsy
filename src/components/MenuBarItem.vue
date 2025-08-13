<template>
  <div ref="item"
    class="item" 
    :class="{ active: active }" 
    v-tooltip="{ text: tooltipText, position: 'right' }"
    @click="onClick"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">

import { onMounted, ref } from 'vue'

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
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
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
