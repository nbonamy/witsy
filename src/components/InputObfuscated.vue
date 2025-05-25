
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

const onKeyUp = () => {
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
}

.icon {
  background-color: var(--control-bg-color);
  cursor: pointer;
  position: absolute;
  top: calc(50% - 0.5rem);
  padding-left: 0.5rem;
  right: 0.5rem;
  z-index: 2;
}

</style>