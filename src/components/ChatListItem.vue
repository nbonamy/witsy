<template>
  <div class="container">
    <div class="chat" :class="[{ selected: !selectMode && chat.uuid == active?.uuid }, store.config.appearance.chatList.layout]">
      <input type="checkbox" class="select" :checked="selection.includes(chat.uuid)" v-if="selectMode"/>
      <div class="info" @dblclick="onRenameChat">
        <div class="title">{{ chat.title }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import Chat from '../models/chat'
import { store } from '../services/store'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: {
    type: Chat,
    required: true,
  },
  active: {
    type: Chat,
    default: null,
  },
  selectMode: {
    type: Boolean,
    default: false,
  },
  selection: {
    type: Array<String>,
    required: true,
  },
})

const emit = defineEmits(['select', 'menu']);

const onRenameChat = () => {
  emitEvent('rename-chat', props.chat)
}

</script>

<style scoped>

.container {
  
  margin: 0rem;
  padding: 0rem 0.5rem;
  cursor: pointer;

  .chat {
    
    margin: 0;
    padding: 1rem;
    display: flex;
    flex-direction: row;
    align-items: center;
    border-radius: 0.5rem;

    &.selected {
      background-color: var(--sidebar-selected-color);
    }

    .info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      min-height: 2lh;

      * {
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.5em;
      }
    }

    .title {
      font-weight: var(--font-weight-medium);
      font-size: 14.5px;
    }

    input {
      cursor: pointer;
      margin-right: 0.75rem;
      text-align: left;
      width: var(--icon-lg);
    }

    &.compact {
  
      margin: 0.125rem 0rem;
      padding: 0.375rem 1rem;

      .title {
        font-size: 14px;
      }

    }

  }

}


</style>
