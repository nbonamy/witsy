<template>
  <div class="web panel">
    <div class="panel-header" @click="togglePanel">
      <label>
        {{ t('common.web') }}
        <div class="tag info">{{ webCount() }}</div>
        <div class="subtitle">{{ t('docRepo.web.help.formats') }}</div>
      </label>
      <div class="icon"><ChevronDownIcon /></div>
    </div>
    <div class="panel-body" v-if="webResources.length">
      <template v-for="resource in webResources" :key="resource.uuid">
        <div class="panel-item">
          <div class="icon leading"><GlobeIcon /></div>
          <div class="info">
            <div class="text">{{ resource.origin }}</div>
            <div class="subtext" v-if="resource.type === 'sitemap'">{{ t('docRepo.web.pagesCount', { count: docSourceCount(resource) }) }}</div>
          </div>
          <div class="actions">
            <div class="tag info" v-if="processingItems.includes(resource.uuid)">Indexing</div>
            <div class="tag success" v-else>Ready</div>
            <RefreshCwIcon v-if="!processingItems.includes(resource.uuid)"
              class="icon refresh"
              v-tooltip="{ text: t('docRepo.web.tooltips.refresh'), position: 'left' }"
              @click="onRefresh(resource)"
            />
            <Trash2Icon
              class="icon remove"
              v-tooltip="{ text: t('common.delete'), position: 'left' }"
              @click="onDelete(resource)"
            />
          </div>
        </div>
      </template>
    </div>
    <div class="panel-empty" v-else>
      {{ t('docRepo.web.noWeb') }}
    </div>
    <div class="panel-footer">
      <button name="addUrl" @click="onAddUrl"><PlusIcon /> {{ t('docRepo.web.addUrl') }}</button>
      <button name="addWebsite" @click="onAddWebsite"><MapIcon /> {{ t('docRepo.web.addWebsite') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon, GlobeIcon, MapIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from 'lucide-vue-next'
import { computed } from 'vue'
import Dialog from '../composables/dialog'
import { togglePanel } from '../composables/panel'
import { useDocRepoEvents } from '../composables/useDocRepoEvents'
import { t } from '../services/i18n'
import { DocumentBase, DocumentSource } from 'types/rag'

// props
const props = defineProps<{
  selectedRepo: DocumentBase
}>()

// use composable for IPC events
const { loading, processingItems } = useDocRepoEvents()

const webResources = computed(() => {
  return props.selectedRepo.documents.filter(doc => ['url', 'sitemap'].includes(doc.type))
})

const docSourceCount = (source: DocumentSource): number => {
  return (source.type === 'sitemap' ? 0 : 1) + (source.items?.reduce((acc, item) => acc + docSourceCount(item), 0) ?? 0)
}

const webCount = (): number => {
  return webResources.value.reduce((acc, resource) => acc + docSourceCount(resource), 0)
}

const validateUrl = (url: string): boolean => {
  return /^https?:\/\/.+/.test(url)
}

const onAddUrl = async () => {
  if (!props.selectedRepo) return

  const result = await Dialog.show({
    target: document.querySelector('.docrepos'),
    title: t('docRepo.web.addUrl'),
    input: 'url',
    inputPlaceholder: t('docRepo.web.dialog.urlPrompt'),
    showCancelButton: true,
    inputValidator: (value) => {
      if (!value || !validateUrl(value)) {
        return t('docRepo.web.error.invalidUrl')
      }
      return null
    }
  })

  if (result.isConfirmed && result.value) {
    loading.value = true
    try {
      await window.api.docrepo.addDocument(props.selectedRepo.uuid, 'url', result.value)
    } catch (error) {
      console.error('Error adding URL:', error)
      loading.value = false
    }
  }
}

const onAddWebsite = async () => {
  if (!props.selectedRepo) return

  const result = await Dialog.show({
    target: document.querySelector('.docrepos'),
    title: t('docRepo.web.addWebsite'),
    input: 'url',
    inputPlaceholder: t('docRepo.web.dialog.sitemapPrompt'),
    showCancelButton: true,
    inputValidator: (value) => {
      if (!value || !validateUrl(value)) {
        return t('docRepo.web.error.invalidUrl')
      }
      return null
    }
  })

  if (result.isConfirmed && result.value) {
    loading.value = true
    try {
      await window.api.docrepo.addDocument(props.selectedRepo.uuid, 'sitemap', result.value)
    } catch (error) {
      console.error('Error adding website:', error)
      loading.value = false
    }
  }
}

const onRefresh = async (resource: DocumentSource) => {
  if (!props.selectedRepo) return
  loading.value = true
  try {
    // Remove and re-add to refresh content (same pattern as Notes)
    await window.api.docrepo.removeDocument(props.selectedRepo.uuid, resource.uuid)
    await window.api.docrepo.addDocument(props.selectedRepo.uuid, resource.type, resource.origin)
  } catch (error) {
    console.error('Error refreshing resource:', error)
    loading.value = false
  }
}

const onDelete = (resource: DocumentSource) => {
  Dialog.show({
    target: document.querySelector('.docrepos'),
    title: t('common.confirmation.deleteDocument'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then(async (result) => {
    if (result.isConfirmed) {
      loading.value = true
      try {
        await window.api.docrepo.removeDocument(props.selectedRepo.uuid, resource.uuid)
      } catch (error) {
        console.error('Error removing resource:', error)
        loading.value = false
      }
    }
  })
}
</script>
