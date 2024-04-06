
<template>
  <div class="content">
    <div class="commands">
      <table>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.field">{{ column.title }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="command in commands" :key="command.id" :data-id="command.id" class="command" :class="selected == command.id ? 'selected' : ''"
              @click="onSelect(command.id)" @dblclick="onEdit(command.id)" draggable="true" @dragstart="onDragStart" @dragover="onDragOver"
          >
            <td class="enabled"><input type="checkbox" :checked="command.enabled" @click="onEnabled(command)" /></td>
            <td class="icon">{{ command.icon }}</td>
            <td class="label">{{ command.label }}</td>
            <td class="behavior">{{ behavior(command.behavior) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import { saveCommands } from '../services/commands';

const commands = ref(null)
const selected = ref(null)

const columns = [
  { field: 'enabled', title: '' },
  { field: 'icon', title: 'Icon' },
  { field: 'label', title: 'Name', },
  { field: 'behavior', title: 'Behavior', },
]

const behavior = (behavior) => {
  if (behavior == 'new_window') return 'New Window'
  if (behavior == 'insert_below') return 'Insert Below'
  if (behavior == 'replace_selection') return 'Replace Selection'
  if (behavior == 'copy_cliboard') return 'Copy Clipboard'
}

const onSelect = (id) => {
  selected.value = id
}

const onEdit = (id) => {
  alert('Command edit coming soon!')
}

const onEnabled = (command) => {
  command.enabled = !command.enabled
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
  commands.value.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
  console.log(commands.value);
}

const load = () => {
  commands.value = store.commands
}

const save = () => {
  store.commands = commands.value
  saveCommands()
}

defineExpose({
  load,
  save
})

</script>

<style scoped>

.content {
  width: 500px !important;
}

.commands {
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
  font-size: 10pt;
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

td.icon {
  text-align: center;
}

input[type=checkbox] {
  width: 12px;
  height: 12px;
}

</style>
