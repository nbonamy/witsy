import { BrainIcon, FolderIcon, SettingsIcon, XIcon } from 'lucide-vue-next'
import type { Expert } from 'types/index'
import type { MenuItem } from 'types/menu'
import { computed } from 'vue'
import { categoryI18n, expertI18n, t } from '../services/i18n'
import { store } from '../services/store'

export interface UseExpertsMenuOptions {
  emit: (event: any, ...args: any[]) => void
  footerMode?: 'manage' | 'clear' | 'none'
}

export function useExpertsMenu(options: UseExpertsMenuOptions) {
  const { emit, footerMode = 'none' } = options

  // Computed properties
  const expertsMenuItems = computed(() => {
    return store.experts
      .filter((expert: Expert) => expert.state === 'enabled')
      .map(expert => ({
        id: expert.id,
        name: expert.name || expertI18n(expert, 'name'),
        prompt: expert.prompt || expertI18n(expert, 'prompt'),
        categoryId: expert.categoryId
      }))
  })

  const categoriesWithExperts = computed(() => {
    // Get categories that have at least one enabled expert
    const catIds = new Set<string>()
    expertsMenuItems.value.forEach(exp => {
      if (exp.categoryId) {
        catIds.add(exp.categoryId)
      }
    })

    // Get category objects and add labels
    const categories = store.expertCategories
      .filter(c => c.state === 'enabled' && catIds.has(c.id))
      .map(c => ({
        id: c.id,
        icon: c.icon,
        name: categoryI18n(c, 'name')
      }))

    // Sort alphabetically by name
    return categories.sort((a, b) => a.name.localeCompare(b.name))
  })

  const expertsByCategory = computed(() => {
    const grouped: Record<string, typeof expertsMenuItems.value> = {}

    expertsMenuItems.value.forEach(exp => {
      const catId = exp.categoryId || 'uncategorized'
      if (!grouped[catId]) grouped[catId] = []
      grouped[catId].push(exp)
    })

    // Keep experts in original order (from store.experts)
    return grouped
  })

  const uncategorizedExperts = computed(() => {
    return expertsMenuItems.value.filter(exp => !exp.categoryId)
  })

  // Event handlers
  const handleExpertClick = (expertId: string) => {
    if (expertId === 'none') {
      emit('expertSelected', null)
    } else {
      emit('expertSelected', expertId)
    }
  }

  const handleManageExperts = () => {
    emit('manageExperts')
  }

  // Generate menu items
  const menuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = []

    // Add categorized experts
    categoriesWithExperts.value.forEach((cat: any) => {
      const categoryExperts = expertsByCategory.value[cat.id] || []
      if (categoryExperts.length > 0) {
        items.push({
          id: `expert-cat-${cat.id}`,
          label: cat.name,
          icon: FolderIcon,
          submenu: categoryExperts.map((exp: any) => ({
            id: `expert-${exp.id}`,
            label: exp.name,
            icon: BrainIcon,
            onClick: () => handleExpertClick(exp.id),
          })),
        })
      }
    })

    // Add uncategorized experts
    uncategorizedExperts.value.forEach((exp: any) => {
      items.push({
        id: `expert-${exp.id}`,
        label: exp.name,
        icon: BrainIcon,
        onClick: () => handleExpertClick(exp.id),
      })
    })

    return items
  })

  // Footer items for the experts menu
  const footerItems = computed<MenuItem[]>(() => {
    if (footerMode === 'none') {
      return []
    }

    if (footerMode === 'clear') {
      return [
        {
          id: 'experts-clear',
          label: t('common.clear'),
          icon: XIcon,
          onClick: () => handleExpertClick('none'),
        },
      ]
    }

    // Default: 'manage'
    return [
      {
        id: 'experts-manage',
        label: t('prompt.menu.experts.manage'),
        icon: SettingsIcon,
        onClick: handleManageExperts,
      },
    ]
  })

  return {
    // Menu structure
    menuItems,
    footerItems,
    showFilter: true,

    // Computed data
    expertsMenuItems,
    categoriesWithExperts,
    expertsByCategory,
    uncategorizedExperts,

    // Event handlers
    handleExpertClick,
    handleManageExperts,
  }
}
