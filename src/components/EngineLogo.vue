
<template>
  <img :src="logo" class="logo" :class="[ engine, grayscale ? 'grayscale' : 'colored', background ? 'background' : '' ]" />
</template>

<script setup>

import { computed } from 'vue'
import logoOpenAI from '../../assets/openai.svg'
import logoOllama from '../../assets/ollama.svg'
import logoAnthropic from '../../assets/anthropic.svg'
import logoMistralAI from '../../assets/mistralai.svg'
import logoGoogle from '../../assets/google.svg'
import logoGroq from '../../assets/groq.svg'

const logos = {
  openai: logoOpenAI,
  ollama: logoOllama,
  anthropic: logoAnthropic,
  mistralai: logoMistralAI,
  google: logoGoogle,
  groq: logoGroq
}

const props = defineProps({
  engine: String,
  grayscale: {
    type: Boolean,
    default: false
  },
  background: {
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

.logo.groq {
  filter: invert(1);
}

.logo.colored.openai {
  filter: invert(1);
}

.logo.background.openai {
  background-color: #865563;
}

.logo.colored.ollama {
  background-color: white;
}

.logo.grayscale.mistralai {
  filter: grayscale()
}

.logo.background.anthropic {
  background-color: #f0f0ea;
}

.logo.background.groq {
  background-color: #F55036;
  filter: none;
}

.logo.grayscale.google {
  filter: grayscale()
}

</style>
