<template>
  <div class="actions">
    <button name="new" @click.prevent="onNew">{{ t('settings.commands.new') }}</button>
    <button name="edit" @click.prevent="onEdit(selected)" :disabled="!selected">{{ t('common.edit') }}</button>
    <button name="delete" @click.prevent="onDelete" :disabled="!selected">{{ t('common.delete') }}</button>
    <div class="right">
      <button name="more" @click.prevent.stop="onMore" ref="moreButton">{{ t('settings.commands.more') }} {{ showMenu ? '▼' : '▲'}}</button>
    </div>
  </div>
  <div class="commands sticky-table-container">
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.field" :class="column.field">{{ column.title }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="command in visibleCommands" :key="command.id" :data-id="command.id" class="command" :class="selected?.id == command.id ? 'selected' : ''"
            @click="onSelect(command)" @dblclick="onEdit(command)" draggable="true" @dragstart="reorderCommands.onDragStart" @dragover="reorderCommands.onDragOver" @dragend="reorderCommands.onDragEnd"
        >
          <td class="enabled"><input type="checkbox" :checked="command.state=='enabled'" @click="onEnabled(command)" /></td>
          <td class="icon">{{ command.icon }}</td>
          <td class="label">{{ label(command) }}</td>
          <td class="shortcut">{{ command.shortcut }}</td>
          <td class="move">
            <button @click.prevent="onMoveDown(command)" @dblclick.stop>▼</button>
            <button @click.prevent="onMoveUp(command)" @dblclick.stop>▲</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ContextMenu v-if="showMenu" :on-close="closeContextMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" position="right" :teleport="false" />
  <CommandDefaults ref="defaults" />
</template>

<script setup lang="ts">

import { Command } from '../types'
import { Ref, ref, computed } from 'vue'
import { store } from '../services/store'
import { t, commandI18n } from '../services/i18n'
import { saveCommands } from '../services/commands'
import useReorderTable from '../composables/reorder_table'
import CommandDefaults from '../screens/CommandDefaults.vue'
import ContextMenu from '../components/ContextMenu.vue'
import Dialog from '../composables/dialog'

const commands: Ref<Command[]> = ref(null)
const selected: Ref<Command> = ref(null)
const defaults: Ref<typeof CommandDefaults> = ref(null)
const moreButton: Ref<HTMLElement> = ref(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const reorderCommands = useReorderTable((ids: string[]) => {
  commands.value.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  save()
})

const emit = defineEmits([ 'create', 'edit' ])

const contextMenuActions = [
  { label: t('settings.commands.defaults'), action: 'defaults' },
  { label: t('settings.commands.export'), action: 'export' },
  { label: t('settings.commands.import'), action: 'import' },
  { label: t('settings.commands.selectAll'), action: 'select' },
  { label: t('settings.commands.unselectAll'), action: 'unselect' },
]

const visibleCommands = computed(() => commands.value?.filter((command: Command) => command.state != 'deleted'))

const label = (command: Command) => {
  return command.label || commandI18n(command, 'label')
}

const columns = [
  { field: 'enabled', title: '' },
  { field: 'icon', title: t('common.icon') },
  { field: 'label', title: t('common.name'), },
  { field: 'shortcut', title: t('common.shortcut'), },
  { field: 'move', title: t('common.move'), },
]

const onMoveDown = (command: Command) => {
  if (reorderCommands.moveDown(command, commands.value, '.settings .commands .sticky-table-container')) {
    save()
  }
}

const onMoveUp = (command: Command) => {
  if (reorderCommands.moveUp(command, commands.value, '.settings .commands .sticky-table-container')) {
    save()
  }
}

const onMore = () => {
  if (showMenu.value) {
    closeContextMenu()
  } else {
    showContextMenu()
  }
}

const showContextMenu = () => {
  showMenu.value = true
  const rcButton = moreButton.value.getBoundingClientRect()
  const rcContent = moreButton.value.closest('.tab-content').getBoundingClientRect()
  menuX.value = rcContent.right - rcButton.right
  menuY.value = rcButton.bottom + 8
}

const closeContextMenu = () => {
  showMenu.value = false;
}

const handleActionClick = async (action: string) => {

  // close
  closeContextMenu()

  // process
  if (action === 'select') {
    commands.value.forEach((command: Command) => command.state = 'enabled')
    save()
  } else if (action === 'unselect') {
    commands.value.forEach((command: Command) => command.state = 'disabled')
    save()
  } else if (action === 'defaults') {
    onDefaults()
  } else if (action === 'import') {
    onImport()
  } else if (action === 'export') {
    onExport()
  }

}

const onDefaults = () => {
  defaults.value.show()
}

const onImport = () => {
  if (window.api.commands.import()) {
    store.loadCommands()
    load()
    Dialog.alert(t('settings.commands.importSuccess'))
  } else {
    Dialog.alert(t('settings.commands.importError'))
  }
}

const onExport = () => {
  if (window.api.commands.export()) {
    Dialog.alert(t('settings.commands.exportSuccess'))
  } else {
    Dialog.alert(t('settings.commands.exportError'))
  }
}

const onSelect = (command: Command) => {
  selected.value = command
}

const onNew = () => {
  emit('create', selected.value)
}

const onEdit = (command: Command) => {
  emit('edit', command)
}

const onDelete = () => {
  Dialog.show({
    target: document.querySelector('.settings .commands'),
    title: t('settings.commands.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      if (selected.value.type == 'system') {
        selected.value.state = 'deleted'
      } else {
        const index = commands.value.indexOf(selected.value)
        commands.value.splice(index, 1)
      }
      selected.value = null
      save()
    }
  })
}

const onEnabled = (command: Command) => {
  command.state = (command.state == 'enabled' ? 'disabled' : 'enabled')
  save()
}

const load = () => {
  commands.value = JSON.parse(JSON.stringify(store.commands))
}

const save = () => {
  store.commands = commands.value
  saveCommands()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/sticky-header-table.css';
</style>

<style scoped>

.actions {
  margin-bottom: 1rem;
}

</style>
