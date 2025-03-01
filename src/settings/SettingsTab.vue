
<template>
  <li class="tab" @click="$emit('change', ($event.target as HTMLInputElement).checked)">
    <input type="radio" name="tabs" :id="uuidv4()" :checked="checked" />
    <label>
      <slot></slot>
      <span class="title">{{ title }}</span>
    </label>
  </li>
</template>

<script setup lang="ts">

import { v4 as uuidv4 } from 'uuid'

defineProps({
  id: String,
  title: String,
  checked: {
    type: Boolean,
    default: false
  }
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

