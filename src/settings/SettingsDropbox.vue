
<template>
  <div>
    <div class="description">
      This plugin synchronizes your chat history across devices using Dropbox.
    </div>
    <div class="group" v-if="linked">
      <label>Account</label>
      <button @click.prevent="unlink">Unlink</button>
    </div>
    <div class="group" v-else>
      <ol>
        <li>Click <a :href="oauthUrl" target="_blank">here</a> to get an access code for Witsy to use Dropbox</li>
        <li>Paste the access code below:<br/>
          <input type="text" v-model="accessCode" />
        </li>
        <li><button @click.prevent="link">Link your account</button></li>
      </ol>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import Dialog from '../composables/dialog'

const linked = ref(false)
const oauthUrl = ref('')
const accessCode = ref('')

const load = () => {
  linked.value = (store.config.dropbox.accessToken != null)
  oauthUrl.value = window.api.dropbox.getAuthenticationUrl()
  accessCode.value = ''
}

const unlink = () => {
  store.config.dropbox.accessToken = null
  // store.config.dropbox.accessTokenExpiresAt = null
  // store.config.dropbox.refreshToken = null
  store.saveSettings()
  load()
}

const link = async () => {
  const success = window.api.dropbox.authenticateWithCode(accessCode.value)
  if (success) {
    linked.value = true
    accessCode.value = ''
  } else {
    Dialog.alert('Failed to link your account. Try again.')
    accessCode.value = ''
  }
}

const save = () => {
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
</style>

<style scoped>
input[type="text"] {
  margin-top: 4px;
}
</style>