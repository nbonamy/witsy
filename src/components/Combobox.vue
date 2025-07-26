
<template>
  <div v-if="showHelp" class="help">{{ t('common.comboBox.help') }}</div>
  <div class="control-group">
    <div class="wrapper" :class="{ focused: focused, opened: opened }">
      <select v-model="selected" :disabled="disabled" @mousedown="onOpen" @change="onSelect">
        <option v-for="item in items" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
      <input class="combobox-input" type="text" :name="name" v-model="value" :placeholder="placeholder" :disabled="disabled" :required="required" @click.stop @change="onChange" @focus="onFocus" @blur="onBlur" />
    </div>
    <slot></slot>
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

const focused = ref(false)
const opened = ref(false)
const value = defineModel()
const selected = ref(null)

defineProps({
  items: { type: Array<ComboBoxItem>, required: true },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, required: false },
  showHelp: { type: Boolean, default: true },
  name: { type: String, default: '' },
})

const onOpen = () => {
  selected.value = value.value
  opened.value = true
}

const onFocus = () => {
  focused.value = true
}

const onBlur = () => {
  focused.value = false
  emit('blur')
}

const onChange = () => {
  emit('change')
}

const onSelect = (event: Event) => {
  opened.value = false
  value.value = (event.target as HTMLSelectElement).value
  selected.value = null
  emit('change')
}

</script>


<style scoped>

.help {
  opacity: 0.6;
  margin-top: 2px;
  margin-bottom: 6px;
}

.form .form-field .wrapper {
  position: relative;
  width: 100%;

  &.focused select {
    outline: 2px solid #83aaf2;
  }

  .combobox-input {
    position: absolute;
    left: 0;
    background-color: transparent;
    border: none;
    width: calc(100% - 28px);
    margin: 0 !important;
    padding-left: 8px !important;
    padding-top: 5.5px !important;

    &:focus {
      outline: none !important;
    }
  }

  &.opened .combobox-input {
    visibility: hidden;
  }
}

</style>
