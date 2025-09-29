<template>
  <ModalDialog id="tool-selector" ref="dialog" type="window" @save="onSave">
    <template #header>
      {{ t('toolSelector.title') }}
    </template>
    <template #body>
      <ToolTable v-model="selection" @toggle="selection = toolTable.toggleTool(selection, $event)" ref="toolTable" />
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="all" @click="selection = null" class="secondary">{{ t('common.selectAll') }}</button>
        <button name="none" @click="selection = []" class="secondary">{{ t('common.selectNone') }}</button>
        <button name="save" @click="onSave" class="primary">{{ t('common.save') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ToolSelection } from '../types/llm'
import { ref } from 'vue'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import ToolTable from '../components/ToolTable.vue'

const dialog = ref(null)
const toolTable = ref(null)
const selection = ref<string[]>([])

const emit = defineEmits(['save'])

const close = () => {
  dialog.value.close()
}

const onCancel = () => {
  close()
}

const onSave = () => {
  close()
  emit('save', selection.value)
}

defineExpose({
  show: async (tools: ToolSelection) => {
    selection.value = JSON.parse(JSON.stringify(tools))
    await toolTable.value.initTools()
    dialog.value.show()
  },
  close,
})

</script>

<style>

#tool-selector {
  .tools {
    .tool {

      th, td {
        vertical-align: top;
      }

      .tool-description {
        div {
          white-space: wrap;
          max-height: 3lh;
          overflow-y: clip;
          text-overflow: ellipsis;
        }
      }
    }
  }
}

</style>
