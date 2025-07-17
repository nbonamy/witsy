
<template>

  <section>
    <header>
      <h1>{{ t('onboarding.instructions.title') }}</h1>
      <h3>{{ t('onboarding.instructions.subtitle') }}</h3>
    </header>

    <main class="instructions-chat">
      
      <!-- Confirmation screen when system prompt is detected -->
      <div v-if="showConfirmation" class="confirmation-area">
        <BIconPersonVcard />
        <h2>{{ t('onboarding.instructions.done.title') }}</h2>
        <p>{{ t('onboarding.instructions.done.text') }}</p>
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

import { ref, onMounted } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import Prompt from '../components/Prompt.vue'
import MessageItemBody from '../components/MessageItemBody.vue'
import Assistant from '../services/assistant'
import Loader from '../components/Loader.vue'
import LlmManager from '../llms/manager'
import Message from '../models/message'
import Chat from '../models/chat'

// Constants
const SYSTEM_PROMPT_MARKER = "SYSTEM PROMPT"

const latestText = ref(null)
const isProcessing = ref(false)
const showConfirmation = ref(false)

const assistant = new Assistant(store.config)

let completed = false

onMounted(async () => {
  
  // we need to select the 1st configured engine
  const llmManager = new LlmManager(store.config)
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

})

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
    await assistant.prompt(prompt, {
      model: assistant.chat.model,
      streaming: true,
      titling: false,
      tools: false,
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
      showConfirmation.value = true
      processSystemPrompt(finalText.substring(SYSTEM_PROMPT_MARKER.length).trim())
    }

  } catch (error) {
    console.error('Error getting assistant response:', error)
    latestText.value = 'I apologize, but I encountered an error. Please try again.'
  } finally {
    isProcessing.value = false
  }
}

const processSystemPrompt = (instructions: string) => {

  // we prepend the structured instructions
  instructions = t('instructions.chat.structured') + '\n\n' + instructions
  
  // we create a personalized system prompt
  const id = crypto.randomUUID()
  store.config.llm.customInstructions.push({
    id,
    instructions,
    label: t('onboarding.instructions.instructions_label'),
  })

  // select it by default
  store.config.llm.instructions = id

  // done
  completed = true
  store.saveSettings()

}

defineExpose({
  canLeave: async () => {

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
  margin-bottom: 2rem;
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
}

.message-area {
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
  padding: 1.5rem;
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

</style>
