
<template>

  <div class="language-selector">
    <div class="localeUI">
      <LangSelect class="large" v-model="localeUI" default-text="common.language.system" :filter="locales" @change="save" />
    </div>
  </div>

  <section>

    <header>
      <img class="logo" src="../../assets/icon.png" alt="Witsy Logo" />
      <h1>{{ t('onboarding.welcome.title') }}</h1>
      <h3>{{ t('onboarding.welcome.subtitle') }}</h3>
    </header>

    <main>

      <div class="feature" :style="{ '--delay': '0s' }">
        <BIconChatSquareQuote class="feature-icon" />
        <span class="feature-text">{{ t('common.chat') }}</span>
      </div>

      <div class="feature" :style="{ '--delay': '0.2s' }">
        <BIconBinoculars class="feature-icon" />
        <span class="feature-text">{{ t('common.deepResearch') }}</span>
      </div>

      <div class="feature" :style="{ '--delay': '0.4s' }">
        <BIconPalette class="feature-icon" />
        <span class="feature-text">{{ t('designStudio.title') }}</span>
      </div>

      <div class="feature" :style="{ '--delay': '0.6s' }">
        <BIconJournalText class="feature-icon" />
        <span class="feature-text">{{ t('scratchpad.title') }}</span>
      </div>

      <div class="feature" :style="{ '--delay': '0.8s' }">
        <BIconMic class="feature-icon" />
        <span class="feature-text">{{ t('transcribe.title') }}</span>
      </div>

      <div class="feature" v-if="store.config.features?.agents" :style="{ '--delay': '1.0s' }">
        <BIconRobot class="feature-icon" />
        <span class="feature-text">{{ t('agent.forge.title') }}</span>
      </div>


    </main>


  </section>

  

</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import LangSelect from '../components/LangSelect.vue'

const locales = ref([])
const localeUI = ref(null)

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

</script>


<style scoped>

.language-selector {
  position: absolute;
  top: 0.85rem;
  right: 3rem;
  z-index: 10;
}

section {
  
  justify-content: center;

  header {

    .logo {
      width: 8rem;
      height: 8rem;
    }

    h1 {
      padding-top: 1rem;
    }

    h3 {
      padding: 2rem 6rem !important;
    }

  }

  main {

    flex: inherit !important;
    display: flex;
    flex-direction: row !important;
    align-items: flex-start !important;
    justify-content: center;
    overflow-y: hidden !important;
    gap: 5rem;

    .feature {
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 1.2rem;
      gap: 1rem;
      width: 4rem;
      text-align: center;
      opacity: 0.65;

      .feature-icon {
        width: 2rem;
        height: 2rem;
        transform: translateY(-100vh);
        animation: slideInIcon 0.8s ease-out forwards;
        animation-delay: var(--delay);
      }

      .feature-text {
        opacity: 0;
        transform: translateY(20px);
        animation: fadeInText 0.6s ease-out forwards;
        animation-delay: calc(var(--delay) + 0.4s);
      }
    }

  }

}

@keyframes slideInIcon {
  0% {
    transform: translateY(-100vh) rotate(-180deg);
    opacity: 0;
  }
  60% {
    transform: translateY(10px) rotate(10deg);
    opacity: 1;
  }
  80% {
    transform: translateY(-5px) rotate(-5deg);
  }
  100% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
}

@keyframes fadeInText {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

</style>