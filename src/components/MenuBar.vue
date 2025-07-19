
<template>

  <div class="menubar-wrapper">

    <div class="corner">
      <div class="app-menu" @click.prevent="onAppMenu">
        <IconMenu />
      </div>
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

      <MenuBarItem action="agents" :active="mode === 'agents'" @click="emit('change', 'agents')" v-if="store.config.features?.agents">
        <BIconRobot />
        <span>{{ t('agent.forge.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="voice-mode" :active="mode === 'voice-mode'" @click="emit('change', 'voice-mode')">
        <BIconChatSquareDots />
        <span>{{ t('realtimeChat.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="docrepo" :active="mode === 'docrepo'" @click="emit('change', 'docrepo')">
        <BIconDatabase />
        <span>{{ t('docRepo.list.title') }}</span>
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

import { MainWindowMode } from '../types/index'
import { onMounted, ref, computed, watch } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import MenuBarItem from './MenuBarItem.vue'
import IconMenu from './IconMenu.vue'
import useAppearanceTheme from '../composables/appearance_theme' 
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'

export type MenuBarMode = MainWindowMode | 'scratchpad' | 'computer-use' | 'debug' | 'agents'

const hasComputerUse = computed(() => {
  return store.config.engines.anthropic.apiKey && store.config.engines.anthropic.models?.chat?.find(m => m.id === 'computer-use')
})

const emit = defineEmits(['change', 'run-onboarding'])

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
    theme: useAppearanceTheme().isDark ? 'default dark' : 'default',
    preserveIconWidth: false,
    items: [
      { 
        label: t('menu.file.title'),
        children: [
          { label: t('menu.app.about'), onClick: () => window.api.app.showAbout() },
          ...(window.api.update.isAvailable() ?
            [{ label: t('tray.menu.installUpdate'), onClick: () => window.api.update.apply() }] :
            [{ label: t('menu.app.checkForUpdates'), onClick: () => window.api.update.check() }]
          ),
          { label: t('menu.file.backupExport'), divided: 'up', onClick: () => window.api.backup.export() },
          { label: t('menu.file.backupImport'), onClick: () => window.api.backup.import() },
          { label: t('menu.file.closeWindow'), divided: 'up', onClick: () => window.api.main.close() },
        ]
      },
      { 
        label: t('menu.help.title'),
        children: [
          { label: t('menu.help.runOnboarding'), onClick: () => emit('run-onboarding') },
          { label: t('menu.view.debug'), divided: 'up', onClick: () => window.api.debug.showConsole() },
          { label: t('menu.help.goToDataFolder'), divided: 'up', onClick: () => window.api.debug.openFolder('userData') },
          { label: t('menu.help.goToLogFolder'), onClick: () => window.api.debug.openFolder('logs') },
        ]
      },
    ]
  })
}

</script>

<style>

:root {
  --mx-menu-backgroud-radius: 0.5rem;
}

.mx-context-menu {
  
  padding: 0.375rem 0;
  border: 0.5px solid color-mix(in srgb, var(--control-border-color), transparent 25%);

  .mx-context-menu-item {

    .label {
      color: var(--text-color);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
    }

    .mx-right-arrow {
      height: 10px;
    }
  }

  .mx-context-menu-item-sperator {
    background-color: transparent;
  }
}

body[data-tint=blue] .mx-context-menu {
  background-color: var(--background-color);
  border-color: color-mix(in srgb, var(--control-border-color), transparent 25%);

  .mx-context-menu-item {
    &.open, &:hover {
      background-color: color-mix(in srgb, var(--background-color) 50%, var(--control-button-active-bg-color) 50%);
    }
  }
}


</style>
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
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .app-menu {
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
