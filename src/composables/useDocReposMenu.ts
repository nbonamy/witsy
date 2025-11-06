import { LightbulbIcon, SettingsIcon, XIcon } from 'lucide-vue-next'
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import type { MenuItem } from '../types/menu'
import type { DocumentBase } from '../types/rag'

export interface UseDocReposMenuOptions {
  emit: (event: any, ...args: any[]) => void
  footerMode?: 'manage' | 'clear' | 'none'
}

export function useDocReposMenu(options: UseDocReposMenuOptions) {
  const { emit, footerMode = 'none' } = options

  // Reactive data
  const docRepos = ref<DocumentBase[]>([])

  // Load document repositories
  const loadDocRepos = () => {
    try {
      docRepos.value = window.api?.docrepo?.list(store.config.workspaceId) || []
    } catch (error) {
      console.error('Failed to load document repositories:', error)
      docRepos.value = []
    }
  }

  // Load on mount and listen for changes
  onMounted(() => {
    loadDocRepos()
    window.api.on('docrepo-modified', loadDocRepos)
  })

  // Clean up listener
  onBeforeUnmount(() => {
    window.api.off('docrepo-modified', loadDocRepos)
  })

  // Event handlers
  const handleDocRepoClick = (docRepoUuid: string) => {
    emit('docRepoSelected', docRepoUuid)
  }

  const handleManageDocRepos = () => {
    emit('manageDocRepo')
  }

  // Generate menu items
  const menuItems = computed<MenuItem[]>(() => {
    return docRepos.value.map(docRepo => ({
      id: `docrepo-${docRepo.uuid}`,
      label: docRepo.name,
      icon: LightbulbIcon,
      onClick: () => handleDocRepoClick(docRepo.uuid),
    }))
  })

  // Footer items for the docrepos menu
  const footerItems = computed<MenuItem[]>(() => {
    if (footerMode === 'none') {
      return []
    }

    if (footerMode === 'clear') {
      return [
        {
          id: 'docrepos-clear',
          label: t('common.clear'),
          icon: XIcon,
          onClick: () => handleDocRepoClick(null as any), // null will be handled by parent
        },
      ]
    }

    // Default: 'manage'
    return [
      {
        id: 'docrepos-manage',
        label: t('prompt.menu.docRepos.manage'),
        icon: SettingsIcon,
        onClick: handleManageDocRepos,
      },
    ]
  })

  return {
    menuItems,
    footerItems,
    showFilter: true,
    docRepos,
  }
}
