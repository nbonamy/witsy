<template>
  <div class="prompt">
    <BIconFileEarmarkPlus class="icon upload" @click="upload"/>
    <div class="input">
      <textarea @keydown.enter="onEnter" @keyup="onKeyUp" v-model="prompt" ref="input"/>
      <BIconArrowUpSquareFill class="icon" @click="sendPrompt"/>
    </div>
  </div>
</template>

<script setup>

import { ref, onMounted } from 'vue'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const prompt = ref('')
const input = ref(null)

onMounted(() => {
  autoGrow(input.value)
})

const sendPrompt = () => {
  emitEvent('sendPrompt', prompt.value)
  prompt.value = ''
}

const onKeyUp = (event) => {
  autoGrow(event.target)
}

const onEnter = (event) => {
  if (event.shiftKey) {

  } else {
    sendPrompt()
    event.preventDefault()
    event.stopPropagation()
    return false
  }
}

const autoGrow = (element) => {
  element.style.height = '5px'
  element.style.height = (element.scrollHeight) + 'px'
}

const upload = () => {
  console.log('Upload')
}

</script>

<style scoped>

.prompt {
  padding: 8px 12px;
  display: flex;
}

.icon {
  cursor: pointer;
  color: #5b5a59;
  height: 16pt !important;
  width: 16pt !important;
}

.upload {
  position: relative;
  top: 6px;
}

.input {
  border: 1px solid #bbbbbb;
  border-radius: 8px;
  margin: 0px 8px;
  padding: 4px 12px 1px;
  flex: 1;
  display: flex;
}

.input textarea {
  border: none;
  resize: none;
  overflow: hidden;
  font-size: 11.5pt;
  flex: 1;
} 

.input textarea:focus {
  outline: none;
  flex: 1;
}

.input .icon {
  margin-left: 8px;
}

</style>
