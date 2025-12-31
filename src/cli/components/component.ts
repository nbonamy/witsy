// Component base class for CLI rendering framework

let idCounter = 0

// Callback type for size change notifications
export type SizeChangeCallback = (component: Component, oldHeight: number, newHeight: number) => void

// Callback type for render requests
export type RenderCallback = (component: Component) => void

export abstract class Component {
  readonly id: string
  parent: Component | null = null
  protected children: Component[] = []
  protected cachedHeight: number = 0
  protected dirty: boolean = true

  // Callback for notifying tree of size changes
  private onSizeChange: SizeChangeCallback | null = null

  // Callback for requesting re-render
  private onRequestRender: RenderCallback | null = null

  constructor(id?: string) {
    this.id = id ?? `component-${++idCounter}`
  }

  // Set the size change callback (called by Root when adding to tree)
  setSizeChangeCallback(callback: SizeChangeCallback | null): void {
    this.onSizeChange = callback
  }

  // Set the render callback (called by Root when adding to tree)
  setRenderCallback(callback: RenderCallback | null): void {
    this.onRequestRender = callback
  }

  // Components call this when their size changes
  protected notifySizeChange(oldHeight: number, newHeight: number): void {
    if (this.onSizeChange && oldHeight !== newHeight) {
      this.cachedHeight = newHeight
      this.onSizeChange(this, oldHeight, newHeight)
    }
  }

  // Components call this to request a re-render
  protected requestRender(): void {
    if (this.onRequestRender) {
      this.onRequestRender(this)
    }
  }

  // Calculate height in terminal lines (must be implemented by subclasses)
  abstract calculateHeight(width: number): number

  // Render component to array of strings (one per line)
  abstract render(width: number): string[]

  // Mark component as needing re-render
  markDirty(): void {
    this.dirty = true
  }

  // Check if component needs re-render
  isDirty(): boolean {
    return this.dirty
  }

  // Clear dirty flag
  clearDirty(): void {
    this.dirty = false
  }

  // Get cached height from last render
  getCachedHeight(): number {
    return this.cachedHeight
  }

  // Update cached height
  setCachedHeight(height: number): void {
    this.cachedHeight = height
  }

  // Tree manipulation
  appendChild(child: Component): void {
    child.parent = this
    this.children.push(child)
    this.markDirty()
  }

  insertBefore(child: Component, before: Component): void {
    const index = this.children.indexOf(before)
    if (index === -1) {
      // If 'before' not found, append at end
      this.appendChild(child)
    } else {
      child.parent = this
      this.children.splice(index, 0, child)
      this.markDirty()
    }
  }

  insertAfter(child: Component, after: Component): void {
    const index = this.children.indexOf(after)
    if (index === -1) {
      // If 'after' not found, append at end
      this.appendChild(child)
    } else {
      child.parent = this
      this.children.splice(index + 1, 0, child)
      this.markDirty()
    }
  }

  removeChild(child: Component): void {
    const index = this.children.indexOf(child)
    if (index !== -1) {
      this.children.splice(index, 1)
      child.parent = null
      this.markDirty()
    }
  }

  // Get all children
  getChildren(): Component[] {
    return [...this.children]
  }

  // Find child by id (searches recursively)
  find(id: string): Component | null {
    if (this.id === id) return this
    for (const child of this.children) {
      const found = child.find(id)
      if (found) return found
    }
    return null
  }

  // Find index of child
  indexOf(child: Component): number {
    return this.children.indexOf(child)
  }

  // Get child at index
  childAt(index: number): Component | null {
    return this.children[index] ?? null
  }

  // Get number of children
  childCount(): number {
    return this.children.length
  }
}

// Reset ID counter (useful for testing)
export function resetComponentIdCounter(): void {
  idCounter = 0
}
