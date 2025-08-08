<template>
  <ModalDialog id="folder-contents" ref="dialog" >
    <template #header>
      {{ title }}
    </template>
    <template #body>
      <div class="sticky-table-container">
        <table class="table-plain">
          <thead>
            <tr>
              <th>{{ t('common.filename') }}</th>
              <th>{{ t('common.path') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in files" :key="file.path">
              <td>{{ file.filename }}</td>
              <td>{{ file.relativePath }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button @click="onClose" formnovalidate>{{ t('common.close') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { DocumentSource } from '../types/rag'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'

// Props
const props = defineProps({
  folder: {
    type: Object as () => DocumentSource | null,
  }
})

const dialog = ref(null)
  
const emit = defineEmits(['close'])

// Computed
const title = computed(() => {
  return props.folder?.filename || ''
})

const files = computed(() => {
  if (!props.folder || props.folder.type !== 'folder') return []
  return extractFolderFiles(props.folder)
})

// Methods
const show = () => {
  dialog.value?.show()
}

const close = () => {
  dialog.value?.close()
}

const onClose = () => {
  close()
}

const extractFolderFiles = (folder: DocumentSource): Array<{ filename: string, relativePath: string, path: string }> => {
  if (folder.type !== 'folder') return []
  
  const results: Array<{ filename: string, relativePath: string, path: string }> = []
  
  // Helper functions for path operations
  const getBasename = (fullPath: string): string => {
    const parts = fullPath.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || ''
  }
  
  const getDirname = (fullPath: string): string => {
    const parts = fullPath.replace(/\\/g, '/').split('/')
    parts.pop() // remove filename
    return parts.join('/')
  }
  
  const getRelativePath = (from: string, to: string): string => {
    const fromParts = from.replace(/\\/g, '/').split('/').filter(p => p)
    const toParts = to.replace(/\\/g, '/').split('/').filter(p => p)
    
    // Find common prefix
    let i = 0
    while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
      i++
    }
    
    // Calculate relative path
    const upLevels = fromParts.length - i
    const downPath = toParts.slice(i)
    
    if (upLevels === 0 && downPath.length === 0) {
      return '.'
    }
    
    const result = [...Array(upLevels).fill('..'), ...downPath].join('/')
    return result || '.'
  }
  
  const processItem = (item: DocumentSource, basePath: string) => {
    if (item.type === 'file') {
      const fullPath = item.origin
      const dirPath = getDirname(fullPath)
      const relativePath = getRelativePath(basePath, dirPath)
      const filename = getBasename(fullPath)
      results.push({
        filename,
        relativePath,
        path: fullPath
      })
    } else if (item.type === 'folder' && item.items) {
      // Recursively process folder contents
      item.items.forEach(subItem => processItem(subItem, basePath))
    }
  }
  
  if (folder.items) {
    folder.items.forEach(item => processItem(item, folder.origin))
  }
  
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath) || a.filename.localeCompare(b.filename))
}

// Expose methods
defineExpose({
  show,
})

</script>

<style>

#folder-contents .swal2-popup {
  width: 48rem;
  max-width: 48rem;
}

</style>
