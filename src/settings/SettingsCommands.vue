<template>
  <form class="tab-content vertical large" @click="closeContextMenu">
    <header>
      <div class="title">{{ t('settings.tabs.commands') }}</div>
    </header>
    <main>
      <div class="commands sticky-table-container">
        <table>
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.field">{{ column.title }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="command in visibleCommands" :key="command.id" :data-id="command.id" class="command" :class="selected?.id == command.id ? 'selected' : ''"
                @click="onSelect(command)" @dblclick="onEdit(command)" draggable="true" @dragstart="onDragStart" @dragover="onDragOver" @dragend="onDragEnd"
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
      <div class="actions">
        <button name="new" @click.prevent="onNew">{{ t('settings.commands.new') }}</button>
        <button name="edit" @click.prevent="onEdit(selected)" :disabled="!selected">{{ t('common.edit') }}</button>
        <button name="delete" @click.prevent="onDelete" :disabled="!selected">{{ t('common.delete') }}</button>
        <div class="right">
          <button name="more" @click.prevent.stop="onMore" ref="moreButton">{{ t('settings.commands.more') }} {{ showMenu ? '▼' : '▲'}}</button>
        </div>
      </div>
    </main>
    <ContextMenu v-if="showMenu" :on-close="closeContextMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" position="above-right" :teleport="false" />
    <CommandDefaults ref="defaults" />
    <CommandEditor ref="editor" :command="edited" @command-modified="onCommandModified"/>
  </form>
</template>

<script setup lang="ts">

import { Command } from '../types'
import { Ref, ref, computed } from 'vue'
import { store } from '../services/store'
import { t, commandI18n } from '../services/i18n'
import { v4 as uuidv4 } from 'uuid'
import { newCommand, saveCommands } from '../services/commands'
import CommandDefaults from '../screens/CommandDefaults.vue'
import CommandEditor from '../screens/CommandEditor.vue'
import ContextMenu from '../components/ContextMenu.vue'
import Dialog from '../composables/dialog'

const commands: Ref<Command[]> = ref(null)
const selected: Ref<Command> = ref(null)
const edited: Ref<Command> = ref(null)
const defaults: Ref<typeof CommandDefaults> = ref(null)
const editor = ref(null)
const moreButton: Ref<HTMLElement> = ref(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

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
  // move command up in commands
  const index = commands.value.indexOf(command)
  if (index < commands.value.length - 1) {
    commands.value.splice(index, 1)
    commands.value.splice(index + 1, 0, command)
    save()

    try {
      // scroll commands down by one line
      if (index != 0) {
        const row = document.querySelector(`.commands .command:first-child`)
        document.querySelector('dialog.settings .content .commands').scrollBy(0, row.clientHeight)
      }
    } catch {}

  }

}

const onMoveUp = (command: Command) => {
  // move command down in commands
  const index = commands.value.indexOf(command)
  if (index > 0) {
    commands.value.splice(index, 1)
    commands.value.splice(index - 1, 0, command)
    save()

    try {
      // scroll commands down by one line
      const row = document.querySelector(`.commands .command:first-child`)
      document.querySelector('dialog.settings .content .commands').scrollBy(0, -row.clientHeight)
    } catch {}
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
  const rcDialog = moreButton.value.closest('.tab-content').getBoundingClientRect()
  menuX.value = rcDialog.right - rcButton.right
  menuY.value = rcDialog.bottom - rcButton.bottom + rcButton.height + 8
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
  selected.value = null
  edited.value = newCommand()
  editor.value.show()
}

const onEdit = (command: Command) => {
  edited.value = command
  selected.value = command
  editor.value.show()
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

const onCommandModified = (payload: Command) => {

  // cancel
  if (!payload) {
    edited.value = null
    return
  }

  // new command?
  let command = null
  if (payload.id == null) {
    command = newCommand()
    command.id = uuidv4()
    commands.value.push(command)
  } else {
    command = commands.value.find((command: Command) => command.id == payload.id)
  }

  // update
  if (command) {

    // single shortcut
    if (payload.shortcut) {
      for (const c of commands.value) {
        if (c.id != command.id && c.shortcut == payload.shortcut) {
          c.shortcut = null
        }
      }
    }

    // now update
    command.label = payload.label
    command.icon = payload.icon
    command.action = payload.action
    command.template = payload.template
    command.shortcut = payload.shortcut
    command.engine = payload.engine
    command.model = payload.model
  }

  // done
  selected.value = command
  editor.value.close()
  edited.value = null
  save()

}

var draggedRow: HTMLElement
const onDragStart = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  draggedRow = target.closest('tr')
}

const onDragOver = (event: MouseEvent) => {
  
  event.preventDefault();
  
  const target = (event.target as HTMLElement).closest('tr')
  const targetIndex = Array.from(target.parentNode.children).indexOf(target);
  const draggedRowIndex = Array.from(draggedRow.parentNode.children).indexOf(draggedRow);

  // Determine where to place the dragged row
  if (targetIndex > draggedRowIndex) {
    target.after(draggedRow);
  } else {
    target.before(draggedRow);
  }
  
  // reorder array
  const rows = document.querySelectorAll('tr[data-id]');
  const newOrderIds = Array.from(rows).map(row => row.getAttribute('data-id'));
  commands.value.sort((a: Command, b: Command) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));

}

const onDragEnd = () => {
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

</style>
