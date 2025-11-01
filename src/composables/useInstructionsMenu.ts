import { computed } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import type { MenuItem } from '../types/menu'

export interface UseInstructionsMenuOptions {
  emit: (event: any, ...args: any[]) => void
}

// Built-in instruction IDs
const instructionIds = ['standard', 'structured', 'playful', 'empathic', 'uplifting', 'reflective', 'visionary']

export function useInstructionsMenu(options: UseInstructionsMenuOptions) {
  const { emit } = options

  // Computed properties
  const customInstructions = computed(() => {
    return store.config.llm.customInstructions || []
  })

  // Event handlers
  const handleInstructionClick = (instructionId: string) => {
    emit('instructionsSelected', instructionId)
  }

  // Generate menu items
  const menuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      {
        id: 'instruction-null',
        label: t('prompt.instructions.default'),
        onClick: () => handleInstructionClick('null'),
      },
      ...instructionIds.map(id => ({
        id: `instruction-${id}`,
        label: t(`settings.llm.instructions.${id}`),
        onClick: () => handleInstructionClick(id),
      })),
      ...customInstructions.value.map((custom: any) => ({
        id: `instruction-custom-${custom.id}`,
        label: custom.label,
        onClick: () => handleInstructionClick(`custom:${custom.id}`),
      })),
    ]

    return items
  })

  return {
    menuItems,
    footerItems: computed<MenuItem[]>(() => []), // No footer for instructions
    showFilter: true,
    customInstructions,
  }
}
