
<template>
  <div class="wrapper">
    <input :type="type" :name="name" v-model="value" @keyup="onKeyUp" @blur="$emit('blur')"/>
    <component :is="icon" class="icon" @click="onToggleView" />
  </div>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'

defineProps({
  name: {
    type: String,
    default: ''
  }
})

const type = ref('password')

const value = defineModel()

const emit = defineEmits(['blur', 'change']);

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

const onKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    return false
  }
  emit('change')
}

</script>


<style scoped>

.wrapper {
  flex: 1;
  position: relative;
}

.form .form-field .wrapper input {
  width: 100%;
  box-sizing: border-box;
  padding-left: 6px;
  padding-right: 26px;
  font-family: monospace;
  font-size: 0.9em;
}

.icon {
  background-color: var(--control-bg-color);
  cursor: pointer;
  position: absolute;
  top: calc(50% - 0.5rem + 1px);
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  right: 1px;
  z-index: 2;
}

</style>