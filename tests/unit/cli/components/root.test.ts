import { expect, test, describe, beforeEach, vi, afterEach } from 'vitest'
import { Component, resetComponentIdCounter } from '../../../../src/cli/components/component'
import { Root } from '../../../../src/cli/components/root'

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
      lines.push(this.content || `${this.id}-line-${i}`)
    }
    return lines
  }

  setHeight(h: number): void {
    this.height = h
    this.markDirty()
  }
}

describe('Root', () => {

  let output: string[]
  let originalWrite: typeof process.stdout.write
  let originalColumns: number | undefined
  let originalRows: number | undefined

  beforeEach(() => {
    resetComponentIdCounter()
    output = []

    // Mock stdout.write
    originalWrite = process.stdout.write
    process.stdout.write = vi.fn((data: string | Uint8Array) => {
      if (typeof data === 'string') {
        output.push(data)
      }
      return true
    }) as typeof process.stdout.write

    // Mock terminal dimensions
    originalColumns = process.stdout.columns
    originalRows = process.stdout.rows
    Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true })
    Object.defineProperty(process.stdout, 'rows', { value: 24, configurable: true })
  })

  afterEach(() => {
    process.stdout.write = originalWrite
    Object.defineProperty(process.stdout, 'columns', { value: originalColumns, configurable: true })
    Object.defineProperty(process.stdout, 'rows', { value: originalRows, configurable: true })
  })

  describe('constructor', () => {
    test('has id "root"', () => {
      const root = new Root()
      expect(root.id).toBe('root')
    })
  })

  describe('dimensions', () => {
    test('reads terminal dimensions', () => {
      const root = new Root()
      root.updateDimensions()
      expect(root.getTermWidth()).toBe(80)
      expect(root.getTermHeight()).toBe(24)
    })
  })

  describe('calculateHeight', () => {
    test('sums children heights', () => {
      const root = new Root()
      root.appendChild(new TestComponent('c1', 3))
      root.appendChild(new TestComponent('c2', 5))
      root.appendChild(new TestComponent('c3', 2))

      expect(root.calculateHeight(80)).toBe(10)
    })
  })

  describe('render', () => {
    test('renders all children lines', () => {
      const root = new Root()
      root.appendChild(new TestComponent('c1', 2, 'content1'))
      root.appendChild(new TestComponent('c2', 1, 'content2'))

      const lines = root.render(80)
      expect(lines).toEqual(['content1', 'content1', 'content2'])
    })
  })

  describe('position tracking', () => {
    test('calculates positions after renderFull', () => {
      const root = new Root()
      const c1 = new TestComponent('c1', 3)
      const c2 = new TestComponent('c2', 2)
      const c3 = new TestComponent('c3', 4)

      root.appendChild(c1)
      root.appendChild(c2)
      root.appendChild(c3)
      root.renderFull()

      expect(root.getPosition(c1)).toEqual({ startRow: 1, height: 3 })
      expect(root.getPosition(c2)).toEqual({ startRow: 4, height: 2 })
      expect(root.getPosition(c3)).toEqual({ startRow: 6, height: 4 })
    })
  })

  describe('updateComponent', () => {
    test('updates component in place when height unchanged', () => {
      const root = new Root()
      const c1 = new TestComponent('c1', 2)
      root.appendChild(c1)
      root.renderFull()

      output = [] // Reset output
      root.updateComponent(c1)

      // Should have cursor moves and content writes (format is "id-line-N")
      expect(output.some(s => s.includes('c1-line-'))).toBe(true)
    })

    test('clears dirty flag after update', () => {
      const root = new Root()
      const c1 = new TestComponent('c1', 2)
      root.appendChild(c1)
      root.renderFull()

      c1.markDirty()
      expect(c1.isDirty()).toBe(true)

      root.updateComponent(c1)
      expect(c1.isDirty()).toBe(false)
    })
  })

  describe('animation management', () => {
    test('starts and stops animation', () => {
      vi.useFakeTimers()
      const root = new Root()
      let count = 0

      root.startAnimation('test', () => count++, 100)
      expect(root.hasAnimation('test')).toBe(true)

      vi.advanceTimersByTime(350)
      expect(count).toBe(3)

      root.stopAnimation('test')
      expect(root.hasAnimation('test')).toBe(false)

      vi.advanceTimersByTime(200)
      expect(count).toBe(3) // No more increments

      vi.useRealTimers()
    })

    test('stopAllAnimations stops all', () => {
      vi.useFakeTimers()
      const root = new Root()

      root.startAnimation('a1', () => {}, 100)
      root.startAnimation('a2', () => {}, 100)

      expect(root.hasAnimation('a1')).toBe(true)
      expect(root.hasAnimation('a2')).toBe(true)

      root.stopAllAnimations()

      expect(root.hasAnimation('a1')).toBe(false)
      expect(root.hasAnimation('a2')).toBe(false)

      vi.useRealTimers()
    })

    test('startAnimation replaces existing', () => {
      vi.useFakeTimers()
      const root = new Root()
      let count1 = 0
      let count2 = 0

      root.startAnimation('test', () => count1++, 100)
      vi.advanceTimersByTime(250)
      expect(count1).toBe(2)

      root.startAnimation('test', () => count2++, 100)
      vi.advanceTimersByTime(250)

      expect(count1).toBe(2) // Old one stopped
      expect(count2).toBe(2) // New one running

      vi.useRealTimers()
    })
  })
})
