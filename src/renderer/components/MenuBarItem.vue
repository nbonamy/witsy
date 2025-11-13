<template>
  <ButtonIcon ref="item"
    class="item" 
    :class="{ active: active }" 
    v-tooltip="{ text: tooltipText, position: 'right' }"
    @click="onClick"
  >
    <slot />
  </ButtonIcon>
</template>

<script setup lang="ts">

import { onMounted, ref } from 'vue'
import ButtonIcon from './ButtonIcon.vue'

const item = ref<typeof ButtonIcon>(null)
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
  const span = item.value.$el.querySelector('span') as HTMLElement
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
  padding: 0.5rem;
  cursor: pointer;
  color: #848CAF;
  position: relative;

  &.active:deep() svg {
    color: var(--menubar-highlight-color) !important;
  }

  &:deep() {

    svg {
      width: var(--icon-lg);
      height: var(--icon-lg);
    }

    span {
      display: none;
    }

  }

}


</style>
