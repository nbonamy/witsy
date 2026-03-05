import { SettingsIcon, XIcon, ZapIcon } from 'lucide-vue-next'
import type { MenuItem } from 'types/menu'
import { computed } from 'vue'
import { t } from '@services/i18n'
import { store } from '@services/store'

export interface UseSkillsMenuOptions {
  emit: (event: any, ...args: any[]) => void
  footerMode?: 'manage' | 'clear' | 'none'
}

export function useSkillsMenu(options: UseSkillsMenuOptions) {
  const { emit, footerMode = 'none' } = options

  const skillsMenuItems = computed(() => {
    try {
      return window.api.skills
        .list(store.config.workspaceId)
        .map(skill => ({
          id: skill.id,
          name: skill.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  })

  const handleSkillClick = (skillId: string) => {
    if (skillId === 'none') {
      emit('skillSelected', null)
    } else {
      emit('skillSelected', skillId)
    }
  }

  const handleManageSkills = () => {
    emit('manageSkills')
  }

  const menuItems = computed<MenuItem[]>(() => {
    return skillsMenuItems.value.map(skill => ({
      id: `skill-${skill.id}`,
      label: skill.name,
      icon: ZapIcon,
      onClick: () => handleSkillClick(skill.id),
    }))
  })

  const footerItems = computed<MenuItem[]>(() => {
    if (footerMode === 'none') return []

    if (footerMode === 'clear') {
      return [
        {
          id: 'skills-clear',
          label: t('common.clear'),
          icon: XIcon,
          onClick: () => handleSkillClick('none'),
        },
      ]
    }

    return [
      {
        id: 'skills-manage',
        label: t('prompt.menu.skills.manage'),
        icon: SettingsIcon,
        onClick: handleManageSkills,
      },
    ]
  })

  return {
    menuItems,
    footerItems,
    showFilter: true,
    skillsMenuItems,
    handleSkillClick,
    handleManageSkills,
  }
}

