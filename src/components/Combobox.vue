
<template>
  <div v-if="showHelp" class="help">{{ t('common.comboBox.help') }}</div>
  <div class="wrapper" :class="{ focused: focus }">
    <select v-model="selected" @change="onSelect">
      <option v-for="item in items" :key="item.id" :value="item.id">{{ item.name }}</option>
    </select>
    <input type="text" :name="name" v-model="value" :placeholder="placeholder" @change="onChange" @focus="onFocus" @blur="onBlur" />
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { t } from '../services/i18n'

export type ComboBoxItem = {
  id: string
  name: string
}

const emit = defineEmits(['blur', 'change']);

const focus = ref(false)
const value = defineModel()
const selected = ref(null)

defineProps({
  items: { type: Array<ComboBoxItem>, required: true },
  placeholder: { type: String, required: false },
  showHelp: { type: Boolean, default: true },
  name: { type: String, default: '' },
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

const onSelect = (event: Event) => {
  value.value = (event.target as HTMLSelectElement).value
  selected.value = null
  emit('change')
}

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

.help {
  opacity: 0.6;
  margin-top: 2px;
  margin-bottom: 6px;
}

form .group .wrapper {
  position: relative;

  &.focused select {
    outline: 2px solid #83aaf2;
  }

  input {
    position: absolute;
    left: 0;
    background-color: transparent;
    border: none;
    width: calc(100% - 28px);
    padding-left: 8px;
    padding-top: 5.5px;

    &:focus {
      outline: none !important;
    }
  }
}

</style>
