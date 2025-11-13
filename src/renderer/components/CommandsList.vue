<template>
  <div class="list-with-toolbar">

    <div class="toolbar" v-if="visibleCommands.length > 0">
      <div class="functional-controls">
        <div class="item-count">
          <input type="checkbox" v-model="allSelected" @change="onToggleAll" />
          <span>{{ selectedCommands.length > 0 ? t('settings.commands.itemsSelected', { count: selectedCommands.length }) : t('settings.commands.itemCount', { count: visibleCommands.length }) }}</span>
        </div>
        <div class="actions">

          <button type="button" class="primary" name="new" @click="onNew" v-if="selectedCommands.length === 0"><PlusIcon />{{ t('settings.commands.new') }}</button>
          <button type="button" class="primary" name="copy" @click="onCopy" v-if="selectedCommands.length === 1"><PlusIcon />{{ t('common.copy') }}</button>
          <button type="button" class="secondary" name="toggle" @click="onToggle" v-if="selectedCommands.length"><ListTodoIcon />{{ t('settings.commands.toggle') }}</button>
          <button type="button" class="secondary" name="delete" @click="onDelete" v-if="selectedCommands.length"><Trash2Icon />{{ t('common.delete') }}</button>

        </div>
      </div>

      <div class="actions">

        <ContextMenuTrigger class="toolbar-menu" position="below-right" :bordered="true">
          <template #menu>
            <div class="item" @click="handleActionClick('defaults')">{{ t('settings.commands.defaults') }}</div>
            <div class="item" @click="handleActionClick('export')">{{ t('settings.commands.export') }}</div>
            <div class="item" @click="handleActionClick('import')">{{ t('settings.commands.import') }}</div>
          </template>
        </ContextMenuTrigger>

      </div>
    </div>

    <table class="table-plain" v-if="visibleCommands.length > 0">
      <thead>
        <tr>
          <th>{{ t('common.name') }}</th>
          <th>{{ t('common.shortcut') }}</th>
          <th>{{ t('common.status') }}</th>
          <th>{{ t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="command in visibleCommands" :key="command.id" :data-id="command.id" class="command" :class="{ selected: selectedCommands.includes(command.id) }"
            draggable="true" @dragstart="reorderCommands.onDragStart" @dragover="reorderCommands.onDragOver" @dragend="reorderCommands.onDragEnd">
          <td class="name">
            <div>
              <input type="checkbox" :value="command.id" v-model="selectedCommands" />
              <span>{{ command.icon }}</span>
              {{ label(command) }}
            </div>
          </td>
          <td class="shortcut">{{ command.shortcut }}</td>
          <td class="enabled">
            <ButtonSwitch :checked="command.state=='enabled'" @change="() => onEnabled(command)" />
          </td>
          <td>
            <div class="actions">
              <ButtonIcon class="edit" @click="onEdit(command)"><PencilIcon /></ButtonIcon>
              <ContextMenuTrigger position="below-right">
                <template #menu>
                  <div class="item" @click="onDeleteSingle(command)">{{ t('common.delete') }}</div>
                  <div class="item" @click="onMoveUp(command)">{{ t('common.moveUp') }}</div>
                  <div class="item" @click="onMoveDown(command)">{{ t('common.moveDown') }}</div>
                </template>
              </ContextMenuTrigger>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="empty-state" v-if="visibleCommands.length === 0">
      <p>{{ t('settings.commands.empty') }}</p>
      <button type="button" class="primary" @click="onNew">
        <PlusIcon />
        {{ t('settings.commands.new') }}
      </button>
    </div>
  </div>
  <CommandDefaults ref="defaults" />
</template>

<script setup lang="ts">

import { ListTodoIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { computed, onMounted, ref } from 'vue'
import ButtonIcon from '../components/ButtonIcon.vue'
import ButtonSwitch from '../components/ButtonSwitch.vue'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import Dialog from '../composables/dialog'
import useReorderTable from '../composables/reorder_table'
import CommandDefaults from '../screens/CommandDefaults.vue'
import { newCommand, saveCommands } from '../services/commands'
import { commandI18n, t } from '../services/i18n'
import { store } from '../services/store'
import { Command } from 'types/'

const emit = defineEmits<{
  'create': []
  'edit': [ Command ]
}>()

const commands = ref<Command[]>(null)
const selectedCommands = ref<string[]>([])
const defaults = ref<typeof CommandDefaults>(null)

onMounted(() => {
  load()
})

const reorderCommands = useReorderTable((ids: string[]) => {
  commands.value.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  save()
})

const visibleCommands = computed(() => commands.value?.filter((command: Command) => command.state != 'deleted') || [])

const allSelected = computed({
  get: () => selectedCommands.value.length === visibleCommands.value.length && visibleCommands.value.length > 0,
  set: (value: boolean) => {
    if (value) {
      selectedCommands.value = visibleCommands.value.map(c => c.id)
    } else {
      selectedCommands.value = []
    }
  }
})

const onToggleAll = () => {
  // Handled by computed setter
}

const onToggle = () => {
  if (selectedCommands.value.length === 0) return

  // Get the first selected command
  const firstCommand = commands.value.find(c => c.id === selectedCommands.value[0])
  if (!firstCommand) return

  // If first command is enabled, disable all selected; otherwise enable all
  const targetState = firstCommand.state === 'enabled' ? 'disabled' : 'enabled'

  selectedCommands.value.forEach(id => {
    const command = commands.value.find(c => c.id === id)
    if (command) {
      command.state = targetState
    }
  })

  save()
}

const label = (command: Command) => {
  return command.label || commandI18n(command, 'label')
}

const onMoveDown = (command: Command) => {
  if (reorderCommands.moveDown(command, commands.value, '.settings .commands table')) {
    save()
  }
}

const onMoveUp = (command: Command) => {
  if (reorderCommands.moveUp(command, commands.value, '.settings .commands table')) {
    save()
  }
}

const handleActionClick = async (action: string) => {
  if (action === 'defaults') {
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

const onNew = () => {
  emit('create')
}

const onCopy = () => {
  if (selectedCommands.value.length !== 1) { console.log('Copy command: invalid selection'); return }
  const command = commands.value.find(c => c.id === selectedCommands.value[0])
  if (!command) { console.log('Copy command: command not found'); return }

  const copy = newCommand()
  copy.id = uuidv4()
  copy.label = (command.label || commandI18n(command, 'label')) + ' (' + t('settings.commands.copy') + ')'
  copy.icon = command.icon
  copy.action = command.action
  copy.template = command.template || commandI18n(command, 'template')
  copy.shortcut = null // Don't copy shortcut
  copy.engine = command.engine
  copy.model = command.model

  const index = commands.value.indexOf(command)
  commands.value.splice(index + 1, 0, copy)
  selectedCommands.value = [copy.id]

  save()
}

const onEdit = (command: Command) => {
  emit('edit', command)
}

const onDelete = () => {
  if (selectedCommands.value.length === 0) return

  Dialog.show({
    target: document.querySelector('.settings .commands'),
    title: t('settings.commands.confirmDelete', { count: selectedCommands.value.length }),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      const selectedIds = new Set(selectedCommands.value)

      // Mark system commands as deleted
      commands.value.forEach((command: Command) => {
        if (selectedIds.has(command.id) && command.type === 'system') {
          command.state = 'deleted'
        }
      })

      // Remove user commands
      commands.value = commands.value.filter((command: Command) =>
        command.type === 'system' || !selectedIds.has(command.id)
      )

      selectedCommands.value = []
      save()
    }
  })
}

const onDeleteSingle = (command: Command) => {
  Dialog.show({
    target: document.querySelector('.settings .commands'),
    title: t('settings.commands.confirmDelete', { count: 1 }),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      if (command.type == 'system') {
        command.state = 'deleted'
      } else {
        const index = commands.value.indexOf(command)
        commands.value.splice(index, 1)
      }
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
