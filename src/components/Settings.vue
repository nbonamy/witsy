
<template>
  <dialog>
    <form method="dialog">
      <header>Settings</header>
      <main>
        <div class="group">
          <label>OpenAI API Key</label>
          <input type="text" v-model="openAI_apiKey" />
        </div>
        <div class="group">
          <label>OpenAI API Model</label>
          <input type="text" v-model="openAI_model" />
        </div>
      </main>
      <footer>
        <button @click="onSubmit" class="default">OK</button>
        <button class="destructive">Cancel</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'

const openAI_apiKey = ref(store.config.openAI?.apiKey || '')
const openAI_model = ref(store.config.openAI?.model || '')

const onSubmit = () => {
  console.log(openAI_apiKey.value)
  store.config.openAI.apiKey = openAI_apiKey.value
  store.config.openAI.model = openAI_model.value
  store.save()
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
