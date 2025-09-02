
<template>

  <section>

    <header>
      <img class="logo" src="../../assets/icon.png" alt="Logo" />
      <h1>{{ t('onboarding.welcome.title') }}</h1>
      <h3>{{ t('onboarding.welcome.subtitle') }}</h3>
    </header>

    <main>

      <div class="feature" :style="{ '--delay': '0s' }">
        <MessageSquareQuoteIcon class="feature-icon" />
        <span class="feature-text">{{ t('common.chat') }}</span>
      </div>

      <div class="feature" :style="{ '--delay': '0.2s' }">
        <TelescopeIcon class="feature-icon" />
        <span class="feature-text">{{ t('common.deepResearch') }}</span>
      </div>

      <div class="feature" :style="{ '--delay': '0.4s' }">
        <PaletteIcon class="feature-icon" />
        <span class="feature-text">{{ t('designStudio.title') }}</span>
      </div>

      <div class="feature" :style="{ '--delay': '0.6s' }">
        <NotebookPenIcon class="feature-icon" />
        <span class="feature-text">{{ t('scratchpad.title') }}</span>
      </div>

      <div class="feature" :style="{ '--delay': '0.8s' }">
        <MicIcon class="feature-icon" />
        <span class="feature-text">{{ t('transcribe.title') }}</span>
      </div>

      <div class="feature" :style="{ '--delay': '1.0s' }">
        <AgentIcon class="feature-icon" />
        <span class="feature-text">{{ t('agent.forge.title') }}</span>
      </div>

    </main>

  </section>

</template>

<script setup lang="ts">

import { MessageSquareQuoteIcon, MicIcon, NotebookPenIcon, PaletteIcon, TelescopeIcon } from 'lucide-vue-next'
import AgentIcon from '../../assets/agent.svg?component'
import { t } from '../services/i18n'

</script>

<style scoped>

section {
  
  align-self: center;
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