<template>
  <LightbulbIcon v-if="tool === 'knowledge' || tool.startsWith(kKnowledgePluginPrefix)"/>
  <GlobeIcon v-else-if="tool === 'search' || tool === kSearchPluginName"/>
  <CloudDownloadIcon v-else-if="tool === 'browse' || tool === kBrowsePluginName"/>
  <PythonIcon v-else-if="tool === 'python' || tool === kPythonPluginName"/>
  <PaletteIcon v-else-if="tool === 'image' || tool === kImagePluginName"/>
  <VideoIcon v-else-if="tool === 'video' || tool === kVideoPluginName"/>
  <IdCardIcon v-else-if="tool === 'memory' || tool === kMemoryPluginName"/>
  <SquarePlayIcon v-else-if="tool === 'youtube' || tool === kYoutubePluginName"/>
  <FolderIcon v-else-if="tool === 'filesystem' || tool === kFilesystemPluginName"/>
  <WorkflowIcon v-else-if="tool.startsWith(kCodeExecutionPluginPrefix)"/>
  <VegaIcon v-else-if="tool === 'vega' || tool === kVegaPluginName"/>
  <McpIcon v-else-if="tool === 'mcp'" />
  <Plug2Icon v-else />
</template>

<script setup lang="ts">

import { CloudDownloadIcon, FolderIcon, GlobeIcon, IdCardIcon, LightbulbIcon, PaletteIcon, Plug2Icon, SquarePlayIcon, VideoIcon, WorkflowIcon } from 'lucide-vue-next'
import McpIcon from '../../../assets/mcp.svg?component'
import PythonIcon from '../../../assets/python.svg?component'
import VegaIcon from '../../../assets/vega.svg?component'
import { kBrowsePluginName } from '../services/plugins/browse'
import { kCodeExecutionPluginPrefix } from '../services/plugins/code_exec'
import { kFilesystemPluginName } from '../services/plugins/filesystem'
import { kImagePluginName } from '../services/plugins/image'
import { kKnowledgePluginPrefix } from '../services/plugins/knowledge'
import { kMemoryPluginName } from '../services/plugins/memory'
import { kPythonPluginName } from '../services/plugins/python'
import { kSearchPluginName } from '../services/plugins/search'
import { kVegaPluginName } from '../services/plugins/vega'
import { kVideoPluginName } from '../services/plugins/video'
import { kYoutubePluginName } from '../services/plugins/youtube'

defineProps({
  tool: {
    type: String,
    required: true,
  },
})

</script>

<style scoped>

svg {
  width: var(--icon-md);
  height: var(--icon-md);
}


</style>
