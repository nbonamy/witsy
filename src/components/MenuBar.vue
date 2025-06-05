
<template>

  <div class="menubar-wrapper">

    <div class="corner"></div>

    <div class="app-menu" @click.prevent="onAppMenu">
      <IconMenu />
    </div>

    <div class="menu">

      <MenuBarItem class="chat" action="chat" :active="mode === 'chat'" @click="emit('change', 'chat')">
        <BIconChatSquareQuote />
        <span>{{ t('common.chat') }}</span>
      </MenuBarItem>

      <MenuBarItem action="studio" :active="mode === 'studio'" @click="emit('change', 'studio')">
        <BIconPalette />
        <span>{{ t('designStudio.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="scratchpad" :active="mode === 'scratchpad'" @click="emit('change', 'scratchpad')">
        <BIconJournalText />
        <span>{{ t('scratchpad.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="dictation" :active="mode === 'dictation'" @click="emit('change', 'dictation')">
        <BIconMic />
        <span>{{ t('transcribe.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="voice-mode" :active="mode === 'voice-mode'" @click="emit('change', 'voice-mode')">
        <BIconChatSquareDots />
        <span>{{ t('realtimeChat.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="docrepo" :active="mode === 'docrepo'" @click="emit('change', 'docrepo')">
        <BIconDatabase />
        <span>{{ t('docRepo.repositories.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="computer-use" :active="mode === 'computer-use'" @click="emit('change', 'computer-use')" v-if="hasComputerUse">
        <BIconMouse2 />
        <span>{{ t('computerUse.title') }}</span>
      </MenuBarItem>

      <div class="push"></div>

      <MenuBarItem action="debug" :active="mode === 'debug'" @click="emit('change', 'debug')">
        <BIconActivity />
        <span>{{ t('debugConsole.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="settings" :active="mode === 'settings'" @click="emit('change', 'settings')">
        <BIconGear />
        <span>{{ t('common.settings') }}</span>
      </MenuBarItem>

    </div>

  </div>

</template>


<script setup lang="ts">

import { onMounted, ref, computed, watch } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import MenuBarItem from './MenuBarItem.vue'
import IconMenu from './IconMenu.vue'
import useAppearanceTheme from '../composables/appearance_theme' 
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'

export type MenuBarMode = 'current' |
  'chat' | 'studio' | 'scratchpad' | 'dictation' | 'voice-mode' |
  'computer-use' | 'docrepo' | 'debug' | 'settings'

const hasComputerUse = computed(() => {
  return store.config.engines.anthropic.apiKey && store.config.engines.anthropic.models?.chat?.find(m => m.id === 'computer-use')
})

const emit = defineEmits(['change'])

const mode = ref('chat')

const props = defineProps({
  mode: {
    type: String,
    default: 'chat'
  }
})

onMounted(() => {
  watch(() => props.mode, () => {
    mode.value = props.mode
  })
})

const onAppMenu = (event: Event) => {

  const appMenu = document.querySelector('.app-menu') as HTMLElement;
  const rect = appMenu.getBoundingClientRect();


  ContextMenu.showContextMenu({
    x: rect.x + rect.width,
    y: rect.y + 8,
    theme: useAppearanceTheme().getTheme() === 'dark' ? 'flat dark' : 'flat',
    preserveIconWidth: false,
    items: [
      { 
        label: t('menu.file.title'),
        children: [
          { label: t('menu.app.about'), onClick: () => window.api.showAbout() },
          { label: t('menu.app.checkForUpdates'), onClick: () => window.api.update.check() },
          { label: t('menu.file.closeWindow'), divided: 'up', onClick: () => window.api.closeMainWindow() },
        ]
      },
      { 
        label: t('menu.help.title'),
        children: [
          { label: t('menu.view.debug'), divided: 'down', onClick: () => window.api.debug.showConsole() },
          { label: t('menu.help.goToDataFolder'), onClick: () => window.api.debug.openFolder('userData') },
          { label: t('menu.help.goToLogFolder'), onClick: () => window.api.debug.openFolder('logs') },
        ]
      },
    ]
  })
}

</script>

<style scoped>

.menubar-wrapper {
  
  --menubar-width: 3rem;

  display: flex;
  flex-direction: column;

  .corner {
    background-color: var(--window-decoration-color);
    border-bottom: 1px solid var(--toolbar-border-color);
    width: var(--menubar-width);
    height: var(--window-toolbar-height);
  }

  .app-menu {
    height: 1rem;
    background-color: var(--menubar-bg-color);
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }

  .menu {
    
    flex: 1;
    padding-top: 1rem;
    padding-bottom: 0.5rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    background-color: var(--menubar-bg-color);
    gap: 0.65rem;

    border-right: 1px solid var(--menubar-border-color);

    .push {
      flex: 1;
    }

    .chat svg {
      position: relative;
      top: 2px;
    }

  }

}

.macos .menubar-wrapper .app-menu {
  display: none;
}

</style>
