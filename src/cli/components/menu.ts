// Menu component - displays selectable menu items
// Note: Interactive selection is handled externally (e.g., by terminal-kit)
// This component handles the visual rendering for the layout system

import { Component } from './component'
import { grayText, tertiaryText } from '../display'

export interface MenuItem {
  name: string
  value: string
  description?: string
}

export class Menu extends Component {
  private items: MenuItem[] = []
  private selectedIndex: number = 0
  private title: string = ''
  private maxVisibleItems: number = 10

  constructor(id?: string) {
    super(id ?? 'menu')
  }

  setTitle(title: string): void {
    if (this.title !== title) {
      this.title = title
      this.markDirty()
    }
  }

  getTitle(): string {
    return this.title
  }

  setItems(items: MenuItem[]): void {
    this.items = items
    this.selectedIndex = 0
    this.markDirty()
  }

  getItems(): MenuItem[] {
    return this.items
  }

  setSelectedIndex(index: number): void {
    if (this.selectedIndex !== index && index >= 0 && index < this.items.length) {
      this.selectedIndex = index
      this.markDirty()
    }
  }

  getSelectedIndex(): number {
    return this.selectedIndex
  }

  getSelectedItem(): MenuItem | null {
    return this.items[this.selectedIndex] ?? null
  }

  setMaxVisibleItems(max: number): void {
    if (this.maxVisibleItems !== max) {
      this.maxVisibleItems = max
      this.markDirty()
    }
  }

  // Height: title line + visible items
  calculateHeight(): number {
    const visibleItems = Math.min(this.items.length, this.maxVisibleItems)
    return 1 + visibleItems // Title + items
  }

  render(width: number): string[] {
    const lines: string[] = []

    // Title line
    lines.push(`? ${this.title}`)

    // Calculate column width for alignment
    const maxNameLength = Math.max(...this.items.map(i => i.name.length), 1)
    const columnWidth = Math.max(20, maxNameLength + 4)

    // Render visible items
    const visibleItems = this.items.slice(0, this.maxVisibleItems)

    for (let i = 0; i < visibleItems.length; i++) {
      const item = visibleItems[i]
      const isSelected = i === this.selectedIndex

      // Build item text
      let itemText = item.name
      if (item.description) {
        const padding = ' '.repeat(Math.max(0, columnWidth - item.name.length))
        itemText = `${item.name}${padding}${item.description}`
      }

      // Truncate if too long
      const maxLen = width - 6
      if (itemText.length > maxLen) {
        itemText = itemText.substring(0, maxLen - 1) + '…'
      }

      // Style based on selection
      const prefix = isSelected ? '  › ' : '    '
      const styledText = isSelected ? tertiaryText(itemText) : grayText(itemText)

      lines.push(prefix + styledText)
    }

    return lines
  }
}
