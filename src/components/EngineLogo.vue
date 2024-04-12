
<template>
  <img :src="logo" class="logo" :class="[ engine, background ? 'bg' : '' ]" />
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
  background: {
    type: Boolean,
    default: false
  }
})

const logo = computed(() => logos[props.engine])

</script>

<style scoped>

.logo.bg.openai {
  background-color: #865563;
  border-radius: 4px;
  filter: invert(1);
  padding: 4px;
}

.logo.bg.ollama {
  object-fit: cover;
  background-color: white;
  border-radius: 4px;
  padding: 4px;
}

</style>
