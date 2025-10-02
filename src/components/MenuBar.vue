
<template>

  <div class="menubar-wrapper">

    <div class="menu">

      <div class="app-menu" @click.prevent="onAppMenu">
        <IconMenu />
      </div>

      <MenuBarItem class="chat" action="chat" :active="mode === 'chat'" @click="emit('new-chat')">
        <IconChat />
        <span>{{ t('common.chat') }}</span>
      </MenuBarItem>

      <MenuBarItem action="studio" :active="mode === 'studio'" @click="emit('change', 'studio')" v-if="store.isFeatureEnabled('studio') && !isFeatureHidden('studio')">
        <PaletteIcon />
        <span>{{ t('designStudio.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="scratchpad" :active="mode === 'scratchpad'" @click="emit('change', 'scratchpad')" v-if="store.isFeatureEnabled('scratchpad') && !isFeatureHidden('scratchpad')">
        <FileTextIcon />
        <span>{{ t('scratchpad.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="dictation" :active="mode === 'dictation'" @click="emit('change', 'dictation')" v-if="store.isFeatureEnabled('dictation') && !isFeatureHidden('dictation')">
        <MicIcon />
        <span>{{ t('transcribe.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="voice-mode" :active="mode === 'voice-mode'" @click="emit('change', 'voice-mode')" v-if="store.isFeatureEnabled('voiceMode') && !isFeatureHidden('voiceMode')">
        <HeadsetIcon />
        <span>{{ t('realtimeChat.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="computer-use" :active="mode === 'computer-use'" @click="emit('change', 'computer-use')" v-if="hasComputerUse">
        <MouseIcon />
        <span>{{ t('computerUse.title') }}</span>
      </MenuBarItem>

      <!-- Dynamic WebApp items -->
      <MenuBarItem
        v-for="webapp in enabledWebapps"
        :key="webapp.id"
        :action="`webapp-${webapp.id}`"
        :active="mode === `webapp-${webapp.id}`"
        @click="emit('change', `webapp-${webapp.id}`)"
      >
        <img v-if="webapp.icon?.startsWith('http')" :src="webapp.icon" class="webapp-favicon" :class="{ 'grayscale': !webapp.preserveColors }" alt="Webapp icon" />
        <component v-else :is="getWebappIcon(webapp.icon)" />
        <span>{{ webapp.name }}</span>
      </MenuBarItem>

      <div class="flex-push"></div>

      <MenuBarItem action="agents" :active="mode === 'agents'" @click="emit('change', 'agents')" v-if="store.isFeatureEnabled('agents')">
        <IconAgent />
        <span>{{ t('agent.forge.title') }}</span>
      </MenuBarItem>

      <MenuBarItem action="mcp" :active="mode === 'mcp'" @click="emit('change', 'mcp')" v-if="hasMcp">
        <PlugIcon />
        <span>{{ t('mcp.mcpServers') }}</span>
      </MenuBarItem>

      <MenuBarItem action="docrepo" :active="mode === 'docrepos'" @click="emit('change', 'docrepos')" v-if="store.isFeatureEnabled('docrepos')">
        <LightbulbIcon />
        <span>{{ t('docRepo.list.title') }}</span>
      </MenuBarItem>

      <!-- <MenuBarItem action="experts" :active="mode === 'experts'" @click="emit('change', 'experts')" v-if="store.isFeatureEnabled('experts')">
        <BrainIcon />
        <span>{{ t('docRepo.list.title') }}</span>
      </MenuBarItem> -->

      <MenuBarItem action="settings" :active="mode === 'settings'" @click="emit('change', 'settings')">
        <SettingsIcon />
        <span>{{ t('common.settings') }}</span>
      </MenuBarItem>

    </div>

  </div>

</template>


<script setup lang="ts">

import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import { FileTextIcon, HeadsetIcon, LightbulbIcon, MicIcon, MouseIcon, PaletteIcon, PlugIcon, SettingsIcon, icons } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import IconAgent from '../../assets/agent.svg?component'
import IconChat from '../../assets/message-circle-3.svg?component'
import useAppearanceTheme from '../composables/appearance_theme'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { MainWindowMode } from '../types/index'
import IconMenu from './IconMenu.vue'
import MenuBarItem from './MenuBarItem.vue'

export type MenuBarMode = MainWindowMode | 'scratchpad' | 'computer-use' | 'debug'

const isFeatureHidden = (featureKey: string): boolean => {
  return store.workspace?.hiddenFeatures?.includes(featureKey) || false
}

const hasComputerUse = computed(() => {
  const hasConfig = store.isFeatureEnabled('voiceMode') && store.config.engines.anthropic.apiKey && store.config.engines.anthropic.models?.chat?.find(m => m.id === 'computer-use')
  return hasConfig && !isFeatureHidden('computerUse')
})

const hasMcp = computed(() => {
  return window.api.mcp.isAvailable()
})

const enabledWebapps = computed(() => {
  if (!store.isFeatureEnabled('webapps') || !store.workspace) {
    return []
  }
  return store.workspace.webapps?.filter(w => w.enabled) || []
})

const getWebappIcon = (iconName: string) => {
  return (icons as any)[iconName] || icons.Globe
}

const emit = defineEmits(['change', 'new-chat', 'run-onboarding'])

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
          { label: `${t('menu.file.newChat')} (Ctrl+N)`, divided: 'down', onClick: () => emit('new-chat') },
          { label: t('menu.app.about'), onClick: () => window.api.app.showAbout() },
          ...(window.api.update.isAvailable() ?
            [{ label: t('tray.menu.installUpdate'), onClick: () => window.api.update.apply() }] :
            [{ label: t('menu.app.checkForUpdates'), onClick: () => window.api.update.check() }]
          ),
          { label: t('menu.file.backupExport'), divided: 'up', onClick: () => setTimeout(() => window.api.backup.export(), 0) },
          { label: t('menu.file.backupImport'), onClick: () => setTimeout(() => window.api.backup.import(), 0) },
          { label: t('menu.file.import.title'), divided: 'up', children: [
            { label: t('menu.file.import.openai'), onClick: () => setTimeout(() => window.api.import.openai(store.config.workspaceId), 0) }
          ] },
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

    -webkit-app-region: no-drag;

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
  
  display: flex;
  flex-direction: column;
  background-color: var(--menubar-bg-color);
  flex: 0 0 var(--window-menubar-width);
  
  .app-menu {
    cursor: pointer;
    padding: 0.5rem;
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
    gap: 0.75rem;

    border-right: 1px solid var(--sidebar-border-color);

    -webkit-app-region: drag;
    > * {
      -webkit-app-region: no-drag;
    }

    .chat svg {
      position: relative;
      top: 2px;
    }

    .webapp-favicon {
      width: var(--icon-lg);
      height: var(--icon-lg);
      &.grayscale {
        filter: grayscale() contrast(0) brightness(0);
        opacity: 0.7;
      }
    }

  }

}

.macos .menubar-wrapper .app-menu {
  display: none;
}

</style>
