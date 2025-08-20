<template>
  <div>
    <!-- Overlay -->
    <div 
      class="side-drawer-overlay" 
      :class="{ visible: isVisible }"
      @click="close"
      @transitionend="onOverlayTransitionEnd"
    ></div>

    <!-- Side Drawer -->
    <div 
      class="side-drawer form form-large form-vertical" 
      :class="{ visible: isVisible }"
      @transitionend="onTransitionEnd"
    >
      <header>
        <label><slot name="header"></slot></label>
        <div class="icon close"><XIcon @click="close"/></div>
      </header>

      <main>
        <slot name="content"></slot>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">

import { XIcon } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';

const emit = defineEmits<{
  close: []
  closed: []
}>()

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
}

const close = () => {
  isVisible.value = false
  emit('close')
}

const onTransitionEnd = () => {
  if (!isVisible.value) {
    emit('closed')
  }
}

const onOverlayTransitionEnd = () => {
  // Handle overlay transition end if needed
}

defineExpose({
  show,
  close
})
</script>

<style scoped>
.side-drawer-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0);
  transition: background-color 0.3s ease;
  pointer-events: none;
  &.visible {
    background-color: rgba(0, 0, 0, 0.03);
    pointer-events: all;
  }
}

.side-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 26rem;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  pointer-events: none;

  display: flex;
  overflow: hidden;

  background-color: var(--background-color);

  &.visible {
    box-shadow: 0 0 4rem rgba(0, 0, 0, 0.33);
    transform: translate(0);
    pointer-events: all;
  }

  header {
    label {
      font-size: 18.5px;
      font-weight: var(--font-weight-semibold);
    }

    .icon.close svg {
      width: 1.25rem;
      height: 1.25rem;
    }
  }

  main {
    padding: 0rem 1.5rem;
    padding-bottom: 1rem;
    overflow: auto;
  }
}
</style>