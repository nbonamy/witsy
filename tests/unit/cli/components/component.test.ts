import { expect, test, describe } from 'vitest'
import { Component } from '../../../../src/cli/components/component'

// Concrete test component
class TestComponent extends Component {
  private height: number
  private content: string

  constructor(height: number = 1, content: string = '') {
    super()
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

  describe('id management', () => {
    test('id starts empty', () => {
      const comp = new TestComponent()
      expect(comp.id).toBe('')
    })

    test('setId sets the id', () => {
      const comp = new TestComponent()
      comp.setId('my-id')
      expect(comp.id).toBe('my-id')
    })
  })

  describe('tree manipulation', () => {
    test('appendChild adds child', () => {
      const parent = new TestComponent()
      const child = new TestComponent()

      parent.appendChild(child)

      expect(parent.childCount()).toBe(1)
      expect(parent.getChildren()[0]).toBe(child)
      expect(child.parent).toBe(parent)
    })

    test('appendChild marks parent dirty', () => {
      const parent = new TestComponent()
      const child = new TestComponent()
      parent.clearDirty()

      parent.appendChild(child)

      expect(parent.isDirty()).toBe(true)
    })

    test('insertBefore inserts at correct position', () => {
      const parent = new TestComponent()
      const child1 = new TestComponent()
      const child2 = new TestComponent()
      const child3 = new TestComponent()

      parent.appendChild(child1)
      parent.appendChild(child3)
      parent.insertBefore(child2, child3)

      expect(parent.getChildren()).toEqual([child1, child2, child3])
    })

    test('insertBefore appends if reference not found', () => {
      const parent = new TestComponent()
      const child1 = new TestComponent()
      const child2 = new TestComponent()
      const notChild = new TestComponent()

      parent.appendChild(child1)
      parent.insertBefore(child2, notChild)

      expect(parent.getChildren()).toEqual([child1, child2])
    })

    test('insertAfter inserts at correct position', () => {
      const parent = new TestComponent()
      const child1 = new TestComponent()
      const child2 = new TestComponent()
      const child3 = new TestComponent()

      parent.appendChild(child1)
      parent.appendChild(child3)
      parent.insertAfter(child2, child1)

      expect(parent.getChildren()).toEqual([child1, child2, child3])
    })

    test('removeChild removes child', () => {
      const parent = new TestComponent()
      const child1 = new TestComponent()
      const child2 = new TestComponent()

      parent.appendChild(child1)
      parent.appendChild(child2)
      parent.removeChild(child1)

      expect(parent.childCount()).toBe(1)
      expect(parent.getChildren()).toEqual([child2])
      expect(child1.parent).toBeNull()
    })

    test('removeChild marks parent dirty', () => {
      const parent = new TestComponent()
      const child = new TestComponent()
      parent.appendChild(child)
      parent.clearDirty()

      parent.removeChild(child)

      expect(parent.isDirty()).toBe(true)
    })
  })

  describe('find', () => {
    test('finds component by id', () => {
      const root = new TestComponent()
      root.setId('root')
      const child1 = new TestComponent()
      child1.setId('child1')
      const child2 = new TestComponent()
      child2.setId('child2')
      const grandchild = new TestComponent()
      grandchild.setId('grandchild')

      root.appendChild(child1)
      root.appendChild(child2)
      child1.appendChild(grandchild)

      expect(root.find('child2')).toBe(child2)
      expect(root.find('grandchild')).toBe(grandchild)
      expect(root.find('not-found')).toBeNull()
    })

    test('finds self', () => {
      const comp = new TestComponent()
      comp.setId('self')
      expect(comp.find('self')).toBe(comp)
    })
  })

  describe('dirty state', () => {
    test('starts dirty', () => {
      const comp = new TestComponent()
      expect(comp.isDirty()).toBe(true)
    })

    test('clearDirty clears flag', () => {
      const comp = new TestComponent()
      comp.clearDirty()
      expect(comp.isDirty()).toBe(false)
    })

    test('markDirty sets flag', () => {
      const comp = new TestComponent()
      comp.clearDirty()
      comp.markDirty()
      expect(comp.isDirty()).toBe(true)
    })
  })

  describe('height caching', () => {
    test('caches height', () => {
      const comp = new TestComponent(5)
      comp.setCachedHeight(5)
      expect(comp.getCachedHeight()).toBe(5)
    })
  })

  describe('child access', () => {
    test('indexOf returns correct index', () => {
      const parent = new TestComponent()
      const child1 = new TestComponent()
      const child2 = new TestComponent()

      parent.appendChild(child1)
      parent.appendChild(child2)

      expect(parent.indexOf(child1)).toBe(0)
      expect(parent.indexOf(child2)).toBe(1)
    })

    test('childAt returns correct child', () => {
      const parent = new TestComponent()
      const child1 = new TestComponent()
      const child2 = new TestComponent()

      parent.appendChild(child1)
      parent.appendChild(child2)

      expect(parent.childAt(0)).toBe(child1)
      expect(parent.childAt(1)).toBe(child2)
      expect(parent.childAt(2)).toBeNull()
    })
  })

  describe('visibility', () => {
    test('starts visible', () => {
      const comp = new TestComponent()
      expect(comp.visible).toBe(true)
    })

    test('hide sets visible to false', () => {
      const comp = new TestComponent()
      comp.hide()
      expect(comp.visible).toBe(false)
    })

    test('show sets visible to true', () => {
      const comp = new TestComponent()
      comp.hide()
      comp.show()
      expect(comp.visible).toBe(true)
    })

    test('setVisible marks dirty on change', () => {
      const comp = new TestComponent()
      comp.clearDirty()
      comp.setVisible(false)
      expect(comp.isDirty()).toBe(true)
    })

    test('setVisible does not mark dirty if same value', () => {
      const comp = new TestComponent()
      comp.clearDirty()
      comp.setVisible(true)  // Already true
      expect(comp.isDirty()).toBe(false)
    })
  })
})
