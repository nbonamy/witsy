<template>
  <div class="list-with-actions">
    <div class="sticky-table-container">
      <table class="list">
        <thead>
          <tr>
            <th>{{ t('common.key') }}</th>
            <th>{{ t('common.value') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(value, key) in variables" :key="key" :class="{ selected: selectedVariable?.key == key }" @click="onSelectVariable(key)" @dblclick="onEditVariable(key)" >
            <td>{{ key }}</td>
            <td>{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="actions">
      <button ref="addButton" class="button add" @click.prevent="onAddVariable"><BIconPlus /></button>
      <button class="button remove" @click.prevent="onDeleteVariable" :disabled="!selectedVariable"><BIconDash /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'

const props = defineProps({
  variables: {
    type: Object as () => Record<string, string>,
    required: true
  },
  selectedVariable: {
    type: Object as () => { key: string, value: string } | null,
    default: null
  }
})

const emit = defineEmits(['select', 'add', 'edit', 'delete'])

const onSelectVariable = (key: string) => {
  emit('select', key)
}

const onAddVariable = () => {
  emit('add')
}

const onDeleteVariable = () => {
  if (!props.selectedVariable) return
  Dialog.show({
    target: document.querySelector('.main'),
    title: t('common.confirmation.delete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      emit('delete', props.selectedVariable.key)
    }
  })
}

const onEditVariable = (key: string) => {
  emit('edit', key )
}
</script>

<style scoped>
@import '../../css/list-with-actions.css';
@import '../../css/sticky-header-table.css';

.sticky-table-container {
  height: 100px;
}

.sticky-table-container td {
  max-width: 60px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>