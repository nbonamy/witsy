import { expect, test, describe, beforeEach } from 'vitest'
import { Component, resetComponentIdCounter } from '../../../../src/cli/components/component'

// Concrete test component
class TestComponent extends Component {
  private height: number
  private content: string

  constructor(id: string, height: number = 1, content: string = '') {
    super(id)
    this.height = height
    this.content = content
  }

  calculateHeight(): number {
    return this.height
  }

  render(): string[] {
    const lines: string[] = []
    for (let i = 0; i < this.height; i++) {
      lines.push(this.content || `line-${i}`)
    }
    return lines
  }

  setHeight(h: number): void {
    this.height = h
  }
}

describe('Component', () => {

  beforeEach(() => {
    resetComponentIdCounter()
  })

  describe('constructor', () => {
    test('generates auto id when none provided', () => {
      const comp1 = new TestComponent(undefined as unknown as string)
      const comp2 = new TestComponent(undefined as unknown as string)
      expect(comp1.id).toBe('component-1')
      expect(comp2.id).toBe('component-2')
    })

    test('uses provided id', () => {
      const comp = new TestComponent('my-id')
      expect(comp.id).toBe('my-id')
    })
  })

  describe('tree manipulation', () => {
    test('appendChild adds child', () => {
      const parent = new TestComponent('parent')
      const child = new TestComponent('child')

      parent.appendChild(child)

      expect(parent.childCount()).toBe(1)
      expect(parent.getChildren()[0]).toBe(child)
      expect(child.parent).toBe(parent)
    })

    test('appendChild marks parent dirty', () => {
      const parent = new TestComponent('parent')
      const child = new TestComponent('child')
      parent.clearDirty()

      parent.appendChild(child)

      expect(parent.isDirty()).toBe(true)
    })

    test('insertBefore inserts at correct position', () => {
      const parent = new TestComponent('parent')
      const child1 = new TestComponent('child1')
      const child2 = new TestComponent('child2')
      const child3 = new TestComponent('child3')

      parent.appendChild(child1)
      parent.appendChild(child3)
      parent.insertBefore(child2, child3)

      expect(parent.getChildren()).toEqual([child1, child2, child3])
    })

    test('insertBefore appends if reference not found', () => {
      const parent = new TestComponent('parent')
      const child1 = new TestComponent('child1')
      const child2 = new TestComponent('child2')
      const notChild = new TestComponent('not-child')

      parent.appendChild(child1)
      parent.insertBefore(child2, notChild)

      expect(parent.getChildren()).toEqual([child1, child2])
    })

    test('insertAfter inserts at correct position', () => {
      const parent = new TestComponent('parent')
      const child1 = new TestComponent('child1')
      const child2 = new TestComponent('child2')
      const child3 = new TestComponent('child3')

      parent.appendChild(child1)
      parent.appendChild(child3)
      parent.insertAfter(child2, child1)

      expect(parent.getChildren()).toEqual([child1, child2, child3])
    })

    test('removeChild removes child', () => {
      const parent = new TestComponent('parent')
      const child1 = new TestComponent('child1')
      const child2 = new TestComponent('child2')

      parent.appendChild(child1)
      parent.appendChild(child2)
      parent.removeChild(child1)

      expect(parent.childCount()).toBe(1)
      expect(parent.getChildren()).toEqual([child2])
      expect(child1.parent).toBeNull()
    })

    test('removeChild marks parent dirty', () => {
      const parent = new TestComponent('parent')
      const child = new TestComponent('child')
      parent.appendChild(child)
      parent.clearDirty()

      parent.removeChild(child)

      expect(parent.isDirty()).toBe(true)
    })
  })

  describe('find', () => {
    test('finds component by id', () => {
      const root = new TestComponent('root')
      const child1 = new TestComponent('child1')
      const child2 = new TestComponent('child2')
      const grandchild = new TestComponent('grandchild')

      root.appendChild(child1)
      root.appendChild(child2)
      child1.appendChild(grandchild)

      expect(root.find('child2')).toBe(child2)
      expect(root.find('grandchild')).toBe(grandchild)
      expect(root.find('not-found')).toBeNull()
    })

    test('finds self', () => {
      const comp = new TestComponent('self')
      expect(comp.find('self')).toBe(comp)
    })
  })

  describe('dirty state', () => {
    test('starts dirty', () => {
      const comp = new TestComponent('test')
      expect(comp.isDirty()).toBe(true)
    })

    test('clearDirty clears flag', () => {
      const comp = new TestComponent('test')
      comp.clearDirty()
      expect(comp.isDirty()).toBe(false)
    })

    test('markDirty sets flag', () => {
      const comp = new TestComponent('test')
      comp.clearDirty()
      comp.markDirty()
      expect(comp.isDirty()).toBe(true)
    })
  })

  describe('height caching', () => {
    test('caches height', () => {
      const comp = new TestComponent('test', 5)
      comp.setCachedHeight(5)
      expect(comp.getCachedHeight()).toBe(5)
    })
  })

  describe('child access', () => {
    test('indexOf returns correct index', () => {
      const parent = new TestComponent('parent')
      const child1 = new TestComponent('child1')
      const child2 = new TestComponent('child2')

      parent.appendChild(child1)
      parent.appendChild(child2)

      expect(parent.indexOf(child1)).toBe(0)
      expect(parent.indexOf(child2)).toBe(1)
    })

    test('childAt returns correct child', () => {
      const parent = new TestComponent('parent')
      const child1 = new TestComponent('child1')
      const child2 = new TestComponent('child2')

      parent.appendChild(child1)
      parent.appendChild(child2)

      expect(parent.childAt(0)).toBe(child1)
      expect(parent.childAt(1)).toBe(child2)
      expect(parent.childAt(2)).toBeNull()
    })
  })
})
