import { t } from '@services/i18n'
import { store } from '@services/store'
import { LightbulbOffIcon, SettingsIcon, XIcon } from 'lucide-vue-next'
import type { MenuItem } from 'types/menu'
import type { DocumentBase } from 'types/rag'
import { computed, onBeforeUnmount, onMounted, ref, Ref } from 'vue'
import useIpcListener from './ipc_listener'

export interface UseDocReposMenuOptions {
  emit: (event: any, ...args: any[]) => void
  footerMode?: 'manage' | 'clear' | 'none'
  multiSelect?: boolean
  selectedDocRepos?: Ref<string[]>
}

export function useDocReposMenu(options: UseDocReposMenuOptions) {
  const { emit, footerMode = 'none', multiSelect = false, selectedDocRepos } = options
  const { onIpcEvent } = useIpcListener()

  // Reactive data
  const docRepos = ref<DocumentBase[]>([])
  const internalSelection = ref<string[]>([])

  // Use provided selection or internal
  const currentSelection = computed(() => selectedDocRepos?.value ?? internalSelection.value)

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
    onIpcEvent('docrepo-modified', loadDocRepos)
  })

  // Clean up listener
  onBeforeUnmount(() => {
    // IPC listeners cleaned up by composable
  })

  // Toggle selection for multi-select mode
  const toggleDocRepo = (uuid: string) => {
    const current = [...currentSelection.value]
    const index = current.indexOf(uuid)
    if (index === -1) {
      current.push(uuid)
    } else {
      current.splice(index, 1)
    }
    if (selectedDocRepos) {
      selectedDocRepos.value = current
    } else {
      internalSelection.value = current
    }
    emit('docReposChanged', current)
  }

  // Event handlers
  const handleDocRepoClick = (docRepoUuid: string) => {
    if (multiSelect) {
      toggleDocRepo(docRepoUuid)
    } else {
      emit('docRepoSelected', docRepoUuid)
    }
  }

  const handleManageDocRepos = () => {
    emit('manageDocRepo')
  }

  const handleSelectAll = () => {
    const allUuids = docRepos.value.map(r => r.uuid)
    if (selectedDocRepos) {
      selectedDocRepos.value = allUuids
    } else {
      internalSelection.value = allUuids
    }
    emit('docReposChanged', allUuids)
  }

  const handleClearAll = () => {
    if (selectedDocRepos) {
      selectedDocRepos.value = []
    } else {
      internalSelection.value = []
    }
    emit('docReposChanged', [])
  }

  // Generate menu items
  const menuItems = computed<MenuItem[]>(() => {

    if (docRepos.value.length === 0) {
      return [
        {
          id: 'no-docrepos',
          label: t('prompt.menu.docRepos.noDocRepos'),
          icon: LightbulbOffIcon,
          onClick: handleManageDocRepos,
          disabled: true,
        },
      ]
    }

    return docRepos.value.map(docRepo => {
      const isSelected = currentSelection.value.includes(docRepo.uuid)
      return {
        id: `docrepo-${docRepo.uuid}`,
        label: docRepo.name,
        checked: multiSelect ? isSelected : undefined,
        type: multiSelect ? 'checkbox' as const : undefined,
        onClick: () => handleDocRepoClick(docRepo.uuid),
      }
    })
  })

  // Footer items for the docrepos menu
  const footerItems = computed<MenuItem[]>(() => {

    if (docRepos.value.length > 0) {
    
      if (multiSelect) {
        // Multi-select mode: Select All / Clear All buttons
        return [
          {
            id: 'docrepos-select-all',
            label: t('common.selectAll'),
            onClick: handleSelectAll,
          },
          {
            id: 'docrepos-clear-all',
            label: t('common.unselectAll'),
            onClick: handleClearAll,
          },
        ]
      }

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
    currentSelection,
    toggleDocRepo,
  }
}
