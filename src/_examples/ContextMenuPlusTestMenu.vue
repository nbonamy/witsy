<template>
  <ContextMenuPlus 
    :anchor="anchor" 
    :position="position"
    @close="$emit('close')"
  >
    <template #default>
      <!-- Static menu items -->
      <div @click="handleAction('copy')">
        <BIconClipboard class="icon" />
        Copy
      </div>
      
      <div 
        data-submenu-slot="editSubmenu"
      >
        <BIconPencil class="icon" />
        Edit
      </div>
      
      <!-- Separator -->
      <div class="separator">
        <hr />
      </div>
      
      <!-- Dynamic menu items with v-for -->
      <div 
        v-for="item in dynamicMenuItems" 
        :key="item.id"
        :data-submenu-slot="item.hasSubmenu ? item.submenuSlot : undefined"
        @click="item.hasSubmenu ? undefined : handleAction(item.id)"
      >
        <component :is="item.icon" class="icon" />
        {{ item.label }}
      </div>
      
      <!-- Another separator -->
      <div class="separator">
        <hr />
      </div>
      
      <!-- Static item -->
      <div @click="handleAction('delete')">
        <BIconTrash class="icon" />
        Delete
      </div>
    </template>
    
    <!-- Static submenu with filter enabled -->
    <template #editSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div @click="handleSubmenuAction('undo')">
        <BIconArrowCounterclockwise class="icon" />
        Undo
      </div>
      <div @click="handleSubmenuAction('redo')">
        <BIconArrowClockwise class="icon" />
        Redo
      </div>
      <div class="separator">
        <hr />
      </div>
      <div @click="handleSubmenuAction('cut')">
        <BIconScissors class="icon" />
        Cut
      </div>
      <div @click="handleSubmenuAction('paste')">
        <BIconClipboard2 class="icon" />
        Paste
      </div>
    </template>
    
    <!-- Dynamic submenu: Recent Files with v-for and filter -->
    <template #recentFilesSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div 
        v-for="file in recentFiles" 
        :key="file.id"
        @click="handleFileAction(file)"
      >
        <BIconFileEarmark class="icon" />
        <div style="flex: 1;">
          <div>{{ file.name }}</div>
          <div style="font-size: 10px; opacity: 0.6;">{{ file.modified }}</div>
        </div>
      </div>
      <div class="separator">
        <hr />
      </div>
      <div @click="handleAction('browse')">
        <BIconFolder class="icon" />
        Browse for file...
      </div>
    </template>
    
    <!-- Dynamic submenu: Settings with v-for -->
    <template #settingsSubmenu>
      <div 
        v-for="setting in settingsCategories" 
        :key="setting.id"
        @click="handleSettingsAction(setting)"
      >
        <component :is="setting.icon" class="icon" />
        {{ setting.label }}
      </div>
    </template>
  </ContextMenuPlus>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ContextMenuPlus, { type MenuPosition } from '../components/ContextMenuPlus.vue'

defineProps({
  anchor: {
    type: String,
    required: true
  },
  position: {
    type: String as () => MenuPosition,
    default: 'below'
  }
})

defineEmits(['close'])

// Dynamic menu items using computed
const dynamicMenuItems = computed(() => [
  {
    id: 'open',
    label: 'Open Recent',
    icon: 'BIconFolder',
    hasSubmenu: true,
    submenuSlot: 'recentFilesSubmenu'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'BIconGear',
    hasSubmenu: true,
    submenuSlot: 'settingsSubmenu'
  }
])

// Dynamic recent files
const recentFiles = computed(() => [
  { id: 1, name: 'Project1.vue', path: '/projects/project1.vue', modified: '2 hours ago' },
  { id: 2, name: 'Component.js', path: '/src/component.js', modified: '1 day ago' },
  { id: 3, name: 'README.md', path: '/docs/readme.md', modified: '3 days ago' },
  { id: 4, name: 'config.json', path: '/config/config.json', modified: '1 week ago' }
])

// Dynamic settings categories
const settingsCategories = computed(() => [
  { id: 'general', label: 'General', icon: 'BIconGear' },
  { id: 'appearance', label: 'Appearance', icon: 'BIconPalette' },
  { id: 'editor', label: 'Editor', icon: 'BIconCode' },
  { id: 'extensions', label: 'Extensions', icon: 'BIconPuzzle' }
])

const handleAction = (action: string) => {
  console.log('Action clicked:', action)
}

const handleSubmenuAction = (action: string) => {
  console.log('Submenu action clicked:', action)
}

const handleFileAction = (file: any) => {
  console.log('File selected:', file.name, file.path)
}

const handleSettingsAction = (setting: any) => {
  console.log('Settings category:', setting.label)
}
</script>