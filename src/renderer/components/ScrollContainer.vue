<template>
  <div class="scroll-container" :class="direction">
    <div v-if="canScrollBefore" class="scroll-indicator before" @click="scrollBefore" @mouseenter="startAutoScroll('before')" @mouseleave="stopAutoScroll">
      <ChevronLeftIcon v-if="direction === 'horizontal'" :size="14" />
      <ChevronUpIcon v-else :size="14" />
    </div>
    <div ref="scrollable" class="scroll-content" @wheel="onWheel">
      <slot />
    </div>
    <div v-if="canScrollAfter" class="scroll-indicator after" @click="scrollAfter" @mouseenter="startAutoScroll('after')" @mouseleave="stopAutoScroll">
      <ChevronRightIcon v-if="direction === 'horizontal'" :size="14" />
      <ChevronDownIcon v-else :size="14" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from 'lucide-vue-next'
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  scrollAmount: {
    type: Number,
    default: 50,
  },
  direction: {
    type: String as () => 'vertical' | 'horizontal',
    default: 'vertical',
  },
})

const scrollable = ref<HTMLElement | null>(null)
const canScrollBefore = ref(false)
const canScrollAfter = ref(false)

let resizeObserver: ResizeObserver | null = null

const update = () => {
  const el = scrollable.value
  if (!el) {
    canScrollBefore.value = false
    canScrollAfter.value = false
    return
  }
  if (props.direction === 'horizontal') {
    canScrollBefore.value = el.scrollLeft > 0
    canScrollAfter.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
  } else {
    canScrollBefore.value = el.scrollTop > 0
    canScrollAfter.value = el.scrollTop + el.clientHeight < el.scrollHeight - 1
  }
}

const scrollBefore = () => {
  if (props.direction === 'horizontal') {
    scrollable.value?.scrollBy({ left: -props.scrollAmount, behavior: 'smooth' })
  } else {
    scrollable.value?.scrollBy({ top: -props.scrollAmount, behavior: 'smooth' })
  }
}

const scrollAfter = () => {
  if (props.direction === 'horizontal') {
    scrollable.value?.scrollBy({ left: props.scrollAmount, behavior: 'smooth' })
  } else {
    scrollable.value?.scrollBy({ top: props.scrollAmount, behavior: 'smooth' })
  }
}

let autoScrollTimeout: ReturnType<typeof setTimeout> | null = null
let autoScrollRaf: number | null = null

const startAutoScroll = (dir: 'before' | 'after') => {
  stopAutoScroll()
  autoScrollTimeout = setTimeout(() => {
    const step = () => {
      const el = scrollable.value
      if (!el) return
      const delta = dir === 'before' ? -2 : 2
      if (props.direction === 'horizontal') {
        el.scrollLeft += delta
      } else {
        el.scrollTop += delta
      }
      update()
      autoScrollRaf = requestAnimationFrame(step)
    }
    autoScrollRaf = requestAnimationFrame(step)
  }, 300)
}

const stopAutoScroll = () => {
  if (autoScrollTimeout) {
    clearTimeout(autoScrollTimeout)
    autoScrollTimeout = null
  }
  if (autoScrollRaf) {
    cancelAnimationFrame(autoScrollRaf)
    autoScrollRaf = null
  }
}

const onWheel = (event: WheelEvent) => {
  if (props.direction !== 'horizontal') return
  const el = scrollable.value
  if (!el) return
  // convert vertical scroll to horizontal
  if (event.deltaY !== 0) {
    event.preventDefault()
    el.scrollLeft += event.deltaY
  }
}

watch(scrollable, (el) => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  if (el) {
    el.addEventListener('scroll', update)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(update)
      resizeObserver.observe(el)
    }
    update()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  scrollable.value?.removeEventListener('scroll', update)
  resizeObserver?.disconnect()
  stopAutoScroll()
})
</script>

<style scoped>
.scroll-container {
  position: relative;
  overflow: hidden;
}

/* Vertical mode */
.scroll-container.vertical .scroll-content {
  height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.scroll-container.vertical .scroll-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  color: var(--color-on-surface-variant);
  background: linear-gradient(to bottom, var(--menubar-bg-color) 90%, transparent);
}

.scroll-container.vertical .scroll-indicator.before {
  top: 0;
}

.scroll-container.vertical .scroll-indicator.after {
  bottom: 0;
  background: linear-gradient(to top, var(--menubar-bg-color) 90%, transparent);
}

/* Horizontal mode */
.scroll-container.horizontal {
  display: flex;
  align-items: center;
}

.scroll-container.horizontal .scroll-content {
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.scroll-container.horizontal .scroll-indicator {
  flex-shrink: 0;
  width: 20px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  color: var(--color-on-surface-variant);
}

.scroll-container.horizontal .scroll-indicator.before {
  background: linear-gradient(to right, var(--background-color) 90%, transparent);
}

.scroll-container.horizontal .scroll-indicator.after {
  background: linear-gradient(to left, var(--background-color) 90%, transparent);
}
</style>
