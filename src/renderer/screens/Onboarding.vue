<template>

  <div class="overlay" />

  <div class="onboarding" v-bind="$attrs">

    <div class="close"><XIcon @click="$emit('close')" /></div>

    <div class="language-selector" v-if="step === 0">
      <div class="localeUI">
        <LangSelect class="large" v-model="localeUI" default-text="common.language.system" :filter="locales" @change="save" />
      </div>
    </div>

    <div class="container">
      <main :style="{ transform: `translateX(-${step * 100}%)` }">
        <Welcome />
        <Chat ref="chat" />
        <Ollama ref="ollama" />
        <Studio ref="studio" />
        <Voice ref="voice" />
        <Permissions ref="permissions" v-if="hasPermissions" />
        <Instructions ref="instructions" />
        <Done ref="done" />
      </main>
    </div>

    <footer class="form form-large">
      <button v-if="step !== 0" class="prev" @click.prevent="onPrev">{{ t('common.wizard.prev')}}</button>
      <button v-if="step !== 7" class="next default" @click.prevent="onNext">{{ t('common.wizard.next')}}</button>
      <button v-if="step === 7" class="last" @click.prevent="$emit('close')">{{ t('common.close')}}</button>
    </footer>

  </div>

</template>

<script setup lang="ts">

import { XIcon } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import LangSelect from '../components/LangSelect.vue'
import Chat from '../onboarding/Chat.vue'
import Done from '../onboarding/Done.vue'
import Instructions from '../onboarding/Instructions.vue'
import Ollama from '../onboarding/Ollama.vue'
import Permissions from '../onboarding/Permissions.vue'
import Studio from '../onboarding/Studio.vue'
import Voice from '../onboarding/Voice.vue'
import Welcome from '../onboarding/Welcome.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'

defineEmits(['close']);

const step = ref(0)
const locales = ref([])
const localeUI = ref(null)
const chat = ref<typeof Chat>(null)
const ollama = ref<typeof Ollama>(null)
const studio = ref<typeof Studio>(null)
const voice = ref<typeof Voice>(null)
const instructions = ref<typeof Instructions>(null)
const permissions = ref<typeof Permissions>(null)
const done = ref<typeof Done>(null)

const isMacOS = window.api.platform === 'darwin'
const hasPermissions = isMacOS

const indexWelcome = 0
const indexChat = indexWelcome + 1
const indexOllama = indexChat + 1
const indexStudio = indexOllama + 1
const indexVoice = indexStudio + 1
const indexPermissions = indexVoice + 1
const indexInstructions = indexPermissions + (hasPermissions ? 1 : 0)
const indexDone = indexInstructions + 1

onMounted(() => {
  // Load available locales
  locales.value = Object.keys(window.api.config.getI18nMessages())
  
  // Load current locale setting
  localeUI.value = store.config.general.locale
})

const save = () => {
  store.config.general.locale = localeUI.value
  store.saveSettings()
}

const onPrev = () => {

  // navigate back
  if (step.value === indexWelcome) return
  step.value--

  // notify
  notifyVisible()
}

const onNext = async () => {

  // Check canLeave for Permissions screen on macOS
  if (hasPermissions && permissions.value && step.value === indexPermissions) {
    if (!await permissions.value.canLeave()) {
      return
    }
  }

  // Check canLeave for Instructions screen
  if (instructions.value && step.value === indexInstructions) {
    if (!await instructions.value.canLeave()) {
      return
    }
  }

  // navigate forwared
  step.value++

  // notify
  notifyVisible()

}

const notifyVisible = () => {
  const screens = [
    null, chat.value, ollama.value, studio.value, voice.value,
    ...(hasPermissions ? [permissions.value] : []),
    instructions.value, done.value
  ]
  screens[step.value]?.onVisible?.()
}

</script>


<style scoped>

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--text-color);
  opacity: 0.25;
  z-index: 19;
}

.onboarding {

  --onboarding-width: 850px;
  --onboarding-bg-color: var(--background-color);/*rgb(255, 254, 255);*/
  
  position: absolute;
  width: var(--onboarding-width);
  top: 10%;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 1rem;
  z-index: 20;
  background-color: var(--onboarding-bg-color);
  border-color: 1px solid var(--dialog-border-color);
  padding: 4rem;
  padding-top: 3rem;
  color: var(--text-color);

  .close {
    position: absolute;
    top: 1.25rem;
    right: 1.5rem;
    cursor: pointer;
  }

  .language-selector {
    position: absolute;
    top: 0.85rem;
    right: 3rem;
    z-index: 10;
  }

  .container {
    overflow: hidden;
    height: 100%;
  }
  
  main {
    
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: flex-start;
    margin-bottom: 3rem;
    height: calc(100% - 3rem);
    width: 100%;

    transition: all 0.3s ease;

    &:deep() section {

      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: var(--onboarding-width);
      height: 100%;

      header {
        position: sticky;
        top: 0;
        background-color: var(--onboarding-bg-color);
        z-index: 10;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        flex-shrink: 0;

        h1 {
          margin-bottom: 0.5rem;
        }

        h3 {
          padding: 0 4rem;
          text-align: center;
          color: var(--dimmed-text-color);
          font-weight: var(--font-weight-regular);
        }
      }

      & > *:not(header) {
        flex: 1;
        width: 100%;
        overflow-y: auto;
        padding-top: 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

    }

  }

  footer {
    width: 100%;
    display: flex;
    button {
      outline: none;
    }
    .next, .last {
      margin-left: auto;
    }
  }
}

</style>
