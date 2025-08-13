<template>
  <div>
    <!-- Overlay -->
    <div 
      class="side-drawer-overlay" 
      :class="{ visible: isVisible }"
      @click="close"
    ></div>

    <!-- Side Drawer -->
    <div 
      class="side-drawer form form-large form-vertical" 
      :class="{ visible: isVisible }"
    >
      <header>
        <label><slot name="header"></slot></label>
        <div class="icon"><BIconXLg @click="close"/></div>
      </header>

      <main>
        <slot name="content"></slot>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'


const emit = defineEmits<{
  close: []
}>()

const isVisible = ref(false)

const show = () => {
  isVisible.value = true
}

const close = () => {
  isVisible.value = false
  emit('close')
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
  display: none;
  &.visible {
    display: block;
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
      font-size: 14pt;
      font-weight: 600;
    }
  }

  main {
    padding: 0rem 1.5rem;
    padding-bottom: 1rem;
    overflow: auto;
  }
}
</style>