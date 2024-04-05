
<template>
  <img :src="logo" class="logo" :class="[ engine, background ? 'bg' : '' ]" />
</template>

<script setup>

import { computed } from 'vue'
import logoOpenai from '../../assets/openai.svg'
import logoOllama from '../../assets/ollama.svg'

const logos = {
  openai: logoOpenai,
  ollama: logoOllama
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
