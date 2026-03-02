<template>
  <Teleport to="body">
    <div v-if="show" class="outline-panel" :style="position">
      <div class="outline-drag-handle" @mousedown="startDrag">
        <div class="outline-drag-bar"></div>
      </div>
      <div v-if="headings.length > 0" class="outline-content">
        <OutlineHeadingItem
          v-for="heading in headings"
          :key="heading.id"
          :heading="heading"
          :level="heading.level"
          :active-heading-id="activeHeadingId"
          @navigate="handleNavigate"
        />
      </div>
      <div v-else class="outline-empty">
        {{ t('playbooks.outline.empty') }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { OutlineHeading } from '@composables/useOutline';
import { t } from '@services/i18n';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import OutlineHeadingItem from './OutlineHeadingItem.vue';

const props = defineProps<{
  show: boolean
  headings: OutlineHeading[]
  anchorSelector: string
  activeHeadingId?: string | null
}>()

const emit = defineEmits<{
  close: []
  navigate: [heading: OutlineHeading]
}>()

const position = ref<Record<string, string>>({})
const savedPosition = ref<{ top: number; left: number } | null>(null)
let isDragging = false
let dragOffset = { x: 0, y: 0 }

/**
 * Calculate popover position relative to anchor element
 */
const calculatePosition = () => {
  // If user has dragged the panel, use saved position
  if (savedPosition.value) {
    position.value = {
      position: 'fixed',
      top: `${savedPosition.value.top}px`,
      left: `${savedPosition.value.left}px`,
      zIndex: '1070'
    }
    return
  }

  const anchor = document.querySelector(props.anchorSelector)
  if (!anchor) return

  const rect = anchor.getBoundingClientRect()

  // Position below the anchor button
  position.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    zIndex: '1070'
  }
}

/**
 * Start dragging the panel
 */
const startDrag = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  isDragging = true

  const panel = (event.target as HTMLElement).closest('.outline-panel') as HTMLElement
  if (!panel) return

  const rect = panel.getBoundingClientRect()
  dragOffset.x = event.clientX - rect.left
  dragOffset.y = event.clientY - rect.top

  const onMove = (e: MouseEvent) => {
    if (!isDragging) return

    const newLeft = e.clientX - dragOffset.x
    const newTop = e.clientY - dragOffset.y

    // Keep panel within viewport bounds
    const maxLeft = window.innerWidth - 300 // min width
    const maxTop = window.innerHeight - 100 // min height

    savedPosition.value = {
      left: Math.max(0, Math.min(maxLeft, newLeft)),
      top: Math.max(0, Math.min(maxTop, newTop))
    }

    calculatePosition()
  }

  const onEnd = () => {
    isDragging = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onEnd)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onEnd)
}

// Recalculate position when shown
watch(() => props.show, (newShow) => {
  if (newShow) {
    nextTick(() => {
      calculatePosition()
    })
  }
})

// Auto-scroll to active heading when it changes
watch(() => props.activeHeadingId, (newId) => {
  if (!newId || !props.show) return

  nextTick(() => {
    const activeElement = document.querySelector(`[data-heading-id="${newId}"]`)
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  })
})

const handleNavigate = (heading: OutlineHeading) => {
  emit('navigate', heading)
}

// Recalculate position on resize (only if not dragged)
const handleResize = () => {
  if (props.show && !savedPosition.value) {
    calculatePosition()
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.outline-panel {
  background: var(--context-menu-bg-color, var(--color-surface));
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  max-width: 300px;
  max-height: 400px;
  overflow-y: auto;
  padding: 0;
}

.outline-drag-handle {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-2);
  cursor: move;
  background: var(--color-surface-low);
  border-bottom: 1px solid var(--color-outline-variant);
  border-top-left-radius: var(--radius-md);
  border-top-right-radius: var(--radius-md);
}

.outline-drag-handle:hover {
  background: var(--color-surface-high);
}

.outline-drag-bar {
  width: 32px;
  height: 4px;
  background: var(--color-outline);
  border-radius: var(--radius-full);
}

.outline-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) 0;
}

.outline-empty {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-13);
}

/* Custom scrollbar */
.outline-panel::-webkit-scrollbar {
  width: 8px;
}

.outline-panel::-webkit-scrollbar-track {
  background: transparent;
}

.outline-panel::-webkit-scrollbar-thumb {
  background: var(--color-outline-variant);
  border-radius: var(--radius-sm);
}

.outline-panel::-webkit-scrollbar-thumb:hover {
  background: var(--color-outline);
}
</style>
