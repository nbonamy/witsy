<template>
  <div
    v-if="visible"
    class="command-palette-backdrop"
    @click="close"
  >
      <div class="command-palette" @click.stop>
        <input
          ref="searchInput"
          v-model="searchQuery"
          class="search-input"
          :placeholder="t('commandPalette.placeholder')"
          @keydown="onKeyDown"
        />
        <div class="results" ref="resultsList">
          <!-- Recent commands section -->
          <template v-if="!searchQuery && recentCommands.length > 0">
            <div class="section-header">{{ t('commandPalette.recent') }}</div>
            <div
              v-for="(command, index) in recentCommands"
              :key="'recent-' + command.id"
              :class="{
                'result-item': true,
                'selected': index === selectedIndex,
                'disabled': !command.enabled
              }"
              @mousemove="selectedIndex = index"
              @click="executeCommand(command)"
            >
              <div class="icon" v-if="command.icon">{{ command.icon }}</div>
              <div class="label">{{ command.label }}</div>
              <div class="shortcut" v-if="command.shortcut">{{ command.shortcut }}</div>
            </div>
            <div class="separator"></div>
          </template>

          <!-- All commands (filtered and sorted) -->
          <div
            v-for="(command, index) in displayCommands"
            :key="command.id"
            :class="{
              'result-item': true,
              'selected': index + recentOffset === selectedIndex,
              'disabled': !command.enabled
            }"
            @mousemove="selectedIndex = index + recentOffset"
            @click="command.enabled && executeCommand(command)"
          >
            <div class="icon" v-if="command.icon">{{ command.icon }}</div>
            <div class="label">{{ command.label }}</div>
            <div class="shortcut" v-if="command.shortcut">{{ command.shortcut }}</div>
          </div>

          <div class="no-results" v-if="allCommands.length === 0">
            {{ t('commandPalette.noResults') }}
          </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { t } from '../services/i18n'
import { commandRegistry } from '../services/command_registry'
import type { CommandPaletteItem } from '../services/command_registry'

const visible = ref(false)
const searchQuery = ref('')
const selectedIndex = ref(0)
const searchInput = ref<HTMLInputElement>()
const resultsList = ref<HTMLElement>()

const recentCommands = computed(() => {
  if (searchQuery.value) return []
  return commandRegistry.getRecent()
})

const recentOffset = computed(() => {
  return searchQuery.value ? 0 : recentCommands.value.length
})

const allCommands = computed(() => {
  if (!searchQuery.value) {
    // All commands, alphabetically sorted, excluding recent
    const all = commandRegistry.getAll()
    const recentIds = new Set(recentCommands.value.map(c => c.id))
    return all
      .filter(c => !recentIds.has(c.id))
      .sort((a, b) => a.label.localeCompare(b.label))
  }
  // Searched and sorted by relevance, then alphabetically
  return commandRegistry.search(searchQuery.value)
})

const displayCommands = computed(() => allCommands.value)

const show = async () => {
  visible.value = true
  searchQuery.value = ''
  selectedIndex.value = 0
  await nextTick()
  searchInput.value?.focus()
}

const close = () => {
  visible.value = false
  searchQuery.value = ''
}

const executeCommand = async (command: CommandPaletteItem) => {
  if (!command.enabled) return

  commandRegistry.markAsExecuted(command.id)
  close()
  await nextTick()
  await command.callback()
}

const onKeyDown = (e: KeyboardEvent) => {
  const totalCommands = recentCommands.value.length + allCommands.value.length

  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const allItems = [...recentCommands.value, ...allCommands.value]
    const selected = allItems[selectedIndex.value]
    if (selected?.enabled) {
      executeCommand(selected)
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    // Skip disabled items
    let newIndex = selectedIndex.value + 1
    const allItems = [...recentCommands.value, ...allCommands.value]
    while (newIndex < allItems.length && !allItems[newIndex].enabled) {
      newIndex++
    }
    selectedIndex.value = Math.min(newIndex, totalCommands - 1)
    ensureVisible()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    // Skip disabled items
    let newIndex = selectedIndex.value - 1
    const allItems = [...recentCommands.value, ...allCommands.value]
    while (newIndex >= 0 && !allItems[newIndex].enabled) {
      newIndex--
    }
    selectedIndex.value = Math.max(newIndex, 0)
    ensureVisible()
  }
}

const ensureVisible = () => {
  nextTick(() => {
    const selectedEl = resultsList.value?.querySelector('.selected')
    if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
      selectedEl.scrollIntoView({ block: 'nearest' })
    }
  })
}

// Watch for search changes, reset selection to first enabled
watch(searchQuery, () => {
  const allItems = [...recentCommands.value, ...allCommands.value]
  selectedIndex.value = allItems.findIndex(c => c.enabled)
  if (selectedIndex.value === -1) selectedIndex.value = 0
})

defineExpose({ show, close })
</script>

<style scoped>
.command-palette-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  z-index: 1000;
}

.command-palette {
  width: 600px;
  max-height: 400px;
  background-color: var(--context-menu-bg-color);
  color: var(--context-menu-text-color);
  border-radius: 0.5rem;
  box-shadow: var(--window-box-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-input {
  width: 100%;
  padding: 1rem;
  font-size: 16px;
  border: none;
  background: transparent;
  color: var(--context-menu-text-color);
  outline: none;
  border-bottom: 1px solid var(--border-color);
}

.search-input::placeholder {
  color: var(--faded-text-color);
}

.results {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.section-header {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--faded-text-color);
  padding: 0.5rem 0.75rem;
  margin-top: 0.25rem;
  letter-spacing: 0.5px;
}

.separator {
  height: 1px;
  background-color: var(--border-color);
  margin: 0.5rem 0;
}

.result-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0.5rem 0.75rem;
  font-size: 14.5px;
  cursor: pointer;
  border-radius: 0.375rem;
  min-height: 40px;
}

.result-item.selected {
  background-color: var(--highlight-color);
  color: var(--highlighted-color);
}

.result-item.disabled {
  color: var(--faded-text-color);
  cursor: not-allowed;
  opacity: 0.5;
}

.result-item.disabled.selected {
  background-color: transparent;
  color: var(--faded-text-color);
}

.icon {
  flex: 0 0 24px;
  font-size: 17.5px;
  text-align: center;
  margin-right: 8px;
}

.label {
  flex: 1;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.shortcut {
  flex: 0 0 auto;
  display: inline-block;
  border: 1px solid var(--icon-color);
  color: var(--icon-color);
  border-radius: 4px;
  font-size: 10.5px;
  padding: 2px 6px;
  margin-left: 8px;
}

.result-item.selected .shortcut {
  border-color: var(--highlighted-color);
  color: var(--highlighted-color);
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: var(--faded-text-color);
  font-size: 14px;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--faded-text-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--icon-color);
}
</style>
