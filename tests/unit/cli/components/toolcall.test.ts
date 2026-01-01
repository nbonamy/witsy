import { expect, test, describe } from 'vitest'
import { ToolCall } from '../../../../src/cli/components/toolcall'

describe('ToolCall', () => {

  describe('constructor', () => {
    test('id starts empty', () => {
      const tool = new ToolCall('test_tool(args)')
      expect(tool.id).toBe('')
    })

    test('id is set via setId', () => {
      const tool = new ToolCall('test_tool(args)')
      tool.setId('tool-1')
      expect(tool.id).toBe('tool-1')
    })

    test('stores initial status', () => {
      const tool = new ToolCall('my_tool(arg1, arg2)')
      expect(tool.getStatus()).toBe('my_tool(arg1, arg2)')
    })

    test('starts in running state', () => {
      const tool = new ToolCall('test')
      expect(tool.getState()).toBe('running')
      expect(tool.isCompleted()).toBe(false)
    })
  })

  describe('status management', () => {
    test('updateStatus changes status', () => {
      const tool = new ToolCall('initial')
      tool.updateStatus('updated')
      expect(tool.getStatus()).toBe('updated')
    })

    test('updateStatus marks dirty', () => {
      const tool = new ToolCall('initial')
      tool.clearDirty()

      tool.updateStatus('updated')

      expect(tool.isDirty()).toBe(true)
    })

    test('updateStatus same value does not mark dirty', () => {
      const tool = new ToolCall('same')
      tool.clearDirty()

      tool.updateStatus('same')

      expect(tool.isDirty()).toBe(false)
    })
  })

  describe('completion', () => {
    test('complete sets completed state', () => {
      const tool = new ToolCall('running')

      tool.complete('completed')

      expect(tool.getState()).toBe('completed')
      expect(tool.isCompleted()).toBe(true)
    })

    test('complete sets error state', () => {
      const tool = new ToolCall('running')

      tool.complete('error')

      expect(tool.getState()).toBe('error')
      expect(tool.isCompleted()).toBe(true)
    })

    test('complete with final status updates status', () => {
      const tool = new ToolCall('running')

      tool.complete('completed', 'final result')

      expect(tool.getStatus()).toBe('final result')
    })

    test('complete marks dirty', () => {
      const tool = new ToolCall('running')
      tool.clearDirty()

      tool.complete('completed')

      expect(tool.isDirty()).toBe(true)
    })
  })

  describe('animation', () => {
    test('advanceAnimation marks dirty when running', () => {
      const tool = new ToolCall('running')
      tool.clearDirty()

      tool.advanceAnimation()

      expect(tool.isDirty()).toBe(true)
    })

    test('advanceAnimation does nothing when completed', () => {
      const tool = new ToolCall('running')
      tool.complete('completed')
      tool.clearDirty()

      tool.advanceAnimation()

      expect(tool.isDirty()).toBe(false)
    })
  })

  describe('height calculation', () => {
    test('single line status returns 2 (1 + trailing blank)', () => {
      const tool = new ToolCall('single line')
      // 1 content line + 1 trailing blank for spacing
      expect(tool.calculateHeight(80)).toBe(2)
    })

    test('multi-line status returns correct count plus trailing blank', () => {
      const tool = new ToolCall('line1\nline2\nline3')
      // 3 content lines + 1 trailing blank for spacing
      expect(tool.calculateHeight(80)).toBe(4)
    })
  })

  describe('rendering', () => {
    test('renders tool name in bold', () => {
      const tool = new ToolCall('my_tool(arg)')
      const lines = tool.render(80)

      // Check that output contains the tool name
      expect(lines[0]).toContain('my_tool')
    })

    test('renders multiple lines plus trailing blank', () => {
      const tool = new ToolCall('tool()\n  detail1\n  detail2')
      const lines = tool.render(80)

      // 3 content lines + 1 trailing blank
      expect(lines.length).toBe(4)
    })

    test('truncates long detail lines', () => {
      const longDetail = 'a'.repeat(200)
      const tool = new ToolCall(`tool()\n${longDetail}`)
      const lines = tool.render(80)

      // Detail line should be truncated with ellipsis
      expect(lines[1].length).toBeLessThanOrEqual(80)
    })

    test('completed state shows success prefix', () => {
      const tool = new ToolCall('tool()')
      tool.complete('completed')
      const lines = tool.render(80)

      // Should have success colored ⏺
      expect(lines[0]).toContain('⏺')
    })

    test('error state shows error prefix', () => {
      const tool = new ToolCall('tool()')
      tool.complete('error')
      const lines = tool.render(80)

      // Should have error colored ⏺
      expect(lines[0]).toContain('⏺')
    })
  })
})
