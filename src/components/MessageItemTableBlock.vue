<template>
  <div class="artifact panel">
    
    <div class="icon download" @click="onDownloadClick" ref="downloadButton">
      <DownloadIcon class="icon"/>
    </div>
    
    <div class="panel-body variable-font-size" v-html="content">
    </div>

    <ContextMenu
      v-if="showDownloadMenu"
      @close="closeDownloadMenu"
      :actions="downloadMenuActions"
      @action-clicked="onDownloadFormat"
      :x="downloadMenuX"
      :y="downloadMenuY"
      position="below"
    />

  </div>
</template>

<script setup lang="ts">

import { DownloadIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { t } from '../services/i18n'
import { arrayToCSV, arrayToXLSX, downloadFile, parseHtmlTable } from '../services/table_data'
import ContextMenu from './ContextMenu.vue'

const downloadButton = ref<HTMLElement>()
const showDownloadMenu = ref(false)
const downloadMenuX = ref(0)
const downloadMenuY = ref(0)

const downloadMenuActions = computed(() => {
  return [
    { label: t('common.downloadCsv'), action: 'csv', disabled: false },
    { label: t('common.downloadXlsx'), action: 'xlsx', disabled: false },
  ]
})

const props = defineProps({
  content: {
    type: String,
    required: true,
  },
})

const onDownloadClick = () => {
  if (showDownloadMenu.value) {
    closeDownloadMenu()
  } else {
    showDownloadContextMenu()
  }
}

const showDownloadContextMenu = () => {
  showDownloadMenu.value = true
  const rcButton = downloadButton.value.getBoundingClientRect()
  downloadMenuX.value = rcButton.left - 90
  downloadMenuY.value = rcButton.bottom - 24
}

const closeDownloadMenu = () => {
  showDownloadMenu.value = false
}

const onDownloadFormat = async (action: string) => {
  // close menu
  closeDownloadMenu()

  // Parse the HTML table
  const data = parseHtmlTable(props.content)

  if (data.length === 0) {
    console.error('No table data found')
    return
  }

  let filename = 'table'
  let fileContent: string | Blob

  switch (action) {
    case 'csv':
      fileContent = arrayToCSV(data)
      filename = 'table.csv'
      break

    case 'xlsx':
      fileContent = arrayToXLSX(data)
      filename = 'table.xlsx'
      break

    default:
      return
  }

  downloadFile(fileContent, filename)
}

</script>

<style scoped>

.panel {

  position: relative;

  .icon.download {
    position: absolute;
    top: 0.75rem;
    right: 1rem;
    opacity: 0.6;
    cursor: pointer;
    z-index: 2;
  }

  .panel-body {
    overflow-x: auto;
    padding-bottom: 0.5rem;

    &:deep() {
      table {
        margin: 0rem !important;
        width: 100%;

        th:last-child {
          padding-right: 1rem;
        }
      }
    }
  }
}
</style>

