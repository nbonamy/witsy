
<template>
  <div :class="[ 'logo', engine, background ? 'background' : '' ]">
    <component :is="logo" :class="[ 'svg', grayscale ? 'grayscale' : '' ]" />
    <div class="label" v-if="customLabel && label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">

import { CustomEngineConfig } from '../types/config'
import { computed } from 'vue'
import { store } from '../services/store'
import LlmFactory from '../llms/llm'
import LogoOpenAI from '../../assets/openai.svg?component'
import LogoOllama from '../../assets/ollama.svg?component'
import LogoAnthropic from '../../assets/anthropic.svg?component'
import LogoMistralAI from '../../assets/mistralai.svg?component'
import LogoGoogle from '../../assets/google.svg?component'
import LogoXAI from '../../assets/xai.svg?component'
import LogoDeepSeek from '../../assets/deepseek.svg?component'
import LogoGroq from '../../assets/groq.svg?component'
import LogoCerberas from '../../assets/cerebras.svg?component'
import LogoOpenRouter from '../../assets/openrouter.svg?component'
import LogoCustom from '../../assets/custom.svg?component'

const llmFactory = new LlmFactory(store.config)

const logos: { [key: string]: any } = {
  openai: LogoOpenAI,
  ollama: LogoOllama,
  anthropic: LogoAnthropic,
  mistralai: LogoMistralAI,
  google: LogoGoogle,
  xai: LogoXAI,
  openrouter: LogoOpenRouter,
  deepseek: LogoDeepSeek,
  groq: LogoGroq,
  cerebras: LogoCerberas,
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

const logo = computed(() => logos[props.engine] ?? LogoCustom)

const label = computed(() => {
  if (llmFactory.isCustomEngine(props.engine)) {
    return (store.config.engines[props.engine] as CustomEngineConfig).label
  }
})  

</script>

<style scoped>

.logo {
  positiion: relative;
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
    }

  }

  .label {
    position: absolute;
    background-color: var(--background-color);
    padding: 1px 0px 2px 0px;
    font-size: 10pt;
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

  }

}

</style>
