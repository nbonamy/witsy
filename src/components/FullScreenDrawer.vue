<template>
  <div class="fullscreen-drawer" :class="{ visible: isVisible }" @transitionend="onTransitionEnd">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits(['closed'])

const props = defineProps({
  autoShow: {
    type: Boolean,
    default: true
  }
})

const isVisible = ref(false)

onMounted(() => {
  if (props.autoShow) {
    requestAnimationFrame(() => {
      show()
    })
  }
})

const show = () => {
  isVisible.value = true
  window.api.main.hideWindowButtons()
}

const close = () => {
  isVisible.value = false
  window.api.main.showWindowButtons()
}

const onTransitionEnd = () => {
  if (!isVisible.value) {
    emit('closed')
  }
}

defineExpose({
  show,
  close
})

</script>

<style scoped>

.fullscreen-drawer {
  -webkit-app-region: no-drag;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--background-color);
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);

  &.visible {
    transform: translateY(0);
  }

  &:deep() > * {
    height: 100vh;
  }

}
</style>