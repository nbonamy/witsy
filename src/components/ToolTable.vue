<template>
  <div class="tools sticky-table-container">
    <table>
      <thead>
        <tr>
          <th>&nbsp;</th>
          <th>{{ t('toolSelector.tools.name') }}</th>
          <th>{{ t('toolSelector.tools.description') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tool in tools" :key="tool.id" class="tool" @click="$emit('toggle', tool)">
          <td class="tool-enabled"><input type="checkbox" :checked="isToolActive(tool)" /></td>
          <td class="tool-name">{{ tool.name }}</td>
          <td class="tool-description"><div>{{ tool.description }}</div></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">

import { ToolSelection } from '../types/llm'
import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { useTools, Tool } from '../composables/useTools'

const tools = ref<Tool[]>([])

const selection = defineModel<ToolSelection>()

const emit = defineEmits(['toggle'])

const { getAllAvailableTools } = useTools()

onMounted(async () => {
  await initTools()
})

const initTools = async () => {
  const catalog = await getAllAvailableTools(store.config)
  tools.value = catalog.allTools
}

const isToolActive = (tool: Tool) => {

  // if we have a selection then check if the tool is in it
  if (selection.value) {
    return selection.value.includes(tool.id)
  }

  // default
  return true

  // // else we check the global enabled state
  // const t = tools.value.find(t => t.id === tool.id)
  // if (!t) return false
  // return t.plugin.isEnabled()

}

// we cannot toggle tool on selection.value as it can be initialized to null
// and we cannot just reassing a new value to it. so the caller has to:
// @toggle="tools = toolTable.toggleTool(tools, $event)"
// where toolTable is a ref to the ToolTable component
// and tools the same variable passed to v-model

const toggleTool = (selection: ToolSelection, tool: Tool): ToolSelection => {

  // if all tools enabled then fill
  if (!selection) {
    selection = tools.value.map(t => t.id)
  }

  // toggle the tool
  const index = selection.findIndex(t => t === tool.id)
  if (index > -1) {
    selection.splice(index, 1)
  } else {
    selection.push(tool.id)
  }

  // done
  return selection
}

defineExpose({ initTools, toggleTool })

</script>

<style scoped>

.tools {
  .tool {

    th, td {
      vertical-align: top;
      padding: 0.5rem;
    }

    .tool-description {
      div {
        white-space: wrap;
        max-height: 3lh;
        overflow-y: clip;
        text-overflow: ellipsis;
      }
    }
  }
}

</style>
