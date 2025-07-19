
<template>

  <section>

    <header>
      <h1>{{ t('onboarding.studio.title') }}</h1>
      <h3>{{ t('onboarding.studio.subtitle') }}</h3>
    </header>

    <div class="form form-large">
      <div class="engines-grid">
        <div class="studio-engine form-field" v-for="engine in engines" :key="engine">
          <div class="brand">
            <EngineLogo :engine="engine" :grayscale="appearanceTheme.isDark" />
            <span>{{ engineNames[engine] || engine }}</span>
          </div>
          <div class="config">
            <InputObfuscated v-model="store.config.engines[engine].apiKey" @change="store.saveSettings"/>
          </div>
        </div>
      </div>
    </div>

  </section>

</template>

<script setup lang="ts">

import { computed } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { engineNames } from '../llms/base'
import ImageCreator from '../services/image'
import VideoCreator from '../services/video'
import EngineLogo from '../components/EngineLogo.vue'
import InputObfuscated from '../components/InputObfuscated.vue'

import useAppearanceTheme from '../composables/appearance_theme'
const appearanceTheme = useAppearanceTheme()

const engines = computed(() => {
  const imageEngines = ImageCreator.getEngines(false).map(e => e.id)
  const videoEngines = VideoCreator.getEngines(false).map(e => e.id)
  return [...new Set([...imageEngines, ...videoEngines])].filter(engine => {
    if (engine === 'sdwebui') return false
    return true
  }).sort()
})

</script>


<style scoped>

.engines-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 4rem;
}

.studio-engine {

  display: flex;
  align-items: center;
  padding: 0rem;
  gap: 2rem;

  .brand {
    width: 4rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;

    .logo {
      width: 2rem;
    }

    span {
      font-size: 11pt;
    }
  }

  .config {
    width: 250px;
  }

  &:deep() input {
    width: 250px !important;
  }
  
}

</style>
