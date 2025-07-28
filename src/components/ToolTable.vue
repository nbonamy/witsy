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
import { availablePlugins, PluginInstance } from '../plugins/plugins'
import { Plugin } from 'multi-llm-ts'
import McpPlugin from '../plugins/mcp'

type Tool = {
  id: string
  name: string
  description: string
  plugin: Plugin
}

const tools = ref<Tool[]>([])

const selection = defineModel<ToolSelection>()

const emit = defineEmits(['toggle'])

onMounted(async () => {
  await initTools()
})

const initTools = async () => {
  
  tools.value = []
  for (const pluginName in availablePlugins) {
    
    const pluginClass = availablePlugins[pluginName]
    const plugin: PluginInstance = new pluginClass(store.config.plugins[pluginName])
    if ('getTools' in plugin) {

      const pluginTools = await plugin.getTools()
      for (const pluginTool of pluginTools) {

        const id = pluginTool.function.name
        const name = plugin instanceof McpPlugin
          ? window.api.mcp.originalToolName(id)
          : id

        tools.value.push({
          id, name,
          description: pluginTool.function.description,
          plugin
        })
      }

    } else {
      tools.value.push({
        id: plugin.getName(),
        name: plugin.getName(),
        description: plugin.getDescription(),
        plugin
      })
    }
  }
}

const isToolActive = (tool: Tool) => {
  return !selection.value || selection.value.includes(tool.id)
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
