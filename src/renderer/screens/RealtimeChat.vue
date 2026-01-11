<template>
  <div class="realtime split-pane">

    <div class="sp-sidebar">

      <header>
        <div class="title">{{ t('realtimeChat.title') }}</div>
      </header>

      <main>
        <div class="form form-large form-vertical">
          <div class="form-field">
            <label>{{ t('common.provider') }}</label>
            <select class="tool" v-model="engine" @change="onChangeEngine">
              <option v-for="engine in engines" :value="engine.id" :key="engine.id">{{ engine.name }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>{{ t('common.model') }}</label>
            <select class="tool" v-model="model" @change="save">
              <option v-for="model in models" :value="model.id" :key="model.id">{{ model.name }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>{{ t('common.voice') }}</label>
            <select class="tool" v-model="voice" @change="save">
              <option v-for="voice in voices" :value="voice.id" :key="voice.id">{{ voice.name }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>{{ t('common.tools') }}</label>
            <button id="tools-menu-anchor" class="tools" :disabled="state === 'active'" @click="onTools">
              <BlocksIcon /> {{ toolsLabel }}
            </button>
          </div>
        </div>
      </main>
    </div>

    <div class="sp-main">

      <main>

        <div class="status">{{ status }}</div>

        <AnimatedBlob :active="state === 'active'" @click="onStart" ref="blob"/>

        <div class="cost-container">
          <div class="total">
            <div class="title">{{ t('common.estimatedCost') }}</div>
            <div class="value">$ <NumberFlip :value="sessionTotals.costInfo.cost.total" :animate-initial-number="false" :formatter="(n: number) => n.toFixed(6)"/></div>
            <div class="note" v-if="sessionTotals.costInfo.pricingModel">{{ t('common.basedOn') }} {{ sessionTotals.costInfo.pricingModel }}<br>
              <a :href="sessionTotals.costInfo.pricingUrl" target="_blank">{{ t('common.costsAsOf') }}</a> {{ sessionTotals.costInfo.pricingDate }}</div>
          </div>
        </div>

      </main>

    </div>

    <div class="sp-transcript">
      <header>
        <div class="title">{{ t('realtimeChat.transcript') }}</div>
      </header>
      <MessageList :chat="chat" theme="conversation" conversation-mode="" />
    </div>

    <ToolsMenu
      v-if="toolsMenuVisible"
      anchor="#tools-menu-anchor"
      position="below"
      :tool-selection="toolSelection"
      @close="onCloseToolsMenu"
      @select-all-tools="handleSelectAllTools"
      @unselect-all-tools="handleUnselectAllTools"
      @select-all-plugins="handleSelectAllPlugins"
      @unselect-all-plugins="handleUnselectAllPlugins"
      @select-all-server-tools="handleSelectAllServerTools"
      @unselect-all-server-tools="handleUnselectAllServerTools"
      @all-plugins-toggle="handleAllPluginsToggle"
      @plugin-toggle="handlePluginToggle"
      @all-server-tools-toggle="handleAllServerToolsToggle"
      @server-tool-toggle="handleServerToolToggle"
    />

  </div>
</template>

<script setup lang="ts">

import { BlocksIcon } from 'lucide-vue-next'
import AnimatedBlob from '@components/AnimatedBlob.vue'
import MessageList from '@components/MessageList.vue'
import NumberFlip from '@components/NumberFlip.vue'
import ToolsMenu from '@components/ToolsMenu.vue'
import Chat from '@models/chat'
import Message from '@models/message'
import useTipsManager from '@renderer/utils/tips_manager'
import * as ts from '@renderer/utils/tool_selection'
import { t } from '@services/i18n'
import {
  createRealtimeEngine,
  getAvailableVoices,
  RealtimeCostInfo,
  RealtimeEngine,
  RealtimeMessage,
  RealtimeStatus,
  RealtimeToolCall,
  RealtimeUsage,
  TRANSCRIPTION_UNAVAILABLE,
} from '@services/realtime'
import { store } from '@services/store'
import { McpServerWithTools, McpToolUnique } from 'types/mcp'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LlmUtils from '../services/llm_utils'

const tipsManager = useTipsManager(store)

type Stats = RealtimeUsage & {
  costInfo: RealtimeCostInfo
}

const sessionTotals = ref<Stats>({
  audioInputTokens: 0,
  textInputTokens: 0,
  cachedAudioTokens: 0,
  cachedTextTokens: 0,
  audioOutputTokens: 0,
  textOutputTokens: 0,
  costInfo: {
    cost: { input: 0, output: 0, total: 0 },
    pricingModel: '',
    pricingUrl: '',
    pricingDate: '',
  }
})

const blob = ref<typeof AnimatedBlob>(null)
const engine = ref<string>('openai')
const model = ref<string>('gpt-mini-realtime')
const voice = ref<string>('ash')
const state = ref<'idle'|'active'>('idle')
const chat = ref<Chat>(new Chat())
const toolSelection = ref<string[]>(store.config.realtime.tools || [])
const toolsMenuVisible = ref(false)

let realtimeEngine: RealtimeEngine | null = null

const engines = computed(() => ([
  { id: 'openai', name: 'OpenAI' },
  //{ id: 'gladia', name: 'Gladia' },
]))

const models = computed(() => {
  if (engine.value === 'gladia') {
    return [ { id: 'solaria', name: 'Solaria' } ]
  } else {
    return store.config.engines[engine.value].models.realtime
  }
})

const voices = computed(() => {
  if (engine.value === 'gladia') {
    return [
      { id: 'default', name: 'Default' },
    ]
  } else {
    return getAvailableVoices(engine.value)
  }
})

const getVoiceName = (): string => {
  return voices.value.find(v => v.id === voice.value)?.name || voice.value
}

const getIdleStatus = () => t('realtimeChat.clickToTalk', { voice: getVoiceName() })

const status = ref(getIdleStatus())

const toolsLabel = computed(() => {
  return t('realtimeChat.toolsSelected', { count: toolSelection.value.length })
})

onMounted(() => {

  // cleanup on page unload
  window.addEventListener('beforeunload', stopSession)

  // blob animation
  blob.value.update()

  // tip
  setTimeout(() => {
    tipsManager.showTip('realtime')
  }, 1000)

  // init
  engine.value = store.config.realtime.engine
  onChangeEngine()

})

onBeforeUnmount(() => {
  stopSession()
})

watch(toolSelection, () => {
  save()
}, { deep: true })

watch(voice, () => {
  if (state.value === 'idle') {
    status.value = getIdleStatus()
  }
})

const onChangeEngine = () => {
  model.value = store.config.engines[engine.value].realtime.model || models.value[0].id
  voice.value = store.config.engines[engine.value].realtime.voice || voices.value[0].id
  status.value = getIdleStatus()
  save()
}

// Tools menu
const onTools = () => {
  toolsMenuVisible.value = true
}

const onCloseToolsMenu = () => {
  toolsMenuVisible.value = false
}

const handleSelectAllTools = async (visibleIds?: string[] | null) => {
  toolSelection.value = await ts.handleSelectAllTools(visibleIds)
}

const handleUnselectAllTools = async (visibleIds?: string[] | null) => {
  toolSelection.value = await ts.handleUnselectAllTools(visibleIds)
}

const handleSelectAllPlugins = async (visibleIds?: string[] | null) => {
  toolSelection.value = await ts.handleSelectAllPlugins(toolSelection.value, visibleIds)
}

const handleUnselectAllPlugins = async (visibleIds?: string[] | null) => {
  toolSelection.value = await ts.handleUnselectAllPlugins(toolSelection.value, visibleIds)
}

const handleSelectAllServerTools = async (server: McpServerWithTools, visibleIds?: string[] | null) => {
  toolSelection.value = await ts.handleSelectAllServerTools(toolSelection.value, server, visibleIds)
}

const handleUnselectAllServerTools = async (server: McpServerWithTools, visibleIds?: string[] | null) => {
  toolSelection.value = await ts.handleUnselectAllServerTools(toolSelection.value, server, visibleIds)
}

const handleAllPluginsToggle = async () => {
  toolSelection.value = await ts.handleAllPluginsToggle(toolSelection.value)
}

const handlePluginToggle = async (pluginName: string) => {
  toolSelection.value = await ts.handlePluginToggle(toolSelection.value, pluginName)
}

const handleAllServerToolsToggle = async (server: McpServerWithTools) => {
  toolSelection.value = await ts.handleAllServerToolsToggle(toolSelection.value, server)
}

const handleServerToolToggle = async (server: McpServerWithTools, tool: McpToolUnique) => {
  toolSelection.value = await ts.handleServerToolToggle(toolSelection.value, server, tool)
}

// Helper to translate special markers in content
const translateContent = (content: string): string => {
  if (content === TRANSCRIPTION_UNAVAILABLE) {
    return t('realtimeChat.transcriptionUnavailable')
  }
  return content
}

// Play a connection chime using Web Audio API
const playConnectionChime = () => {
  try {
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Pleasant two-tone chime
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1) // C#6

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch (e) {
    // Ignore audio errors
  }
}

// Callbacks from RealtimeEngine
const onStatusChange = (newStatus: RealtimeStatus) => {
  const voiceName = getVoiceName()
  switch (newStatus) {
    case 'idle':
      status.value = getIdleStatus()
      break
    case 'connecting':
      status.value = t('realtimeChat.callingVoice', { voice: voiceName })
      break
    case 'connected':
      status.value = t('realtimeChat.connectedWithVoice', { voice: voiceName })
      playConnectionChime()
      break
    case 'error':
      status.value = t('realtimeChat.errorPrefix')
      break
  }
}

const onNewMessage = (message: RealtimeMessage) => {
  const msg = new Message(message.role, translateContent(message.content))
  msg.uuid = message.id
  msg.engine = engine.value
  msg.model = model.value
  chat.value.messages.push(msg)
}

const onMessageUpdated = (id: string, content: string, mode: 'append' | 'replace') => {
  // console.log(`[realtime] vue onMessageUpdated: id=${id}, mode=${mode}, content="${content.slice(0, 50)}..."`)
  const message = chat.value.messages.find(m => m.uuid === id)
  if (message) {
    const translated = translateContent(content)
    if (mode === 'replace') {
      message.setText(translated)
    } else {
      message.appendText({ type: 'content', text: translated, done: false })
    }
  }
}

const onMessageToolCall = (messageId: string, toolCall: RealtimeToolCall) => {
  // console.log(`[realtime] vue onMessageToolCall: id=${messageId}, tool=${toolCall.name}, status=${toolCall.status}`)

  // Find the message or create one if needed
  let message = chat.value.messages.find(m => m.uuid === messageId)
  if (!message) {
    message = new Message('assistant', '')
    message.uuid = messageId
    message.engine = engine.value
    message.model = model.value
    chat.value.messages.push(message)
  }

  // Add/update tool call with marker in content
  message.addToolCall({
    type: 'tool',
    id: toolCall.id,
    name: toolCall.name,
    state: toolCall.status === 'running' ? 'running' : 'completed',
    status: null,
    done: toolCall.status === 'completed',
    call: {
      params: JSON.parse(toolCall.params),
      result: JSON.parse(toolCall.result),
    }
  }, true)  // true = add marker to content for display
}

const onUsageUpdated = (usage: RealtimeUsage) => {
  // Update usage stats
  sessionTotals.value.audioInputTokens = usage.audioInputTokens
  sessionTotals.value.textInputTokens = usage.textInputTokens
  sessionTotals.value.cachedAudioTokens = usage.cachedAudioTokens
  sessionTotals.value.cachedTextTokens = usage.cachedTextTokens
  sessionTotals.value.audioOutputTokens = usage.audioOutputTokens
  sessionTotals.value.textOutputTokens = usage.textOutputTokens

  // Get cost info from engine
  if (realtimeEngine) {
    const costInfo = realtimeEngine.getCostInfo(usage)
    sessionTotals.value.costInfo = costInfo
  }
}

const onError = (error: Error) => {
  status.value = `${t('realtimeChat.errorPrefix')}${error.message}`
  console.error('Session error:', error)
  stopSession()
}

const startSession = async () => {

  try {

    status.value = t('realtimeChat.callingVoice', { voice: getVoiceName() })
    state.value = 'active'

    // Init LlmUtils to get system instructions
    const llmUtils = new LlmUtils({
      ...store.config,
      llm: {
        ...store.config.llm,
        additionalInstructions: {
          datetime: true,
          toolRetry: true,
          artifacts: false,
          mermaid: false,
        }
      }
    })

    // Create engine instance with callbacks
    realtimeEngine = createRealtimeEngine(engine.value, store.config, {
      onStatusChange,
      onNewMessage,
      onMessageUpdated,
      onMessageToolCall,
      onUsageUpdated,
      onError,
    })

    // Reset chat for new session
    chat.value = new Chat()

    // Connect the engine
    await realtimeEngine.connect({
      model: model.value,
      voice: voice.value,
      instructions: llmUtils.getSystemInstructions(null, {
        noMarkdown: true,
      }),
      tools: toolSelection.value.length > 0 ? toolSelection.value : null,
    })

  } catch (err: any) {
    status.value = `${t('realtimeChat.errorPrefix')}${err.message}`
    console.error('Session error:', err)
    stopSession()
  }
}

const stopSession = () => {

  // close
  realtimeEngine?.close()
  realtimeEngine = null

  // done
  status.value = getIdleStatus()
  state.value = 'idle'
}

const onStart = () => {
  if (realtimeEngine?.isConnected()) {
    stopSession()
  } else {
    startSession()
  }
}

const save = () => {
  store.config.realtime.engine = engine.value
  store.config.realtime.tools = toolSelection.value
  store.config.engines[engine.value].realtime.model = model.value
  store.config.engines[engine.value].realtime.voice = voice.value
  store.saveSettings()
}

defineExpose({
  startDictation: onStart,
})

</script>


<style scoped>

.realtime {
  background-color: var(--window-bg-color);
  color: var(--text-color);
  font-size: 18.5px;

  .sp-sidebar {
    flex: 0 0 var(--large-panel-width);

    button.tools {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--control-border-color);
      border-radius: var(--control-border-radius);
      background-color: var(--control-bg-color);
      color: var(--control-text-color);
      font-size: 14px;
      cursor: pointer;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      svg {
        width: 16px;
        height: 16px;
      }
    }
  }

  .sp-main {

    main {
      justify-content: center;
      align-items: center;

      .status {
        margin-bottom: 2rem;
      }

      .blobs {
        cursor: pointer;
      }

      .cost-container {
        text-align: center;
        margin-top: 2rem;
        font-size: 13.5px;

        .value {
          margin: 4px 0px;
          font-size: 18.5px;
          font-weight: bold;
          font-variant-numeric: tabular-nums;

          span {
            display: inline-flex !important;
          }
        }
        .note {
          font-size: 12px;
        }
      }

    }

  }

  .sp-transcript {
    display: flex;
    flex-direction: column;
    flex: 0 0 calc(var(--large-panel-width) * 1.5);
    border-left: 1px solid var(--sidebar-border-color);
    background-color: var(--message-list-bg-color);

    header {
      flex-shrink: 0;
      padding: 16px;
      border-bottom: 1px solid var(--sidebar-border-color);

      .title {
        font-weight: 500;
      }
    }

    .messages-list {
      flex: 1;
      overflow: hidden;
    }
  }

  &:deep() .messages {

    padding: 2rem;

    > div:first-child > .message.user {
      margin-top: 0 !important;
    }

    .message {

      margin-bottom: 0;

      .body {
        max-width: unset;
        .message-content {
          p {
            margin: 8px 0;
          }
          .tool-container {
            margin-top: 1rem;
            font-size: 75%;
          }
        }

      }
      

      .actions {
        height: 32px;
        .action:not(.copy) {
          display: none;
        }
      }

      &.user {
        margin-top: 1rem;
        .body, .actions {
          margin-right: 0px;
        }
      }

      &.assistant {
        .body, .actions {
          margin-left: 0px;
          padding-left: 0px;
        }
        .actions {
          margin-top: -8px;
        }
      }

    }
  }

}

.macos .realtime .sp-main header {
  padding-left: 40px;
}

</style>
