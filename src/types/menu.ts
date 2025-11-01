import type { Component } from 'vue'

/**
 * Type of menu item
 * - item: Regular clickable menu item
 * - checkbox: Menu item with checkbox (for toggleable options)
 * - separator: Visual separator (horizontal line)
 * - group: Group header (non-clickable label)
 */
export type MenuItemType = 'item' | 'checkbox' | 'separator' | 'group'

/**
 * Menu item definition for data-driven menus
 *
 * @example Simple menu item
 * ```ts
 * {
 *   id: 'save',
 *   label: 'Save',
 *   onClick: () => handleSave()
 * }
 * ```
 *
 * @example Menu item with submenu
 * ```ts
 * {
 *   id: 'file',
 *   label: 'File',
 *   submenu: [
 *     { id: 'new', label: 'New', onClick: handleNew },
 *     { id: 'open', label: 'Open', onClick: handleOpen }
 *   ]
 * }
 * ```
 *
 * @example Checkbox menu item
 * ```ts
 * {
 *   id: 'plugin-search',
 *   label: 'Search Plugin',
 *   type: 'checkbox',
 *   checked: true,
 *   onClick: () => togglePlugin('search')
 * }
 * ```
 */
export interface MenuItem {
  /**
   * Unique identifier for this menu item
   */
  id: string

  /**
   * Display label for the menu item
   */
  label?: string

  /**
   * Icon component to display (e.g., from lucide-vue-next)
   */
  icon?: Component

  /**
   * Type of menu item (default: 'item')
   */
  type?: MenuItemType

  /**
   * For checkbox items: whether the checkbox is checked
   */
  checked?: boolean

  /**
   * For checkbox items: whether the checkbox is in indeterminate state
   */
  indeterminate?: boolean

  /**
   * Click handler for this menu item
   * Not applicable for items with submenu or separators
   */
  onClick?: () => void

  /**
   * Submenu items (creates a nested menu)
   * When present, clicking this item navigates to the submenu
   */
  submenu?: MenuItem[]

  /**
   * Whether to show search filter when in this submenu
   */
  showFilter?: boolean

  /**
   * Footer items for this submenu
   * Displayed at the bottom of the submenu (e.g., "Select All" / "Unselect All")
   */
  footer?: MenuItem[]

  /**
   * Custom CSS classes to apply to this menu item
   */
  cssClass?: string

  /**
   * Whether this menu item is disabled
   */
  disabled?: boolean

  /**
   * Custom data that can be attached to the menu item
   * Useful for passing additional context to click handlers
   */
  data?: any
}
