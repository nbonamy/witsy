<template>
  <div class="container">
    <div class="chat" :class="[{ selected: !selectMode && chat.uuid == active?.uuid }, store.config.appearance.chatList.layout]">
      <input type="checkbox" class="select" :checked="selection.includes(chat.uuid)" v-if="selectMode"/>
      <div class="info" @dblclick="onRenameChat">
        <div class="title">{{ chat.title }}</div>
      </div>
      <div class="generating-indicator" v-if="generating">
        <Spinner />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { inject } from 'vue'
import Chat from '@models/chat'
import Spinner from './Spinner.vue'
import { store } from '@services/store'
import type { ChatCallbacks } from '@screens/Chat.vue'

const chatCallbacks = inject<ChatCallbacks>('chat-callbacks')

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
  generating: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'menu']);

const onRenameChat = () => {
  if (props.selectMode) return
  chatCallbacks?.onRenameChat(props.chat)
}

</script>

<style scoped>

.container {
  
  cursor: pointer;

  .chat {
    
    margin: 0;
    padding: 0.75rem;
    padding-left: 1rem;
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
      margin: 0;
      padding: 0.5rem;
      padding-left: 0.75rem;
      max-height: 1lh;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      .title {
        font-size: 14px;
      }

    }

    .generating-indicator {
      margin-left: auto;
      padding-right: 0.25rem;
      display: flex;
      align-items: center;
    }

  }

}


</style>
