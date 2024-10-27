
<template>
  <div class="content" @click="closeContextMenu">
    <div class="experts sticky-table-container">
      <table>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.field">{{ column.title }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="expert in visibleExperts" :key="expert.id" :data-id="expert.id" class="expert" :class="selected?.id == expert.id ? 'selected' : ''"
              @click="onSelect(expert)" @dblclick="onEdit(expert)" draggable="true" @dragstart="onDragStart" @dragover="onDragOver" @dragend="onDragEnd"
          >
            <td class="enabled"><input type="checkbox" :checked="expert.state=='enabled'" @click="onEnabled(expert)" /></td>
            <td class="name">{{ expert.name }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="actions">
      <button @click.prevent="onNew">New</button>
      <button @click.prevent="onEdit(selected)" :disabled="!selected">Edit</button>
      <button @click.prevent="onDelete" :disabled="!selected">Delete</button>
      <div class="right">
        <button @click.prevent.stop="onMore" ref="moreButton">More {{ showMenu ? '▼' : '▲'}}</button>
      </div>
    </div>
    <ContextMenu v-if="showMenu" :on-close="closeContextMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" position="above-right" :teleport="false" />
    <ExpertEditor id="expert-editor" :expert="edited" @expert-modified="onExpertModified"/>
  </div>
</template>

<script setup>

import { v4 as uuidv4 } from 'uuid'
import { ref, computed } from 'vue'
import { store } from '../services/store'
import { newExpert, saveExperts } from '../services/experts'
import ExpertEditor from '../screens/ExpertEditor.vue'
import ContextMenu from '../components/ContextMenu.vue'
import Dialog from '../composables/dialog'

const experts = ref(null)
const selected = ref(null)
const edited = ref(null)

const moreButton = ref(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const contextMenuActions = [
  { label: 'Export', action: 'export' },
  { label: 'Import', action: 'import' },
]

const visibleExperts = computed(() => experts.value?.filter(expert => expert.state != 'deleted'))

const columns = [
  { field: 'enabled', title: '' },
  { field: 'name', title: 'Name' },
]

const onMore = (event) => {
  if (showMenu.value) {
    closeContextMenu()
  } else {
    showContextMenu(event)
  }
}

const showContextMenu = () => {
  showMenu.value = true
  const rcButton = moreButton.value.getBoundingClientRect()
  const rcDialog = document.getElementsByTagName('dialog')[0].getBoundingClientRect()
  menuX.value = rcDialog.right - rcButton.right
  menuY.value = rcDialog.bottom - rcButton.bottom + rcButton.height
}

const closeContextMenu = () => {
  showMenu.value = false;
}

const handleActionClick = async (action) => {

  // close
  closeContextMenu()

  // process
  if (action === 'import') {
    onImport()
  } else if (action === 'export') {
    onExport()
  }

}

const onImport = () => {
  if (window.api.experts.import()) {
    store.loadExperts()
    load()
    Dialog.alert('Experts file imported successfully')
  } else {
    Dialog.alert('Failed to import experts file')
  }
}

const onExport = () => {
  if (window.api.experts.export()) {
    Dialog.alert('Experts file exported successfully')
  } else {
    Dialog.alert('Failed to export experts file')
  }
}

const onSelect = (expert) => {
  selected.value = expert
}

const onNew = () => {
  //selected.value = null
  edited.value =  newExpert()
  document.getElementById('expert-editor').showModal()
}

const onEdit = (expert) => {
  edited.value = expert
  selected.value = expert
  document.getElementById('expert-editor').showModal()
}

const onDelete = () => {
  Dialog.show({
    target: document.querySelector('.settings .experts'),
    title: 'Are you sure you want to delete this expert?',
    text: 'You can\'t undo this action.',
    confirmButtonText: 'Delete',
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

const onEnabled = (expert) => {
  expert.state = (expert.state == 'enabled' ? 'disabled' : 'enabled')
  save()
}

const onExpertModified = (payload) => {
  // new expert?
  let expert = null
  if (payload.id == null) {

    // create a new ome
    expert = newExpert()
    expert.id = uuidv4()
    
    // dind the index of the currently selected
    const selectedIndex = experts.value.findIndex(p => p.id === selected.value?.id)
    if (selectedIndex !== -1) {
      experts.value.splice(selectedIndex, 0, expert)
    } else {
      experts.value.push(expert)
    }
  } else {
    expert = experts.value.find(expert => expert.id == payload.id)
  }

  // update
  if (expert) {
    // now update
    expert.name = payload.name
    expert.prompt = payload.prompt
    expert.triggerApps = payload.triggerApps
  }

  // done
  selected.value = expert
  save()
}

var draggedRow
const onDragStart = (event) => {
  draggedRow = event.target.closest('tr')
}

const onDragOver = (event) => {
  
  event.preventDefault();
  
  let target = event.target.closest('tr')
  let targetIndex = Array.from(target.parentNode.children).indexOf(target);
  let draggedRowIndex = Array.from(draggedRow.parentNode.children).indexOf(draggedRow);

  // Determine where to place the dragged row
  if (targetIndex > draggedRowIndex) {
    target.after(draggedRow);
  } else {
    target.before(draggedRow);
  }
  
  // reorder array
  const rows = document.querySelectorAll('tr[data-id]');
  const newOrderIds = Array.from(rows).map(row => row.getAttribute('data-id'));
  experts.value.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));

}

const onDragEnd = () => {
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
@import '../../css/dialog.css';
@import '../../css/sticky-header-table.css';
</style>

<style scoped>

.content {
  padding-top: 24px !important;
  width: 540px !important;
}

.sticky-table-container {
  height: 200px;
}

</style>
