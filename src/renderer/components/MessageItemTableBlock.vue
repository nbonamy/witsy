<template>
  <div class="artifact panel">

    <ContextMenuTrigger class="icon download" position="below-right" ref="downloadButton">
      <template #trigger>
        <DownloadIcon class="icon"/>
      </template>
      <template #menu>
        <div class="item" @click="onDownloadFormat('csv')">{{ t('common.downloadCsv') }}</div>
        <div class="item" @click="onDownloadFormat('xlsx')">{{ t('common.downloadXlsx') }}</div>
      </template>
    </ContextMenuTrigger>

    <div class="panel-body variable-font-size" v-html="content">
    </div>

  </div>
</template>

<script setup lang="ts">

import { DownloadIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { t } from '@services/i18n'
import { arrayToCSV, arrayToXLSX, downloadFile, parseHtmlTable } from '@services/table_data'
import ContextMenuTrigger from './ContextMenuTrigger.vue'

const downloadButton = ref<HTMLElement>()

const props = defineProps({
  content: {
    type: String,
    required: true,
  },
})

const onDownloadFormat = async (action: string) => {

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

.artifact {

  position: relative;
  user-select: text;

  border-color: transparent;
  &:hover {
    border-color: color-mix(in srgb, var(--border-color), transparent 30%);
  }

  .icon.download {
    display: none;
    position: absolute;
    top: 0.25rem;
    right: 1rem;
    opacity: 0.6;
    cursor: pointer;
    z-index: 2;
  }

  &:hover .icon.download {
    display: inline-block;
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

