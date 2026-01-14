<template>
  <div class="icon-picker">
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="t('webapps.iconSearch')"
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
        <component :is="getIcon(iconName)" class="icon-svg" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { icons } from 'lucide-vue-next'
import { t } from '@services/i18n'

const props = defineProps<{
  modelValue: string | null | undefined
  maxRows?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const searchQuery = ref('')

const allIcons = computed(() => {
  return Object.keys(icons).sort()
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

const getIcon = (iconName: string) => {
  return (icons as any)[iconName]
}

function select(iconName: string) {
  emit('update:modelValue', iconName)
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
  height: calc(6 * (1.25rem + 2 * 0.25rem + 2 * 1px));
  overflow-y: auto;
  align-content: flex-start;
  scrollbar-color: var(--scrollbar-thumb-color) var(--control-list-bg-color);
  background: var(--control-bg-color);
}

.icon-item {
  position: relative;
  padding: 0.375rem;
  width: var(--icon-xl);
  height: var(--icon-xl);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  transition: all 0.2s;
  background: var(--control-bg-color);

  &.selected {
    background: var(--highlight-color);
    border-color: var(--highlight-color);
    svg {
      stroke: var(--highlighted-color);
      fill: var(--highlight-color);
    }
  }

  .icon-svg {
    width: 100%;
    height: 100%;
  }
}

</style>