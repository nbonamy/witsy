<template>
  <Teleport to="body" :disabled="!teleport">
    <Overlay @click="onOverlay" />
    <!-- Hidden chevron template for cloning -->
    <BIconChevronRight ref="chevronTemplate" style="display: none;" class="chevron-template" />
    <div class="context-menu" :style="position" @keydown="onKeyDown" @keyup="onKeyUp">
      <!-- Top level filter or back/filter header -->
      <div v-if="showFilter || currentSubmenu" class="header">
        <div v-if="currentSubmenu" class="back-button" @click="goBack">
          <BIconArrowLeft />
        </div>
        <div v-if="shouldShowCurrentFilter" class="filter-input">
          <input v-model="filter" :placeholder="t('common.search')" autofocus="true" @keydown.stop="onKeyDown" @keyup.stop="onKeyUp" />
        </div>
        <div v-else-if="currentSubmenu" class="back-label">
          Back
        </div>
      </div>
      
      <div class="actions" ref="list">        
        <!-- Show main menu or submenu content -->
        <div v-if="!currentSubmenu">
          <slot :filter="filter" :selected="selected" />
        </div>
        <div v-else>
          <slot :name="currentSubmenu" :filter="filter" :selected="selected" :goBack="goBack" :withFilter="setSubmenuFilter" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">

import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import Overlay from '../components/Overlay.vue'
import { t } from '../services/i18n'

export type MenuPosition = 'below' | 'above' | 'right' | 'left' | 'above-right' | 'above-left' | 'below-right' | 'below-left'

const props = defineProps({
  anchor: {
    type: String,
    required: true
  },
  position: {
    type: String as () => MenuPosition,
    default: 'below',
  },
  showFilter: {
    type: Boolean,
    default: false
  },
  teleport: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close'])

const list = ref(null)
const filter = ref('')
const selected = ref(null)
const currentSubmenu = ref(null)
const chevronTemplate = ref(null)

const anchorElement = computed(() => {
  return document.querySelector(props.anchor)
})

const shouldShowCurrentFilter = computed(() => {
  if (!currentSubmenu.value) {
    return props.showFilter
  }
  // For submenus, we'll check if the slot was rendered with withFilter: true
  return currentSubmenuHasFilter.value
})

const currentSubmenuHasFilter = ref(false)

const position = computed(() => {
  if (!anchorElement.value) return { top: '0px', left: '0px' }
  
  const rect = anchorElement.value.getBoundingClientRect()
  const scrollX = window.scrollX || document.documentElement.scrollLeft
  const scrollY = window.scrollY || document.documentElement.scrollTop
  
  const x = rect.left + scrollX
  const y = rect.top + scrollY
  const width = rect.width
  const height = rect.height
  
  switch (props.position) {
    case 'above':
      return { left: x + 'px', bottom: (window.innerHeight - y) + 'px' }
    case 'above-right':
      return { right: (window.innerWidth - x - width) + 'px', bottom: (window.innerHeight - y) + 'px' }
    case 'above-left':
      return { left: x + 'px', bottom: (window.innerHeight - y) + 'px' }
    case 'right':
      return { left: (x + width) + 'px', top: y + 'px' }
    case 'left':
      return { right: (window.innerWidth - x) + 'px', top: y + 'px' }
    case 'below-right':
      return { right: (window.innerWidth - x - width) + 'px', top: (y + height) + 'px' }
    case 'below-left':
      return { left: x + 'px', top: (y + height) + 'px' }
    case 'below':
    default:
      return { left: x + 'px', top: (y + height) + 'px' }
  }
})


onMounted(() => {
  if (shouldShowCurrentFilter.value) {
    nextTick(() => {
      const input = document.querySelector<HTMLElement>('.context-menu input')
      input?.focus()
    })
  }
  
  // Add chevron icons and event listeners after content is rendered
  nextTick(() => {
    addChevronIcons()
    addEventListeners()
  })
  
  document.addEventListener('keydown', onKeyUp)
  document.addEventListener('keyup', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyUp)
  document.removeEventListener('keyup', onKeyDown)
})

// Watch for filter changes and apply filtering
watch(filter, (newFilter) => {
  nextTick(() => {
    applyFilter(newFilter)
  })
})

// Watch for content changes to add chevron icons and event listeners
watch([currentSubmenu], () => {
  nextTick(() => {
    addChevronIcons()
    addEventListeners()
  })
}, { flush: 'post' })


const applyFilter = (filterText: string) => {
  if (!list.value) return
  
  const items = list.value.querySelectorAll('.item:not(.back-item)')
  
  items.forEach((item: HTMLElement) => {
    if (!filterText.trim()) {
      // Show all items when no filter
      item.style.display = ''
      return
    }
    
    // Get the text content of the item, excluding icons
    const textContent = item.textContent || ''
    const shouldShow = textContent.toLowerCase().includes(filterText.toLowerCase())
    
    item.style.display = shouldShow ? '' : 'none'
  })
}

const addChevronIcons = () => {
  if (!list.value || !chevronTemplate.value) return
  
  const items = list.value.querySelectorAll('.item[data-submenu-slot]')
  
  items.forEach((item: HTMLElement) => {
    // Check if chevron already exists
    if (item.querySelector('.chevron-icon')) return
    
    // Clone the hidden BIconChevronRight component
    const chevronElement = chevronTemplate.value.$el || chevronTemplate.value
    if (chevronElement) {
      const clonedChevron = chevronElement.cloneNode(true) as HTMLElement
      clonedChevron.style.display = '' // Remove the hidden style
      clonedChevron.classList.add('chevron-icon')
      clonedChevron.classList.remove('chevron-template')
      
      // Add to item
      item.appendChild(clonedChevron)
    }
  })
}

const addEventListeners = () => {
  if (!list.value) return
  
  const items = list.value.querySelectorAll('.item')
  
  items.forEach((item: HTMLElement) => {
    // Skip if already has listeners (check for a data attribute we set)
    if (item.hasAttribute('data-listeners-added')) return
    
    // Add hover listener for all items
    item.addEventListener('mousemove', (event) => {
      onItemHover(event)
    })
    
    // Add click listener for submenu items
    if (item.hasAttribute('data-submenu-slot')) {
      item.addEventListener('click', (event) => {
        onItemClick(event)
      })
    }
    
    // Mark as processed
    item.setAttribute('data-listeners-added', 'true')
  })
}

const onOverlay = () => {
  emit('close')
}

const onItemClick = (event: Event) => {
  const target = event.target as HTMLElement
  const item = target.closest('.item') as HTMLElement
  
  if (item?.hasAttribute('data-submenu-slot')) {
    event.stopPropagation()
    showSubmenu(item)
  }
}

const onItemHover = (event: Event) => {
  const target = event.target as HTMLElement
  const item = target.closest('.item')
  selected.value = item
  ensureVisible()
}

const showSubmenu = (item: HTMLElement) => {
  const submenuSlot = item.getAttribute('data-submenu-slot')
  if (submenuSlot) {
    currentSubmenu.value = submenuSlot
    selected.value = null
    currentSubmenuHasFilter.value = false // Reset filter flag
  }
}

const setSubmenuFilter = (hasFilter: boolean) => {
  currentSubmenuHasFilter.value = hasFilter
}

const goBack = () => {
  currentSubmenu.value = null
  selected.value = null
  filter.value = '' // Clear filter when going back
  currentSubmenuHasFilter.value = false
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    navigateVertical(event.key === 'ArrowDown', list.value, selected)
  } else if (event.key === 'ArrowRight' && !currentSubmenu.value) {
    event.preventDefault()
    const item = selected.value
    if (item?.hasAttribute('data-submenu-slot')) {
      showSubmenu(item)
    }
  } else if (event.key === 'ArrowLeft' && currentSubmenu.value) {
    event.preventDefault()
    goBack()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const currentItem = selected.value
    if (currentItem) {
      currentItem.click()
    }
  }
}
 
const onKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (currentSubmenu.value) {
      goBack()
    } else {
      emit('close')
    }
    event.preventDefault()
    event.stopPropagation()
    return false
  }
}

const navigateVertical = (down: boolean, listElement: HTMLElement, selectedRef: any) => {
  if (!listElement) return
  
  const items = Array.from(listElement.querySelectorAll('.item:not(.disabled):not(.separator)')) as HTMLElement[]
  if (items.length === 0) return
  
  const currentIndex = selectedRef.value ? items.indexOf(selectedRef.value) : -1
  
  if (currentIndex === -1) {
    selectedRef.value = items[0]
  } else {
    const nextIndex = down 
      ? (currentIndex + 1) % items.length
      : (currentIndex - 1 + items.length) % items.length
    selectedRef.value = items[nextIndex]
  }
  
  ensureVisible()
}

const ensureVisible = () => {
  nextTick(() => {
    const selectedEl = list.value?.querySelector('.selected') as HTMLElement
    if (selectedEl && list.value) {
      scrollToBeVisible(selectedEl, list.value)
    }
  })
}


const scrollToBeVisible = function (ele: HTMLElement, container: HTMLElement) {
  const eleTop = ele.offsetTop - container.offsetTop
  const eleBottom = eleTop + ele.clientHeight
  
  const containerTop = container.scrollTop
  const containerBottom = containerTop + container.clientHeight
  
  if (eleTop < containerTop) {
    container.scrollTop -= containerTop - eleTop
  } else if (eleBottom > containerBottom) {
    container.scrollTop += eleBottom - containerBottom
  }
}

// Expose methods for testing
defineExpose({
  showSubmenu: (item: HTMLElement | string) => {
    if (typeof item === 'string') {
      // Directly set the submenu for testing
      currentSubmenu.value = item
      currentSubmenuHasFilter.value = false
    } else {
      showSubmenu(item)
    }
  },
  goBack,
  currentSubmenu: () => currentSubmenu.value,
  setCurrentSubmenu: (submenu: string) => {
    currentSubmenu.value = submenu
    currentSubmenuHasFilter.value = false
  }
})

</script>

<style scoped>

.context-menu {
  position: absolute;
  background: var(--context-menu-bg-color);
  border: 1px solid var(--context-menu-border-color);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  max-width: 270px;
  border-radius: 0.5rem;
  overflow: hidden;
  z-index: 50;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.context-menu.submenu {
  z-index: 51;
}

.context-menu .actions {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  margin: 0px !important;
  padding: 0.25rem 0rem;
  scrollbar-color: var(--scrollbar-thumb-color) var(--control-textarea-bg-color);
}

.header {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid var(--context-menu-border-color);
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  cursor: pointer;
  color: var(--context-menu-text-color);
}

.filter-input {
  flex: 1;
}

.filter-input input {
  background-color: transparent;
  color: var(--context-menu-text-color);
  border: none;
  padding: 0.5rem 0;
  font-size: 11pt;
  outline: none;
  min-width: 5rem;
  width: auto;
}

.filter-input input::placeholder {
  color: var(--context-menu-text-color);
  opacity: 0.3;
}

.back-label {
  flex: 1;
  color: var(--context-menu-text-color);
  font-size: 11pt;
  opacity: 0.8;
}

/* Global styles for menu items (to be used by slotted content) */
:deep(.item) {
  position: relative;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 11pt;
  white-space: nowrap;
  overflow-x: clip;
  text-overflow: ellipsis;
  color: var(--context-menu-text-color);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

:deep(.item.wrap) {
  white-space: normal;
}

:deep(.item.separator) {
  cursor: default;
  padding: 0.25rem 0px;
}

:deep(.item.separator hr) {
  border-top-width: 0.5px;
  border-bottom-width: 0.5px;
  width: 100%;
  margin: 0;
}

:deep(.item .icon) {
  margin-right: 0.25rem;
}

:deep(.item .icon.text) {
  font-size: 11pt;
}

:deep(.item.disabled) {
  color: gray;
  cursor: default;
}

/* :deep(.item.selected) {
  background-color: var(--context-menu-selected-bg-color);
  color: var(--context-menu-selected-text-color);
  border-radius: 0.375rem;
} */

:deep(.item .chevron) {
  margin-left: auto;
  padding-left: 2rem;
}

:deep(.item .chevron-icon) {
  margin-left: auto;
  padding-left: 2rem;
  display: flex;
  align-items: center;
  opacity: 0.6;
  color: var(--context-menu-text-color);
}

</style>