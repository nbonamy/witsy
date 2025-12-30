// Root component - layout engine and animation manager

import ansiEscapes from 'ansi-escapes'
import { Component } from './component'

export interface ComponentPosition {
  startRow: number
  height: number
}

export class Root extends Component {
  // Track positions: componentId -> { startRow, height }
  private positions: Map<string, ComponentPosition> = new Map()

  // Central animation manager
  private animations: Map<string, NodeJS.Timeout> = new Map()

  // Terminal dimensions
  private termWidth: number = process.stdout.columns || 80
  private termHeight: number = process.stdout.rows || 24

  constructor() {
    super('root')
  }

  // Root doesn't render itself, just its children
  calculateHeight(width: number): number {
    let total = 0
    for (const child of this.children) {
      total += child.calculateHeight(width)
    }
    this.cachedHeight = total
    return total
  }

  render(width: number): string[] {
    const lines: string[] = []
    for (const child of this.children) {
      lines.push(...child.render(width))
    }
    return lines
  }

  // Update terminal dimensions (call on resize)
  updateDimensions(): void {
    this.termWidth = process.stdout.columns || 80
    this.termHeight = process.stdout.rows || 24
  }

  // Get terminal width
  getTermWidth(): number {
    return this.termWidth
  }

  // Get terminal height
  getTermHeight(): number {
    return this.termHeight
  }

  // Calculate positions for all components
  private calculatePositions(): void {
    this.positions.clear()
    let currentRow = 1

    for (const child of this.children) {
      const height = child.calculateHeight(this.termWidth)
      this.positions.set(child.id, { startRow: currentRow, height })
      child.setCachedHeight(height)
      currentRow += height
    }
  }

  // Get position of a component
  getPosition(component: Component): ComponentPosition | undefined {
    return this.positions.get(component.id)
  }

  // Full render (used on init, resize)
  renderFull(): void {
    this.updateDimensions()
    process.stdout.write(ansiEscapes.clearTerminal)
    process.stdout.write(ansiEscapes.cursorTo(0, 0))

    this.calculatePositions()

    // Render all children
    for (const child of this.children) {
      const lines = child.render(this.termWidth)
      for (const line of lines) {
        process.stdout.write(line + '\n')
      }
      child.clearDirty()
    }
  }

  // Update a single component (handles line insertion/deletion)
  updateComponent(component: Component): void {
    const pos = this.positions.get(component.id)
    if (!pos) {
      // Component not yet positioned, need full render
      this.renderFull()
      return
    }

    const oldHeight = pos.height
    const newHeight = component.calculateHeight(this.termWidth)

    if (newHeight === oldHeight) {
      // Same height - just re-render in place
      this.renderInPlace(component, pos.startRow, newHeight)
    } else if (newHeight > oldHeight) {
      // Component grew - need to insert lines
      this.handleGrow(component, pos, oldHeight, newHeight)
    } else {
      // Component shrank - need to delete lines
      this.handleShrink(component, pos, oldHeight, newHeight)
    }

    // Update position cache
    pos.height = newHeight
    component.setCachedHeight(newHeight)
    component.clearDirty()

    // Update positions of all subsequent components
    this.updatePositionsAfter(component, newHeight - oldHeight)
  }

  // Render component in place (no height change)
  private renderInPlace(component: Component, startRow: number, height: number): void {
    const lines = component.render(this.termWidth)

    for (let i = 0; i < height; i++) {
      process.stdout.write(ansiEscapes.cursorTo(0, startRow - 1 + i))
      process.stdout.write(ansiEscapes.eraseLine)
      if (i < lines.length) {
        process.stdout.write(lines[i])
      }
    }
  }

  // Handle component that grew in height
  private handleGrow(
    component: Component,
    pos: ComponentPosition,
    oldHeight: number,
    newHeight: number
  ): void {
    const diff = newHeight - oldHeight

    // Move cursor to end of component's old area
    process.stdout.write(ansiEscapes.cursorTo(0, pos.startRow - 1 + oldHeight))

    // Insert blank lines to push content down
    for (let i = 0; i < diff; i++) {
      process.stdout.write(ansiEscapes.scrollDown)
    }

    // Now render the component at its position
    this.renderInPlace(component, pos.startRow, newHeight)
  }

  // Handle component that shrank in height
  private handleShrink(
    component: Component,
    pos: ComponentPosition,
    oldHeight: number,
    newHeight: number
  ): void {
    const diff = oldHeight - newHeight

    // Render the component first
    this.renderInPlace(component, pos.startRow, newHeight)

    // Delete the extra lines
    for (let i = 0; i < diff; i++) {
      process.stdout.write(ansiEscapes.cursorTo(0, pos.startRow - 1 + newHeight))
      process.stdout.write(ansiEscapes.scrollUp)
    }
  }

  // Update positions of components after the changed one
  private updatePositionsAfter(changedComponent: Component, heightDiff: number): void {
    if (heightDiff === 0) return

    let found = false
    for (const child of this.children) {
      if (found) {
        const pos = this.positions.get(child.id)
        if (pos) {
          pos.startRow += heightDiff
        }
      }
      if (child.id === changedComponent.id) {
        found = true
      }
    }
  }

  // Animation management
  startAnimation(id: string, callback: () => void, intervalMs: number): void {
    this.stopAnimation(id)
    this.animations.set(id, setInterval(callback, intervalMs))
  }

  stopAnimation(id: string): void {
    const interval = this.animations.get(id)
    if (interval) {
      clearInterval(interval)
      this.animations.delete(id)
    }
  }

  stopAllAnimations(): void {
    for (const interval of this.animations.values()) {
      clearInterval(interval)
    }
    this.animations.clear()
  }

  // Check if animation is running
  hasAnimation(id: string): boolean {
    return this.animations.has(id)
  }

  // Save cursor position
  saveCursor(): void {
    process.stdout.write(ansiEscapes.cursorSavePosition)
  }

  // Restore cursor position
  restoreCursor(): void {
    process.stdout.write(ansiEscapes.cursorRestorePosition)
  }

  // Move cursor to specific position
  moveCursor(row: number, col: number = 0): void {
    process.stdout.write(ansiEscapes.cursorTo(col, row - 1))
  }
}
