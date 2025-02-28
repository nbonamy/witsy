<template>
  <dialog class="memory">
    <form method="dialog">
      <header>
        <div class="title">{{ t('memory.inspector.title') }}</div>
      </header>
      <main>
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
                  <button @click.prevent="onDelete(fact)">{{ t('common.delete') }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
      <footer>
        <button @click.prevent="onClose">{{ t('common.close') }}</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n' 
const { t } = useI18n()

import { ref } from 'vue'
import { MemoryFact } from '../types/index'
import Dialog from '../composables/dialog'

const contents = ref([])

const emit = defineEmits(['close'])

const onDelete = (fact: MemoryFact) => {
  Dialog.show({
    target: document.querySelector('.settings .memory'),
    title: t('common.confirmation.deleteMemory'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.memory.delete(fact.uuid)
      contents.value = window.api.memory.facts()
    }
  })
}

const onClose = () => {
  document.querySelector<HTMLDialogElement>('dialog.memory').close()
  emit('close')
}

defineExpose({
  show: () => {
    contents.value = window.api.memory.facts()
    document.querySelector<HTMLDialogElement>('dialog.memory').showModal()
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