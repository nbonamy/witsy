
<template>
  <div class="wrapper" :class="{ focused: focus }">
    <select v-model="selected" @change="onSelect">
      <option v-for="item in items" :key="item.id" :value="item.id">{{ item.name }}</option>
    </select>
    <input type="text" v-model="value" :placeholder="placeholder" @change="onChange" @focus="onFocus" @blur="onBlur" />
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'

export type ComboBoxItem = {
  id: string
  name: string
}

const emit = defineEmits(['blur', 'change']);

const focus = ref(false)
const value = defineModel()
const selected = ref(null)

const props = defineProps({
  items: { type: Array<ComboBoxItem>, required: true },
  placeholder: { type: String, required: false }
})

const onFocus = () => {
  focus.value = true
}

const onBlur = () => {
  focus.value = false
  emit('blur')
}

const onChange = () => {
  emit('change')
}

const onSelect = () => {
  value.value = (event.target as HTMLSelectElement).value
  selected.value = null
  emit('change')
}

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

form .group .wrapper {
  position: relative;

  &.focused select {
    outline: 2px solid #83aaf2;
  }

  input {
    position: absolute;
    top: 0;
    left: 0;
    background-color: transparent;
    border: none;
    width: calc(100% - 28px) ;

    &:focus {
      outline: none !important;
    }
  }
}

</style>
