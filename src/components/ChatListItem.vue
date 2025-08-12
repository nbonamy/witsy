<template>
  <div class="container">
    <div class="chat" :class="[{ selected: chat.uuid == active?.uuid }, store.config.appearance.chatList.layout]">
      <!-- <EngineLogo :engine="engine" :background="true" /> -->
      <div class="info" @dblclick="onRenameChat">
        <div class="title">{{ chat.title }}</div>
        <!-- <div class="subtitle">{{ chat.subtitle() }}</div> -->
      </div>
      <div v-if="selectMode" class="select">
        <BIconCheckCircleFill v-if="selection.includes(chat.uuid)" class="selected"/>
        <BIconCircle v-else />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { store } from '../services/store'
import EngineLogo from './EngineLogo.vue'
import Chat from '../models/chat'

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

const engine = computed(() => props.chat.engine || store.config.llm.engine)

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

    .logo {
      width: var(--sidebar-logo-size);
      height: var(--sidebar-logo-size);
      margin-right: 0.5rem;
    }

    .title {
      font-weight: 500;
      font-size: 11pt;
    }

    .subtitle {
      font-size: 9pt;
    }

    .select {
      margin-left: 1rem;
      text-align: right;
      flex: 1;
    }

    &.compact {
  
      margin: 0px;
      margin-left: 0.5rem;
      padding: 0.25rem 0.5rem;

      .logo {
        width: calc(var(--sidebar-logo-size) / 2);
        height: calc(var(--sidebar-logo-size) / 2);
      }

      .title {
        font-weight: normal;
        font-size: 10.5pt;
      }

      .subtitle {
        display: none;
      }

    }

  }

}


</style>
