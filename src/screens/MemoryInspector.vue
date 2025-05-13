<template>
  <ModalDialog id="memory-inspector" ref="dialog" :icon="false" :width="400">
    <template #header>
      <div class="title">{{ t('memory.inspector.title') }}</div>
    </template>
    <template #body>
      <div class="empty" v-if="contents.length == 0">{{ t('memory.inspector.noFacts') }}</div>
      <div class="sticky-table-container" v-else>
        <table>
          <thead>
            <tr>
              <th>{{ t('memory.inspector.memory') }}</th>
              <th>&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fact in contents">
              <td>{{ fact.content }}</td>
              <td>
                <button @click.prevent="onDelete($event, fact)">{{ t('common.delete') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="contents.length">{{ t('memory.inspector.shiftDelete') }}</div>
    </template>
    <template #footer>
      <button @click.prevent="onClose">{{ t('common.close') }}</button>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { t } from '../services/i18n'
import { MemoryFact } from '../types/index'
import ModalDialog from '../components/ModalDialog.vue'
import Dialog from '../composables/dialog'

const dialog = ref(null)
const contents = ref([])

const emit = defineEmits(['close'])

const onDelete = (event: MouseEvent, fact: MemoryFact) => {

  const deleteFact = (fact: MemoryFact) => {
    window.api.memory.delete(fact.uuid)
    contents.value = window.api.memory.facts()
  }

  if (event.shiftKey) {
    deleteFact(fact)
    return
  }

  Dialog.show({
    target: document.querySelector('.settings .memory'),
    title: t('common.confirmation.deleteMemory'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      deleteFact(fact)
    }
  })
}

const onClose = () => {
  dialog.value.close('#memory-inspector')
  emit('close')
}

defineExpose({
  show: () => {
    contents.value = [
      { content: 'hello' }
    ]//window.api.memory.facts()
    dialog.value.show('#memory-inspector')
  },
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/sticky-header-table.css';
</style>

<style scoped>

.empty {
  padding: 1em;
  font-size: 11pt;
  text-align: center;
}

.sticky-table-container {
  margin: 1rem 0;
  min-height: 200px;

  table td {
    white-space: normal;
  }

  button {
    font-size: 8pt;
    padding: 2px 8px;
  }

}

</style>