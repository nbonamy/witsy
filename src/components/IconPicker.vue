<template>
  <div class="icon-picker">
    <div class="search-bar">
      <input 
        v-model="searchQuery" 
        type="text" 
        placeholder="Search icons..." 
        class="search-input"
      />
    </div>
    <div class="icon-grid">
      <div
        v-for="iconName in displayedIcons"
        :key="iconName"
        class="icon-item"
        :class="{ selected: isSelected(iconName) }"
        :title="iconName"
        @click="select(iconName)"
      >
        <component :is="iconName" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import * as BootstrapIcons from 'bootstrap-icons-vue'

const props = defineProps<{
  modelValue: string | null | undefined
  maxRows?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const searchQuery = ref('')
const maxRows = computed(() => props.maxRows ?? 4)

// Get all available icons dynamically
const allIcons = computed(() => {
  const icons: string[] = []
  for (const [key, component] of Object.entries(BootstrapIcons)) {
    if (key.startsWith('BIcon') && typeof component === 'object') {
      icons.push(key)
    }
  }
  return icons.sort()
})

// Filter icons based on search query
const filteredIcons = computed(() => {
  if (!searchQuery.value) {
    return allIcons.value
  }
  const query = searchQuery.value.toLowerCase()
  return allIcons.value.filter(iconName => 
    iconName.toLowerCase().includes(query)
  )
})

// Show all filtered icons (flexbox will handle wrapping)
const displayedIcons = computed(() => {
  return filteredIcons.value
})

function select(iconName: string) {
  // If the icon is already selected, deselect it (emit null/undefined)
  if (props.modelValue === iconName) {
    emit('update:modelValue', null)
  } else {
    emit('update:modelValue', iconName)
  }
}

function isSelected(iconName: string) {
  return props.modelValue === iconName
}

const resetFilter = () => {
  searchQuery.value = ''
}

defineExpose({
  resetFilter
})
</script>

<style scoped>
.icon-picker {
  display: inline-block;
  width: 100%;
}

.search-bar {
  margin-bottom: 0.75rem;
}

.icon-grid {
  display: flex;
  flex-wrap: wrap;
  height: calc(3 * (1.25rem + 2 * 0.25rem + 2 * 1px));
  overflow-y: auto;
  align-content: flex-start;
  scrollbar-color: var(--scrollbar-thumb-color) var(--control-list-bg-color);
}

.icon-item {
  position: relative;
  padding: 0.25rem;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  transition: all 0.2s;
  background: var(--control-background-color);

  &.selected {
    background: var(--highlight-color);
    border-color: var(--highlight-color);
    svg {
      fill: var(--highlighted-color);
    }
  }

  svg {
    width: 100%;
    height: 100%;
  }
}

</style>