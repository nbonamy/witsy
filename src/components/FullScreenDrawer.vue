<template>
  <div class="fullscreen-drawer" :class="{ visible: visible }">
    <XIcon class="icon close" v-tooltip="{ text: t('common.close'), position: 'bottom-left' }" @click="close" v-if="showClose"/>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">

import { XIcon } from 'lucide-vue-next'
import { ref, onMounted } from 'vue'
import { t } from '../services/i18n'

const emit = defineEmits(['closed'])

const props = defineProps({
  autoShow: {
    type: Boolean,
    default: true
  },
  showClose: {
    type: Boolean,
    default: false
  }
})
const visible = ref(false)

onMounted(() => {
  if (props.autoShow) {
    requestAnimationFrame(() => {
      show()
    })
  }
})

const show = () => {
  visible.value = true
}

const close = () => {
  visible.value = false
  emit('closed')
}

defineExpose({
  show,
  close
})

</script>

<style>

#app:has(.workspace-bar) {
  .fullscreen-drawer {
    left: calc(2 * var(--window-menubar-width));
  }
}

</style>



<style scoped>

.fullscreen-drawer {
  
  position: absolute;
  top: calc(var(--window-toolbar-height) + 1px);
  bottom: calc(var(--window-footer-height) + 1px);
  left: calc(var(--window-menubar-width));
  right: 0;
  background-color: var(--background-color);
  
  opacity: 0;

  &.visible {
    /* transition: opacity 0.2s ease; */
    opacity: 1;
  }

  .icon.close {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    width: var(--icon-lg);
    height: var(--icon-lg);
    cursor: pointer;
    z-index: 1000;
  }

  &:deep() > * {
    height: calc(100vh - var(--window-toolbar-height) - var(--window-footer-height) - 2px);
  }

}

</style>