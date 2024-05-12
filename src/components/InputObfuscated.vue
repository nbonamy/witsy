
<template>
  <div class="wrapper">
    <input :type="type" v-model="value" @keyup="onKeyUp" />
    <component :is="icon" class="icon" @click="onToggleView" />
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'

const type = ref('password')

const value = defineModel()

const emit = defineEmits(['change']);

const icon = computed(() => {
  return type.value === 'password' ? 'BIconEye' : 'BIconEyeSlash'
})

const onToggleView = () => {
  if (type.value === 'password') {
    type.value = 'text'
  } else {
    type.value = 'password'
  }
}

const onKeyUp = (event) => {
  emit('change')
}

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

.wrapper {
  flex: 1;
  position: relative;
}

form .group .wrapper input {
  width: 100%;
  box-sizing: border-box;
  padding-left: 6px;
  padding-right: 26px;
  font-family: monospace;
  font-size: calc(var(--form-font-size) - 0.5px) !important;
}

.icon {
  cursor: pointer;
  position: absolute;
  top: 4px;
  right: 6px;
}

</style>