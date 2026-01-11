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
            <div class="value">$ <NumberFlip :value="sessionTotals.cost.total" :animate-initial-number="false" :formatter="(n: number) => n.toFixed(6)"/></div>
            <div class="note">{{ t('common.basedOn') }} {{ model.includes('mini') ? 'gpt-realtime-mini' : 'gpt-realtime' }}<br>
              <a href="https://platform.openai.com/docs/pricing" target="_blank">{{ t('common.costsAsOf') }}</a> 11/01/2026</div>
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

  </div>
</template>

<script setup lang="ts">

import AnimatedBlob from '@components/AnimatedBlob.vue'
import MessageList from '@components/MessageList.vue'
import NumberFlip from '@components/NumberFlip.vue'
import Chat from '@models/chat'
import Message from '@models/message'
import { RealtimeAgent, RealtimeItem, RealtimeSession } from '@openai/agents/realtime'
import useTipsManager from '@renderer/utils/tips_manager'
import { t } from '@services/i18n'
import { buildRealtimeTools } from '@services/realtime_tools'
import { store } from '@services/store'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LlmUtils from '../services/llm_utils'

const tipsManager = useTipsManager(store)

type Cost = {
  input: number,
  output: number
  total: number
}

type Stats = {
  audioInputTokens: number,
  textInputTokens: number,
  cachedAudioTokens: number,
  cachedTextTokens: number,
  audioOutputTokens: number,
  textOutputTokens: number
  cost?: Cost
}

const sessionTotals = ref<Stats>({
  audioInputTokens: 0,
  textInputTokens: 0,
  cachedAudioTokens: 0,
  cachedTextTokens: 0,
  audioOutputTokens: 0,
  textOutputTokens: 0,
  cost: {
    input: 0,
    output: 0,
    total: 0,
  }
})

const kWelcomeMessage = t('common.clickToStart')

const blob = ref<typeof AnimatedBlob>(null)
const engine = ref<string>('openai')
const model = ref<string>('gpt-4o-mini-realtime-preview')
const voice = ref<string>('ash')
const status = ref(kWelcomeMessage)
const state = ref<'idle'|'active'>('idle')
const chat = ref<Chat>(new Chat())

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
  } else if (engine.value === 'openai') {
    return [
      { id: 'alloy', name: 'Alloy' },
      { id: 'ash', name: 'Ash' },
      { id: 'ballad', name: 'Ballad' },
      { id: 'coral', name: 'Coral' },
      { id: 'echo', name: 'Echo' },
      { id: 'sage', name: 'Sage' },
      { id: 'simmer', name: 'Simmer' },
      { id: 'verse', name: 'Verse' }
    ]
  }
})

let session: RealtimeSession | null = null

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

const onChangeEngine = () => {
  model.value = store.config.engines[engine.value].realtime.model || models.value[0].id
  voice.value = store.config.engines[engine.value].realtime.voice || voices.value[0].id
  save()
}

const onHistoryAdded = (item: RealtimeItem) => {
  console.log('History added:', JSON.stringify(item, null, 2))
  updateUsageFromSession()
}

const onToolStart = (_context: any, _agent: any, tool: any, details: any) => {
  console.log('Tool start:', tool.name, details)

  // Find the last assistant message or create one
  let assistantMessage = chat.value.messages.findLast(m => m.role === 'assistant')
  if (!assistantMessage) {
    assistantMessage = new Message('assistant', '')
    chat.value.messages.push(assistantMessage)
  }

  // Add tool call in running state
  assistantMessage.addToolCall({
    type: 'tool',
    id: details.toolCallId || crypto.randomUUID(),
    name: tool.name,
    state: 'running',
    status: null,
    done: false,
    call: {
      params: details.input,
      result: null
    }
  }, false)
}

const onToolEnd = (_context: any, _agent: any, tool: any, result: any, details: any) => {
  console.log('Tool end:', tool.name, result, details)

  // Find the assistant message with this tool call
  const assistantMessage = chat.value.messages.findLast(m => m.role === 'assistant')
  if (assistantMessage) {
    // Update tool call to completed state
    assistantMessage.addToolCall({
      type: 'tool',
      id: details.toolCallId || '',
      name: tool.name,
      state: 'completed',
      status: null,
      done: true,
      call: {
        params: details.input,
        result: typeof result === 'string' ? result : JSON.stringify(result)
      }
    }, false)
  }
}

const onHistoryUpdated = (history: RealtimeItem[]) => {

  // log
  console.log('History updated:', JSON.stringify(history, null, 2))
  console.log('History item types:', history.map(h => ({ type: h.type, role: (h as any).role, contentTypes: (h as any).content?.map((c: any) => c.type) })))

  // Convert SDK history items to Message objects
  const messages: Message[] = []
  for (const item of history) {
    if (item.type === 'message' && item.content?.length > 0) {
      const content = item.content[0]
      // Get transcript from audio content types
      const transcript = (content.type === 'input_audio' || content.type === 'output_audio')
        ? (content.transcript ?? '*Transcription unavailable*')
        : (content.type === 'input_text' || content.type === 'output_text')
        ? content.text
        : null
      if (transcript) {
        const message = new Message(item.role, transcript)
        message.uuid = item.itemId
        messages.push(message)
      }
    }
  }
  chat.value.messages = messages

  // Update usage/cost from session
  updateUsageFromSession()
}

const updateUsageFromSession = () => {

  if (!session) return

  const usage = session.usage

  // Sum up token details from arrays
  // Note: audio_tokens/text_tokens INCLUDE cached tokens, so we subtract to get non-cached
  let totalAudioInput = 0
  let totalTextInput = 0
  let cachedAudioTokens = 0
  let cachedTextTokens = 0
  let audioOutputTokens = 0
  let textOutputTokens = 0

  type InputTokenDetails = {
    audio_tokens?: number
    text_tokens?: number
    cached_tokens_details?: {
      audio_tokens?: number
      text_tokens?: number
    }
  }

  type OutputTokenDetails = {
    audio_tokens?: number
    text_tokens?: number
  }

  for (const details of (usage.inputTokensDetails || []) as InputTokenDetails[]) {
    totalAudioInput += details.audio_tokens || 0
    totalTextInput += details.text_tokens || 0
    // Cached tokens are nested in cached_tokens_details
    if (details.cached_tokens_details) {
      cachedAudioTokens += details.cached_tokens_details.audio_tokens || 0
      cachedTextTokens += details.cached_tokens_details.text_tokens || 0
    }
  }

  // Non-cached = total - cached
  const audioInputTokens = totalAudioInput - cachedAudioTokens
  const textInputTokens = totalTextInput - cachedTextTokens

  for (const details of (usage.outputTokensDetails || []) as OutputTokenDetails[]) {
    audioOutputTokens += details.audio_tokens || 0
    textOutputTokens += details.text_tokens || 0
  }

  // Calculate costs based on model
  // from https://platform.openai.com/docs/pricing (per 1M tokens)
  const currentModel = store.config.engines.openai.realtime.model || ''
  const isMini = currentModel.toLowerCase().includes('mini')

  // gpt-realtime-mini pricing
  const MINI_TEXT_INPUT = 0.0000006      // $0.60 / 1M
  const MINI_TEXT_CACHED = 0.00000006    // $0.06 / 1M
  const MINI_TEXT_OUTPUT = 0.0000024     // $2.40 / 1M
  const MINI_AUDIO_INPUT = 0.00001       // $10.00 / 1M
  const MINI_AUDIO_CACHED = 0.0000003    // $0.30 / 1M
  const MINI_AUDIO_OUTPUT = 0.00002      // $20.00 / 1M

  // gpt-realtime pricing
  const FULL_TEXT_INPUT = 0.000004       // $4.00 / 1M
  const FULL_TEXT_CACHED = 0.0000004     // $0.40 / 1M
  const FULL_TEXT_OUTPUT = 0.000016      // $16.00 / 1M
  const FULL_AUDIO_INPUT = 0.000032      // $32.00 / 1M
  const FULL_AUDIO_CACHED = 0.0000004    // $0.40 / 1M
  const FULL_AUDIO_OUTPUT = 0.000064     // $64.00 / 1M

  const TEXT_INPUT_COST = isMini ? MINI_TEXT_INPUT : FULL_TEXT_INPUT
  const TEXT_CACHED_COST = isMini ? MINI_TEXT_CACHED : FULL_TEXT_CACHED
  const TEXT_OUTPUT_COST = isMini ? MINI_TEXT_OUTPUT : FULL_TEXT_OUTPUT
  const AUDIO_INPUT_COST = isMini ? MINI_AUDIO_INPUT : FULL_AUDIO_INPUT
  const AUDIO_CACHED_COST = isMini ? MINI_AUDIO_CACHED : FULL_AUDIO_CACHED
  const AUDIO_OUTPUT_COST = isMini ? MINI_AUDIO_OUTPUT : FULL_AUDIO_OUTPUT

  const inputCost = (audioInputTokens * AUDIO_INPUT_COST) +
                    (cachedAudioTokens * AUDIO_CACHED_COST) +
                    (cachedTextTokens * TEXT_CACHED_COST) +
                    (textInputTokens * TEXT_INPUT_COST)
  const outputCost = (audioOutputTokens * AUDIO_OUTPUT_COST) +
                     (textOutputTokens * TEXT_OUTPUT_COST)
  const totalCost = inputCost + outputCost

  // console.log('Cost calculated:', { inputCost, outputCost, totalCost })

  // Update session totals - update nested properties for reactivity
  sessionTotals.value.audioInputTokens = audioInputTokens
  sessionTotals.value.textInputTokens = textInputTokens
  sessionTotals.value.cachedAudioTokens = cachedAudioTokens
  sessionTotals.value.cachedTextTokens = cachedTextTokens
  sessionTotals.value.audioOutputTokens = audioOutputTokens
  sessionTotals.value.textOutputTokens = textOutputTokens
  sessionTotals.value.cost.input = inputCost
  sessionTotals.value.cost.output = outputCost
  sessionTotals.value.cost.total = totalCost
}

const startSession = async () => {
  
  try {

    //status.className = 'status'
    status.value = t('realtimeChat.requestingMicrophone')
    state.value = 'active'

    // init agent with instructions
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

    // build tools from enabled plugins
    const realtimeModel = store.config.engines.openai.realtime.model
    const tools = await buildRealtimeTools(store.config, realtimeModel)

    const agent = new RealtimeAgent({
      name: 'Assistant',
      instructions: llmUtils.getSystemInstructions(null, {
        noMarkdown: true,
      }),
      tools,
    })

    session = new RealtimeSession(agent, {
      config: {
        voice: voice.value,
        audio: {
          input: {
            transcription: {
              model: 'gpt-4o-mini-transcribe',
            }
          }
        }
      }
    });

    // Listen for history updates to build transcript
    session.on('history_updated', onHistoryUpdated)
    session.on('history_added', onHistoryAdded)

    // Listen for tool events
    session.on('agent_tool_start', onToolStart)
    session.on('agent_tool_end', onToolEnd)

    // Reset chat for new session
    chat.value = new Chat()

    try {

      status.value = t('realtimeChat.establishingConnection')

      // get an ephemeral api key
      const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${store.config.engines.openai.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model: store.config.engines.openai.realtime.model,
          }
        })
      })

      const data = await response.json()
      const ephemeralKey = data.value      

      await session.connect({
        apiKey: ephemeralKey,
        model: store.config.engines.openai.realtime.model,
      });

      status.value = t('realtimeChat.sessionEstablished')

    } catch (e) {
      console.error(e);
    }    

  } catch (err) {
    //status.className = 'status error'
    status.value = `${t('realtimeChat.errorPrefix')}${err.message}`
    console.error('Session error:', err)
    stopSession()
  }
}

const stopSession = () => {

  // close
  session?.close()
  session = null

  // done
  status.value = kWelcomeMessage
  state.value = 'idle'
}

const onStart = () => {
  if (session) {
    stopSession()
  } else {
    startSession()
  }
}

const save = () => {
  store.config.realtime.engine = engine.value
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
    flex: 0 0 500px;
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
    
    .message {

      margin-bottom: 0;

      .body {

        max-width: unset;

        .message-content {
          p {
            margin: 8px 0;
          }
        }

      }

      .actions {

        height: 16px;

        .action:not(.copy) {
          display: none;
        }

      }

      &.user {
        .body {
          margin-right: 0px;
        }
        .actions {
          margin-right: 0px;
          height: 32px;
        }
      }

      &.assistant {
        .body {
          margin-left: 0px;
          padding-left: 0px;
        }
        .actions {
          margin-left: 0px;
        }
      }

    }
  }

}

.macos .realtime .sp-main header {
  padding-left: 40px;
}

</style>