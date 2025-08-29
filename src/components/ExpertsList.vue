<template>
  <div class="list-actions">
    <div class="list-action new" @click.prevent="onNew"><PlusIcon />{{ t('settings.experts.new') }}</div>
    <div class="list-action edit" @click.prevent="onEdit(selected)" v-if="selected"><PencilIcon />{{ t('common.edit') }}</div>
    <div class="list-action copy" @click.prevent="onCopy(selected)" v-if="selected"><CopyIcon />{{ t('settings.experts.copy') }}</div>
    <div class="list-action delete" @click.prevent="onDelete" v-if="selected"><Trash2Icon />{{ t('common.delete') }}</div>
    <div class="flex-push" /> 
    <div class="list-action menu" @click.prevent.stop="onMore" ref="moreButton"><div></div><div></div><div></div></div>
  </div>
  <div class="experts sticky-table-container">
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.field">{{ column.title }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="expert in visibleExperts" :key="expert.id" :data-id="expert.id" class="expert" :class="selected?.id == expert.id ? 'selected' : ''"
            @click="onSelect(expert)" @dblclick="onEdit(expert)" draggable="true" @dragstart="reorderExperts.onDragStart" @dragover="reorderExperts.onDragOver" @dragend="reorderExperts.onDragEnd">
          <td class="enabled"><input type="checkbox" :checked="expert.state=='enabled'" @click="onEnabled(expert)" /></td>
          <td class="name">{{ name(expert) }}</td>
          <td class="move">
            <button @click.prevent="onMoveDown(expert)" @dblclick.stop>▼</button>
            <button @click.prevent="onMoveUp(expert)" @dblclick.stop>▲</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ContextMenu v-if="showMenu" @close="closeContextMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" position="right" :teleport="false" />
</template>

<script setup lang="ts">

import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'
import ContextMenu from '../components/ContextMenu.vue'
import Dialog from '../composables/dialog'
import useReorderTable from '../composables/reorder_table'
import { newExpert, saveExperts } from '../services/experts'
import { expertI18n, t } from '../services/i18n'
import { store } from '../services/store'
import { Expert } from '../types/index'

const experts= ref<Expert[]>(null)
const selected= ref<Expert>(null)
const moreButton= ref<HTMLElement>(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const reorderExperts = useReorderTable((ids: string[]) => {
  experts.value.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  save()
})

const emit = defineEmits([ 'create', 'edit' ])

const contextMenuActions = [
  { label: t('settings.experts.export'), action: 'export' },
  { label: t('settings.experts.import'), action: 'import' },
  { label: t('settings.experts.selectAll'), action: 'select' },
  { label: t('settings.experts.unselectAll'), action: 'unselect' },
  { label: t('settings.experts.sortAlpha'), action: 'sortAlpha' },
  { label: t('settings.experts.sortState'), action: 'sortEnabled' },
]

const visibleExperts = computed(() => experts.value?.filter((expert: Expert) => expert.state != 'deleted'))

const name = (expert: Expert) => {
  return expert.name || expertI18n(expert, 'name')
}

const columns = [
  { field: 'enabled', title: '' },
  { field: 'name', title: t('common.name') },
  { field: 'move', title: t('common.move'), },
]

const onMoveDown = (expert: Expert) => {
  if (reorderExperts.moveDown(expert, experts.value, '.settings .experts .sticky-table-container')) {
    save()
  }
}

const onMoveUp = (expert: Expert) => {
  if (reorderExperts.moveUp(expert, experts.value, '.settings .experts .sticky-table-container')) {
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
  menuX.value = rcContent.right - rcButton.right - 8
  menuY.value = rcButton.bottom - 32
}

const closeContextMenu = () => {
  showMenu.value = false;
}

const handleActionClick = async (action: string) => {

  // close
  closeContextMenu()

  // process
  if (action === 'select') {
    experts.value.forEach((expert: Expert) => expert.state = 'enabled')
    save()
  } else if (action === 'unselect') {
    experts.value.forEach((expert: Expert) => expert.state = 'disabled')
    save()
  } else if (action === 'import') {
    onImport()
  } else if (action === 'export') {
    onExport()
  } else if (action === 'sortAlpha') {
    experts.value.sort((a, b) => {
      const aName = a.name || expertI18n(a, 'name')
      const bName = b.name || expertI18n(b, 'name')
      return aName.localeCompare(bName)
    })
    save()
  } else if (action === 'sortEnabled') {
    experts.value.sort((a, b) => {
      if (a.state === b.state) {
        const aName = a.name || expertI18n(a, 'name')
        const bName = b.name || expertI18n(b, 'name')
        return aName.localeCompare(bName)
      } else {
        // disabled < enabled
        return b.state.localeCompare(a.state)
      }
    })
    save()
  }

}

const onImport = () => {
  if (window.api.experts.import(store.config.workspaceId)) {
    store.loadExperts()
    load()
    Dialog.alert(t('settings.experts.importSuccess'))
  } else {
    Dialog.alert(t('settings.experts.importError'))
  }
}

const onExport = () => {
  if (window.api.experts.export(store.config.workspaceId)) {
    Dialog.alert(t('settings.experts.exportSuccess'))
  } else {
    Dialog.alert(t('settings.experts.exportError'))
  }
}

const onSelect = (expert: Expert) => {
  selected.value = expert
}

const onNew = () => {
  emit('create', selected.value)
}

const onCopy = (expert: Expert) => {

  const copy = newExpert()
  copy.id = uuidv4()
  copy.name = (expert.name || expertI18n(expert, 'name')) + ' (' + t('settings.experts.copy') + ')'
  copy.prompt = expert.prompt || expertI18n(expert, 'prompt')
  copy.triggerApps = expert.triggerApps

  const index = experts.value.indexOf(expert)
  experts.value.splice(index + 1, 0, copy)

  selected.value = copy
  save()

}

const onEdit = (expert: Expert) => {
  emit('edit', expert)
}

const onDelete = () => {
  Dialog.show({
    target: document.querySelector('.settings .experts'),
    title: t('settings.experts.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      if (selected.value.type == 'system') {
        selected.value.state = 'deleted'
      } else {
        const index = experts.value.indexOf(selected.value)
        experts.value.splice(index, 1)
      }
      selected.value = null
      save()
    }
  })
}

const onEnabled = (expert: Expert) => {
  expert.state = (expert.state == 'enabled' ? 'disabled' : 'enabled')
  save()
}

const load = () => {
  experts.value = JSON.parse(JSON.stringify(store.experts))
}

const save = () => {
  store.experts = experts.value
  saveExperts()
}

defineExpose({ load })

</script>


<style scoped>

</style>
