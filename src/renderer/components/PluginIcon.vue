<template>
  <LightbulbIcon v-if="name === 'knowledge' || name.startsWith(kKnowledgePluginPrefix)"/>
  <GlobeIcon v-else-if="name === 'search' || name === kSearchPluginName"/>
  <CloudDownloadIcon v-else-if="name === 'browse' || name === kBrowsePluginName"/>
  <PythonIcon v-else-if="name === 'python' || name === kPythonPluginName"/>
  <PaletteIcon v-else-if="name === 'image' || name === kImagePluginName"/>
  <VideoIcon v-else-if="name === 'video' || name === kVideoPluginName"/>
  <IdCardIcon v-else-if="name === 'memory' || name === kMemoryPluginName"/>
  <SquarePlayIcon v-else-if="name === 'youtube' || name === kYoutubePluginName"/>
  <FolderIcon v-else-if="name === 'filesystem' || name === kFilesystemPluginName"/>
  <WorkflowIcon v-else-if="name.startsWith(kCodeExecutionPluginPrefix)"/>
  <VegaIcon v-else-if="name === 'vega' || name === kVegaPluginName"/>
  <McpIcon v-else-if="name === 'mcp'" />
  <Plug2Icon v-else />
</template>

<script setup lang="ts">

import { CloudDownloadIcon, FolderIcon, GlobeIcon, IdCardIcon, LightbulbIcon, PaletteIcon, Plug2Icon, SquarePlayIcon, VideoIcon, WorkflowIcon } from 'lucide-vue-next'
import { computed } from 'vue'
import McpIcon from '@assets/mcp.svg?component'
import PythonIcon from '@assets/python.svg?component'
import VegaIcon from '@assets/vega.svg?component'
import { ToolCall } from 'types/index'
import { kBrowsePluginName } from '@services/plugins/browse'
import { kCodeExecutionPluginPrefix } from '@services/plugins/code_exec_base'
import { kCodeExecutionProxyPluginToolName } from '@services/plugins/code_exec_proxy'
import { kFilesystemPluginName } from '@services/plugins/filesystem'
import { kImagePluginName } from '@services/plugins/image'
import { kKnowledgePluginPrefix } from '@services/plugins/knowledge'
import { kMemoryPluginName } from '@services/plugins/memory'
import { kPythonPluginName } from '@services/plugins/python'
import { kSearchPluginName } from '@services/plugins/search'
import { kVegaPluginName } from '@services/plugins/vega'
import { kVideoPluginName } from '@services/plugins/video'
import { kYoutubePluginName } from '@services/plugins/youtube'

const props = defineProps({
  tool: {
    type: String,
    required: true,
  },
  toolCall: {
    type: Object as () => ToolCall,
    required: false,
  },
})

const name = computed(() => {
  if (props.tool === kCodeExecutionProxyPluginToolName && props.toolCall?.args?.tool_name) {
    return props.toolCall.args.tool_name
  } else {
    return props.tool
  }
})

</script>

<style scoped>

svg {
  width: var(--icon-md);
  height: var(--icon-md);
}


</style>
