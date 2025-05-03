<template>
  <dialog id="tool-selector" class="dialog" @keydown.enter.prevent @keyup.enter="onSave">
    <header>
      <div class="title">{{ t('toolSelector.title') }}</div>
    </header>
    <main>
      <div class="sticky-table-container">
        <table>
          <thead>
            <tr>
              <th>&nbsp;</th>
              <th>{{ t('toolSelector.tools.name') }}</th>
              <th>{{ t('toolSelector.tools.description') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tool in tools" :key="tool.id">
              <td class="enabled"><input type="checkbox" :checked="isToolActive(tool)" @click="toggleTool(tool)" /></td>
              <td>{{ tool.name }}</td>
              <td>{{ tool.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
    <footer>
      <button name="all" @click.prevent="selection = null">{{ t('common.selectAll') }}</button>
      <button name="none" @click.prevent="selection = []">{{ t('common.selectNone') }}</button>
      <button name="cancel" @click="onCancel" class="push alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
      <button name="save" @click="onSave" class="alert-confirm">{{ t('common.save') }}</button>
    </footer>
  </dialog>
</template>

<script setup lang="ts">

import { ToolSelection } from '../types/llm'
import { ref, Ref, onMounted, watch, PropType } from 'vue'
import { t } from '../services/i18n'
import { availablePlugins } from '../plugins/plugins'
import { Plugin } from 'multi-llm-ts'
import McpPlugin from '../plugins/mcp'

type Tool = {
  id: string
  name: string
  description: string
  plugin: Plugin
}

const tools: Ref<Tool[]> = ref([])
const selection: Ref<string[]> = ref([])

const props = defineProps({
  tools: {
    type: null as unknown as PropType<ToolSelection>,
    required: true,
  },
})

const emit = defineEmits(['save'])

onMounted(async () => {
  watch(() => props.tools, () => {
    selection.value = props.tools
    initTools()
  }, { immediate: true }) 
})

const initTools = async () => {
  tools.value = []
  for (const pluginClass of Object.values(availablePlugins)) {
    const plugin = new pluginClass({})
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

const toggleTool = (tool: Tool) => {

  // if all tools enabled then fill
  if (!selection.value) {
    selection.value = tools.value.map(t => t.id)
  }

  // toggle the tool
  const index = selection.value.findIndex(t => t === tool.id)
  if (index > -1) {
    selection.value.splice(index, 1)
  } else {
    selection.value.push(tool.id)
  }
}

const isToolActive = (tool: Tool) => {
  return !selection.value || selection.value.includes(tool.id)
}

const close = () => {
  document.querySelector<HTMLDialogElement>('#tool-selector').close()
}

const onCancel = () => {
  close()
}

const onSave = () => {
  close()
  emit('save', selection.value)
}

defineExpose({
  show: () => document.querySelector<HTMLDialogElement>('#tool-selector').showModal(),
  close,
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/sticky-header-table.css';
</style>

<style scoped>

#tool-selector {
  width: 700px !important;
  height: 520px !important;

  main {

    padding-bottom: 0px;

    .sticky-table-container {
      max-height: 406px;
      overflow: auto;

      th, td {
        white-space: normal;
      }
    }
  }

  footer {
    justify-content: start;

    .push {
      margin-left: auto;
    }
  }

}

</style>