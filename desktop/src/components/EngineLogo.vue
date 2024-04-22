
<template>
  <img :src="logo" class="logo" :class="[ engine, grayscale ? 'grayscale' : 'colored' ]" />
</template>

<script setup>

import { computed } from 'vue'
import logoOpenAI from '../../assets/openai.svg'
import logoOllama from '../../assets/ollama.svg'
import logoAnthropic from '../../assets/anthropic.svg'
import logoMistralAI from '../../assets/mistralai.svg'

const logos = {
  openai: logoOpenAI,
  ollama: logoOllama,
  anthropic: logoAnthropic,
  mistralai: logoMistralAI,
}

const props = defineProps({
  engine: String,
  grayscale: {
    type: Boolean,
    default: false
  }
})

const logo = computed(() => logos[props.engine])

</script>

<style scoped>

.logo.colored {
  object-fit: contain;
  border-radius: 6px;
  padding: 4px;
}

.logo.colored.openai {
  background-color: #865563;
  filter: invert(1);
}

.logo.colored.ollama {
  background-color: white;
}

.logo.grayscale.mistralai {
  filter: grayscale()
}

.logo.colored.anthropic {
  background-color: #f0f0ea;
}

</style>
