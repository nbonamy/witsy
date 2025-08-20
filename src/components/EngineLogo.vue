
<template>
  <div :class="[ 'logo', engine, background ? 'background' : '' ]">
    <component v-if="isComponent" :is="logo" :class="[ 'svg', klass, grayscale ? 'grayscale' : '' ]" />
    <img v-else :src="logo" :class="[ 'img', klass, grayscale ? 'grayscale' : '' ]" />
    <div class="label" v-if="customLabel && label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">

import { CustomEngineConfig } from '../types/config'
import { computed } from 'vue'
import { store } from '../services/store'
import LlmFactory, { favoriteMockEngine } from '../llms/llm'
import LogoCustom from '../../assets/custom.svg?component'
import LogoFavorite from '../../assets/favorite.svg?component'
import LogoAnthropic from '../../assets/anthropic.svg?component'
import LogoAzure from '../../assets/azure.svg?component'
import LogoCerberas from '../../assets/cerebras.svg?component'
import LogoDeepSeek from '../../assets/deepseek.svg?component'
import LogoElevenLabs from '../../assets/elevenlabs.svg?component'
import LogoFalai from '../../assets/falai.svg?component'
import LogoFireworks from '../../assets/fireworks.svg?component'
// PNG logos imported as URL strings
import LogoGoogle from '../../assets/google.svg?component'
import LogoGroq from '../../assets/groq.svg?component'
import LogoHuggingFace from '../../assets/huggingface.svg?component'
import LogoLMStudio from '../../assets/lmstudio.svg?component'
import LogoMeta from '../../assets/meta.svg?component'
import LogoMistralAI from '../../assets/mistralai.svg?component'
import LogoNvidia from '../../assets/nvidia.svg?component'
import LogoOllama from '../../assets/ollama.svg?component'
import LogoOpenAI from '../../assets/openai.svg?component'
import LogoOpenRouter from '../../assets/openrouter.svg?component'
import LogoReplicate from '../../assets/replicate.svg?component'
import LogoXAI from '../../assets/xai.svg?component'

const llmManager = LlmFactory.manager(store.config)

const logos: { [key: string]: any } = {
  anthropic: LogoAnthropic,
  azure: LogoAzure,
  cerebras: LogoCerberas,
  deepseek: LogoDeepSeek,
  elevenlabs: LogoElevenLabs,
  falai: LogoFalai,
  fireworks: LogoFireworks,
  google: LogoGoogle,
  groq: LogoGroq,
  huggingface: LogoHuggingFace,
  lmstudio: LogoLMStudio,
  meta: LogoMeta,
  mistralai: LogoMistralAI,
  nvidia: LogoNvidia,
  ollama: LogoOllama,
  openai: LogoOpenAI,
  openrouter: LogoOpenRouter,
  replicate: LogoReplicate,
  xai: LogoXAI,
}

const pngLogos: { [key: string]: string } = {
  gladia: window.api.app.getAssetPath('./assets/gladia.png'),
  speechmatics: window.api.app.getAssetPath('./assets/speechmatics.png')
}

const props = defineProps({
  engine: {
    type: String,
    required: true,
  },
  grayscale: {
    type: Boolean,
    default: false
  },
  background: {
    type: Boolean,
    default: false
  },
  customLabel: {
    type: Boolean,
    default: false
  }
})

const logo = computed(() => {
  if (props.engine == favoriteMockEngine) return LogoFavorite
  if (pngLogos[props.engine]) return pngLogos[props.engine]
  if (logos[props.engine]) return logos[props.engine]
  if (llmManager.isCustomEngine(props.engine)) {
    const engineConfig = store.config?.engines?.[props.engine] as CustomEngineConfig
    if (engineConfig?.api === 'azure') return LogoAzure
  }
    return LogoCustom
})

const isComponent = computed(() => {
  const logoValue = logo.value
  return typeof logoValue !== 'string'
})

const label = computed(() => {
  if (llmManager.isCustomEngine(props.engine)) {
    return (store.config.engines[props.engine] as CustomEngineConfig).label
  }
})

const klass = computed(() => {
  if (props.engine == favoriteMockEngine) return 'favorite'
  if (logos[props.engine]) return props.engine
  if (llmManager.isCustomEngine(props.engine)) {
    const engineConfig = store.config?.engines?.[props.engine] as CustomEngineConfig
    if (engineConfig?.api === 'azure') return 'azure'
  }
  return 'custom'
})

</script>

<style scoped>

.logo {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &.background {
    padding: 4px;
    border-radius: 6px;
    background-color: rgb(255, 255, 255);
  }

  /* &.openai.background {
    background-color: rgb(117, 169, 155);
    .svg {
      fill: rgb(255, 255, 255);
    }
  } */

  /* &.anthropic.background {
    background-color: rgb(20, 20, 19)
  } */

  .svg {
    object-fit: fill;
    height: 100%;

    &.grayscale {
      fill: rgb(64, 64, 64);
      filter: grayscale(100%);

      &.azure {
        filter: grayscale(100%) brightness(1.6);
      }
    }

  }

  .img {
    object-fit: fill;
    height: 100%;
    width: 100%;

    &.grayscale {
      filter: grayscale(100%);
    }

  }

  .label {
    position: absolute;
    background-color: var(--background-color);
    padding: 1px 0px 2px 0px;
    font-size: 13.5px;
    min-width: 100%;
    text-align: center;
  }

}

@media (prefers-color-scheme: dark) {

  .logo {

    &.background {
      background-color: var(--text-color);
    }

    .svg {
      &.grayscale {
        fill: var(--text-color);
      }
    }

    .img {
      &.grayscale {
        filter: grayscale(100%) brightness(0.8);
      }
    }

    &.gladia, &.speechmatics {
      filter: invert(1);
    }

  }

}

</style>
