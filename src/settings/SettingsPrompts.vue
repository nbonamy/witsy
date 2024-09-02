<template>
  <div class="content" @click="closeContextMenu">
    <div class="prompts">
      <table>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.field">{{ column.title }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="prompt in visiblePrompts" :key="prompt.id" :data-id="prompt.id" class="prompt" :class="selected?.id == prompt.id ? 'selected' : ''"
              @click="onSelect(prompt)" @dblclick="onEdit(prompt)" draggable="true" @dragstart="onDragStart" @dragover="onDragOver" @dragend="onDragEnd"
          >
            <td class="enabled"><input type="checkbox" :checked="prompt.state=='enabled'" @click="onEnabled(prompt)" /></td>
            <td class="actor">{{ prompt.actor }}</td>
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
    <ContextMenu v-if="showMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" align="bottom-right" :teleport="false" />
    <PromptEditor id="prompt-editor" :prompt="edited" @prompt-modified="onPromptModified"/>
  </div>
</template>

<script setup>

import Swal from 'sweetalert2/dist/sweetalert2.js'
import { v4 as uuidv4 } from 'uuid'
import { ref, computed } from 'vue'
import { store } from '../services/store'
import { newPrompt, savePrompts } from '../services/prompts'
import PromptEditor from '../screens/PromptEditor.vue'
import ContextMenu from '../components/ContextMenu.vue'

const prompts = ref(null)
const selected = ref(null)
const edited = ref(null)
const defaults = ref(null)

const moreButton = ref(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const contextMenuActions = [
  { label: 'Export', action: 'export' },
  { label: 'Import', action: 'import' },
]

const visiblePrompts = computed(() => prompts.value?.filter(prompt => prompt.state != 'deleted'))

const columns = [
  { field: 'enabled', title: '' },
  { field: 'actor', title: 'Expert' },
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
  if (window.api.prompts.import()) {
    store.loadPrompts()
    load()
    alert('Prompts file imported successfully')
  } else {
    alert('Failed to import prompts file')
  }
}

const onExport = () => {
  if (window.api.prompts.export()) {
    alert('Prompts file exported successfully')
  } else {
    alert('Failed to export prompts file')
  }
}

const onSelect = (prompt) => {
  selected.value = prompt
}

const onNew = () => {
  //selected.value = null
  edited.value = newPrompt()
  document.getElementById('prompt-editor').showModal()
}

const onEdit = (prompt) => {
  edited.value = prompt
  selected.value = prompt
  document.getElementById('prompt-editor').showModal()
}

const onDelete = () => {
  Swal.fire({
    target: document.querySelector('.prompts'),
    title: 'Are you sure you want to delete this prompt? This cannot be undone.',
    confirmButtonText: 'Delete',
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      if (selected.value.type == 'system') {
        selected.value.state = 'deleted'
      } else {
        const index = prompts.value.indexOf(selected.value)
        prompts.value.splice(index, 1)
      }
      selected.value = null
      save()
    }
  })
}

const onEnabled = (prompt) => {
  prompt.state = (prompt.state == 'enabled' ? 'disabled' : 'enabled')
  save()
}

const onPromptModified = (payload) => {
  // new prompt?
  let prompt = null
  if (payload.id == null) {

    // create a new ome
    prompt = newPrompt()
    prompt.id = uuidv4()
    
    // dind the index of the currently selected
    const selectedIndex = prompts.value.findIndex(p => p.id === selected.value?.id)
    if (selectedIndex !== -1) {
      prompts.value.splice(selectedIndex, 0, prompt)
    } else {
      prompts.value.push(prompt)
    }
  } else {
    prompt = prompts.value.find(prompt => prompt.id == payload.id)
  }

  // update
  if (prompt) {
    // now update
    prompt.actor = payload.actor
    prompt.prompt = payload.prompt
  }

  // done
  selected.value = prompt
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
  prompts.value.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));

}

const onDragEnd = () => {
  save()
}

const load = () => {
  prompts.value = JSON.parse(JSON.stringify(store.prompts))
}

const save = () => {
  store.prompts = prompts.value
  savePrompts()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
</style>

<style scoped>

.content {
  width: 540px !important;
}

.prompts {
  height: 200px;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  border: 0.5px solid rgba(192, 192, 192, 0.5);
  background-color: white;
  white-space: nowrap;
  font-size: 9.5pt;
  padding: 2px 4px;
}

tr.selected td {
  background-color: var(--highlight-color);
  color: white;
}

th {
  font-size: 9pt;
  font-weight: normal;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
}

td.icon, td.shortcut {
  text-align: center;
}

.windows td.icon {
  font-family: 'NotoColorEmojiLimited';
  font-size: 9pt;
}

input[type=checkbox] {
  width: 12px;
  height: 12px;
}

.actions {
  margin-top: 8px;
  display: flex;
}

.actions button:first-child {
  margin-left: 0px;
}

.actions .right {
  flex: 1;
  text-align: right;
}

</style>
