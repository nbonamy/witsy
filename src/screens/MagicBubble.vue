
<template>
  <div class="bubble" ref="bubble">


  </div>
</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'

const bubble = ref(null)

onMounted(() => {
  const logo: Element = document.querySelector('#logo')!.cloneNode() as Element
  logo.removeAttribute('id')
  logo.removeAttribute('style')
  bubble.value.appendChild(logo)
})

</script>
