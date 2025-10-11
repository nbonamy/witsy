
<template>

  <section>
    <header>
      <h1>{{ t('onboarding.instructions.title') }}</h1>
      <h3>{{ t('onboarding.instructions.subtitle') }}</h3>
    </header>

    <main class="instructions-chat" :class="[ stage ]">
      
      <!-- Confirmation screen when system prompt is detected -->
      <div v-if="stage === 'confirm'" class="confirmation-area">
        <IdCardLanyardIcon />
        <h2>{{ t('onboarding.instructions.done.title') }}</h2>
        <p>{{ t('onboarding.instructions.done.text') }}</p>
      </div>

      <!-- Instruction selection screen -->
      <div v-else-if="stage === 'select'" class="instruction-selection">

        <div class="selection-header" v-html="t('onboarding.instructions.selectStyle')"></div>

        <div class="instructions-grid">
          <div 
            v-for="instructionType in getStandardInstructions()" 
            :key="instructionType.id"
            class="instruction-card"
            :class="[ instructionType.id ]"
            @click="selectInstruction(instructionType.id)"
          >
            <div v-if="instructionType.id === 'structured'" class="recommended-badge">
              {{ t('common.recommended') }}
            </div>
            <div class="instruction-header">
              <span class="instruction-emoji">{{ instructionType.emoji }}</span>
              <span class="instruction-name">{{ instructionType.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Regular chat interface -->
      <template v-else>

        <div class="message-area">
          
          <div class="assistant-message" v-if="latestText">
            <MessageItemBody 
              :message="new Message('assistant', latestText)"
              :show-tool-calls="'never'"
            />
          </div>

          <div class="loader" v-else>
            <Loader />
            <Loader />
            <Loader />
          </div>

        </div>

        <div class="prompt-area">
          <Prompt 
            :chat="assistant.chat"
            :disabled="isProcessing"
            :enable-attachments="false"
            :enable-commands="false"
            :enable-experts="false"
            :enable-deep-research="false"
            :enable-instructions="false"
            :enable-doc-repo="false"
            :enable-dictation="false"
            :enable-conversations="false"
            :enable-waveform="false"
            @prompt="onSendPrompt"
          />
        </div>

      </template>
    </main>
  </section>

</template>

<script setup lang="ts">

import { IdCardLanyardIcon } from 'lucide-vue-next'
import { ref } from 'vue'
import Loader from '../components/Loader.vue'
import MessageItemBody from '../components/MessageItemBody.vue'
import Prompt from '../components/Prompt.vue'
import Dialog from '../composables/dialog'
import LlmManager from '../llms/manager'
import Chat from '../models/chat'
import Message from '../models/message'
import Assistant from '../services/assistant'
import { t } from '../services/i18n'
import { store } from '../services/store'

// Constants
const SYSTEM_PROMPT_MARKER = "SYSTEM PROMPT"

type Stage = 'prompt' | 'select' | 'confirm'

const latestText = ref(null)
const isProcessing = ref(false)
const stage = ref<Stage>('prompt')
const detectedSystemPrompt = ref('')

const assistant = new Assistant(store.config)

let completed = false

const onVisible = async () => {

  // not twice
  if (assistant.chat.instructions) {
    return
  }

  // select openai if we can
  const llmManager = new LlmManager(store.config)
  if (llmManager.isEngineReady('openai')) {
    store.config.llm.engine = 'openai'
  }
 
  // we need to select the 1st configured engine
  if (!llmManager.isEngineReady(store.config.llm.engine)) {
    for (const engine of llmManager.getStandardEngines()) {
      if (llmManager.isEngineReady(engine)) {
        store.config.llm.engine = engine
        break
      }
    }
  }

  // now we can create the chat
  const chat = new Chat()
  chat.instructions = t('instructions.onboarding.instructions')
  const { engine, model } = llmManager.getChatEngineModel()
  chat.setEngineModel(engine, model)
  assistant.setChat(chat)

  // and start the conversation
  await processMessage(t('instructions.onboarding.prompt'))

}

const onSendPrompt = (payload: { prompt: string }) => {
  if (payload.prompt) {
    processMessage(payload.prompt)
  }
}

const processMessage = async (prompt: string) => {
  
  if (isProcessing.value) return

  try {
    
    latestText.value = ''
    let generationBuffer = ''
    isProcessing.value = true

    // Get assistant response using prompt method
    const abortController = new AbortController()
    await assistant.prompt(prompt, {
      model: assistant.chat.model,
      streaming: true,
      titling: false,
      tools: false,
      abortSignal: abortController.signal,
    }, (chunk: any) => {
      if (chunk?.type === 'content') {

        // update the buffer
        generationBuffer += chunk.text
        
        // Check if the response might be starting with "SYSTEM PROMPT"
        const upperBuffer = generationBuffer.toUpperCase().trim()
        const compareLength = Math.min(upperBuffer.length, SYSTEM_PROMPT_MARKER.length)
        if (upperBuffer.substring(0, compareLength) !== SYSTEM_PROMPT_MARKER.substring(0, compareLength)) {
          latestText.value = generationBuffer
        }
      }
    })

    // After generation is complete, check the final result
    const finalText = generationBuffer.trim()
    const upperFinalText = finalText.toUpperCase()
    
    if (upperFinalText.startsWith(SYSTEM_PROMPT_MARKER)) {
      detectedSystemPrompt.value = finalText.substring(SYSTEM_PROMPT_MARKER.length).trim()
      stage.value = 'select'
    }

  } catch (error) {
    console.error('Error getting assistant response:', error)
    latestText.value = 'I apologize, but I encountered an error. Please try again.'
  } finally {
    isProcessing.value = false
  }
}

const getStandardInstructions = () => {
  const defaultInstructions = ['standard', 'structured', 'playful', 'empathic', 'uplifting', 'reflective', 'visionary']
  
  return defaultInstructions.map(type => {
    const label = t(`settings.llm.instructions.${type}`)
    return {
      id: type,
      name: label.split(' ').slice(1).join(' '), // Remove emoji from name
      emoji: label.split(' ')[0], // Extract emoji
      description: getInstructionDescription(type)
    }
  })
}

const getInstructionDescription = (type: string) => {
  const fullInstruction = t(`instructions.chat.${type}`)
  // Extract the first sentence or first few words as description
  const lines = fullInstruction.split('\n')
  const firstLine = lines[0]
  
  // Try to find the first sentence
  const sentences = firstLine.split('.')
  if (sentences.length > 1 && sentences[0].length > 20) {
    return sentences[0] + '.'
  }
  
  // If no good sentence break, take first 100 characters
  return firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine
}

const selectInstruction = (instructionId: string) => {
  processSystemPrompt(instructionId, detectedSystemPrompt.value)
}

const processSystemPrompt = (instructionId: string, customInstructions: string) => {

  // Build the final instructions using the selected type and custom content
  let finalInstructions = t(`instructions.chat.${instructionId}`) + '\n\n' + customInstructions
  
  // we create a personalized system prompt
  const id = crypto.randomUUID()
  store.config.llm.customInstructions.push({
    id,
    instructions: finalInstructions,
    label: t('onboarding.instructions.instructions_label'),
  })

  // select it by default
  store.config.llm.instructions = id

  // show confirmation and mark as completed
  stage.value = 'confirm'
  completed = true
  store.saveSettings()

}
const canLeave = async () => {

  if (completed) {
    return true
  }

  const rc = await Dialog.show({
    title: t('onboarding.instructions.leave.title'),
    text: t('onboarding.instructions.leave.message'),
    showCancelButton: true,
    confirmButtonText: t('common.yes'),
    cancelButtonText: t('common.no'),
  })

  return rc.isConfirmed

}

defineExpose({
  onVisible,
  canLeave,
})


</script>

<style scoped>

section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

header {
  text-align: center;
  margin-bottom: 1rem;
}

.instructions-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 0rem !important;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  gap: 1rem;
  
  &.prompt {
    justify-content: flex-end;
  }
}

.message-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 1rem 4rem;
  border: 1px solid var(--prompt-input-border-color);
  text-align: center;
  box-sizing: border-box;
  border-radius: 1rem;
  overflow: auto;
}

.confirmation-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 2rem;
  border: 1px solid var(--prompt-input-border-color);
  text-align: center;
  box-sizing: border-box;
  border-radius: 1rem;
  gap: 1rem;

  svg {
    width: 4rem;
    height: 4rem;
    margin-bottom: 2rem;
    color: var(--faded-text-color);
  }

  h2 {
    margin: 0;
    color: var(--text-color);
  }

  p {
    margin: 0;
    color: var(--dimmed-text-color);
    max-width: 500px;
  }

}

.assistant-message {
  --messages-font: Garamond, Georgia, Times, 'Times New Roman', serif;
  font-size: 1.2rem;
  border-radius: 1rem;
  max-width: 100%;
}

.loader {
  display: flex;
  justify-content: center;
  padding: 1rem;
  gap: 2rem;
  opacity: 0.75;
}

.prompt-area {
  width: 100%;
}

.instruction-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 1rem 2rem;
  box-sizing: border-box;
  border: 1px solid var(--prompt-input-border-color);
  border-radius: 1rem;
}

.selection-header {
  margin-top: 1rem;
  margin-bottom: 2rem;
  font-size: 1.2em;
  font-weight: var(--font-weight-regular);
  color: var(--dimmed-text-color);
  text-align: center;
}

.instructions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  width: 100%;
  margin: 0 auto;
}

.instruction-card {
  
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 1rem 1.5rem;
  background-color: var(--background-color);
  border: 1px solid var(--control-border-color);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    border-color: var(--highlight-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.structured {
    padding-top: 2rem;
    border-color: var(--highlight-color);
    .instruction-name {
      font-weight: var(--font-weight-semibold);
    }
  }
}

.instruction-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.instruction-emoji {
  font-size: 1.5em;
  flex-shrink: 0;
}

.instruction-name {
  font-size: 0.95em;
  font-weight: var(--font-weight-regular);
  flex: 1;
}

.recommended-badge {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: var(--highlight-color);
  color: white;
  font-size: 0.7em;
  font-weight: var(--font-weight-semibold);
  padding: 0.25rem 0.5rem;
  border-top-left-radius: 0.65rem;
  border-top-right-radius: 0.65rem;
  text-transform: uppercase;
  text-align: center;
}

</style>
