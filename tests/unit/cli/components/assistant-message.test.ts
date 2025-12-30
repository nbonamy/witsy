import { expect, test, describe } from 'vitest'
import { AssistantMessage } from '../../../../src/cli/components/assistant-message'
import { ToolCall } from '../../../../src/cli/components/toolcall'
import { Text } from '../../../../src/cli/components/text'

describe('AssistantMessage', () => {

  describe('constructor', () => {
    test('starts empty', () => {
      const msg = new AssistantMessage()
      expect(msg.childCount()).toBe(0)
    })

    test('custom id', () => {
      const msg = new AssistantMessage('msg-1')
      expect(msg.id).toBe('msg-1')
    })
  })

  describe('adding children', () => {
    test('addToolCall adds tool', () => {
      const msg = new AssistantMessage()
      const tool = msg.addToolCall('tool-1', 'my_tool(args)')

      expect(msg.childCount()).toBe(1)
      expect(tool).toBeInstanceOf(ToolCall)
      expect(tool.getStatus()).toBe('my_tool(args)')
    })

    test('addText adds text', () => {
      const msg = new AssistantMessage()
      const text = msg.addText('Hello world')

      expect(msg.childCount()).toBe(1)
      expect(text).toBeInstanceOf(Text)
      expect(text.getContent()).toBe('Hello world')
    })

    test('can add multiple children', () => {
      const msg = new AssistantMessage()
      msg.addToolCall('tool-1', 'tool1()')
      msg.addToolCall('tool-2', 'tool2()')
      msg.addText('Result text')

      expect(msg.childCount()).toBe(3)
    })
  })

  describe('child access', () => {
    test('getToolCalls returns only tools', () => {
      const msg = new AssistantMessage()
      msg.addToolCall('tool-1', 'tool1()')
      msg.addText('text')
      msg.addToolCall('tool-2', 'tool2()')

      const tools = msg.getToolCalls()
      expect(tools.length).toBe(2)
      expect(tools[0].id).toBe('tool-1')
      expect(tools[1].id).toBe('tool-2')
    })

    test('getLastText returns last text component', () => {
      const msg = new AssistantMessage()
      msg.addText('first')
      msg.addToolCall('tool-1', 'tool()')
      msg.addText('second')

      const last = msg.getLastText()
      expect(last).not.toBeNull()
      expect(last!.getContent()).toBe('second')
    })

    test('getLastText returns null when no text', () => {
      const msg = new AssistantMessage()
      msg.addToolCall('tool-1', 'tool()')

      expect(msg.getLastText()).toBeNull()
    })
  })

  describe('height calculation', () => {
    test('empty message returns 0', () => {
      const msg = new AssistantMessage()
      expect(msg.calculateHeight(80)).toBe(0)
    })

    test('single child + blank line after', () => {
      const msg = new AssistantMessage()
      msg.addText('Hello')
      // Text is 1 line + 1 blank after = 2
      expect(msg.calculateHeight(80)).toBe(2)
    })

    test('multiple children with blank lines between', () => {
      const msg = new AssistantMessage()
      msg.addToolCall('tool-1', 'tool()') // 1 line
      msg.addText('Result')               // 1 line
      // 1 (tool) + 1 (blank between) + 1 (text) + 1 (blank after) = 4
      expect(msg.calculateHeight(80)).toBe(4)
    })
  })

  describe('rendering', () => {
    test('empty message renders nothing', () => {
      const msg = new AssistantMessage()
      const lines = msg.render(80)
      expect(lines.length).toBe(0)
    })

    test('renders children with blank lines between', () => {
      const msg = new AssistantMessage()
      msg.addToolCall('tool-1', 'tool()')
      msg.addText('Result')

      const lines = msg.render(80)

      // Should have tool line, blank, text line, blank
      expect(lines.length).toBe(4)
      expect(lines[1]).toBe('') // blank between
      expect(lines[3]).toBe('') // blank after
    })

    test('renders blank line after message', () => {
      const msg = new AssistantMessage()
      msg.addText('Hello')

      const lines = msg.render(80)
      expect(lines[lines.length - 1]).toBe('')
    })
  })
})
