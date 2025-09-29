<template>
  <ModalDialog id="memory-inspector" ref="dialog" type="window">
    <template #header>
      {{ t('memory.inspector.title') }}
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
      <div style="margin-top: 2rem" v-if="contents.length">{{ t('memory.inspector.shiftDelete') }}</div>
    </template>
    <template #footer>
      <div class="buttons">
        <button @click.prevent="onClose" formnovalidate>{{ t('common.close') }}</button>
      </div>
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
  dialog.value.close()
  emit('close')
}

defineExpose({
  show: () => {
    contents.value = window.api.memory.facts()
    dialog.value.show()
  },
})

</script>


<style scoped>

#memory-inspector {

  main {
    margin-bottom: 1rem;
    .empty {
      padding: 1em;
      font-size: 14.5px;
      text-align: center;
    }
    .sticky-table-container {
      margin-bottom: 0.5rem;
    }
    button {
      font-size: 10.5px;
      padding: 2px 8px;
    }
  }

}

</style>