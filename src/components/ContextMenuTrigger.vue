<template>
  <div class="context-menu-trigger">
    <div 
      :id="triggerId" 
      class="trigger" 
      @click="toggleMenu"
      @keydown.enter="toggleMenu"
      @keydown.space.prevent="toggleMenu"
      tabindex="0"
    >
      <slot name="trigger">
        <EllipsisVerticalIcon />
      </slot>
    </div>
    
    <ContextMenuPlus 
      v-if="isMenuOpen"
      :anchor="`#${triggerId}`"
      :position="position"
      @close="closeMenu"
    >
      <slot name="menu" :close="closeMenu" />
    </ContextMenuPlus>
  </div>
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted } from 'vue'
import { EllipsisVerticalIcon } from 'lucide-vue-next'
import ContextMenuPlus, { type MenuPosition } from './ContextMenuPlus.vue'

const props = defineProps({
  position: {
    type: String as () => MenuPosition,
    default: 'below-right' as MenuPosition
  }
})

const isMenuOpen = ref(false)
const triggerId = ref('')

onMounted(() => {
  triggerId.value = `context-trigger-${Math.random().toString(36).substr(2, 9)}`
})

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isMenuOpen.value) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})

defineExpose({
  closeMenu,
  toggleMenu,
  isMenuOpen: () => isMenuOpen.value
})

</script>

<style scoped>

.context-menu-trigger {
  position: relative;
  display: inline-block;
}

.trigger {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  outline: none;
}

.trigger:focus-visible {
  box-shadow: 0 0 0 2px var(--focus-ring-color, #3b82f6);
}

</style>