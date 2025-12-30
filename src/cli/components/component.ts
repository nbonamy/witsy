// Component base class for CLI rendering framework

let idCounter = 0

export abstract class Component {
  readonly id: string
  parent: Component | null = null
  protected children: Component[] = []
  protected cachedHeight: number = 0
  protected dirty: boolean = true

  constructor(id?: string) {
    this.id = id ?? `component-${++idCounter}`
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
