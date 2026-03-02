import { vi, beforeAll, beforeEach, afterAll, expect, test, describe } from 'vitest'
import { mount, enableAutoUnmount, VueWrapper } from '@vue/test-utils'
import { useWindowMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import TiptapEditor from '@components/editor/TiptapEditor.vue'

vi.mock('@services/i18n', () => createI18nMock())

// Mock dialog
vi.mock('@renderer/utils/dialog', () => ({
  default: {
    alert: vi.fn(() => Promise.resolve()),
  }
}))

// Mock docx/pptx services
vi.mock('@services/docx', () => ({
  exportToDocx: vi.fn().mockResolvedValue(new Blob()),
  saveDocxBlob: vi.fn(),
}))
vi.mock('@services/pptx', () => ({
  exportToPptx: vi.fn().mockResolvedValue(new Blob()),
  savePptxBlob: vi.fn(),
}))

enableAutoUnmount(afterAll)

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const mountEditor = async (markdown: string): Promise<VueWrapper<any>> => {
  const wrapper = mount(TiptapEditor, {
    props: {
      modelValue: markdown,
      filePath: '/project/test.md',
      readOnly: false,
      isMarpFile: false,
    }
  })
  // Wait for editor to initialize
  await vi.waitUntil(() => wrapper.vm.editor != null, { timeout: 2000 })
  return wrapper
}

describe('TiptapEditor - getSelectedMarkdown', () => {

  test('returns null when no selection', async () => {
    const wrapper = await mountEditor('Hello world')
    expect(wrapper.vm.getSelectedMarkdown()).toBeNull()
  })

  test('returns markdown for selected plain text', async () => {
    const wrapper = await mountEditor('Hello world')
    const editor = wrapper.vm.editor

    // Select "Hello"
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const result = wrapper.vm.getSelectedMarkdown()

    expect(result).not.toBeNull()
    expect(result.markdown.trim()).toBe('Hello')
    expect(result.from).toBe(1)
    expect(result.to).toBe(6)
  })

  test('returns markdown for selected bold text', async () => {
    const wrapper = await mountEditor('Hello **world** end')
    const editor = wrapper.vm.editor

    // Select the bold "world" — ProseMirror positions: "Hello " = 1-7, "world" = 7-12
    editor.commands.setTextSelection({ from: 7, to: 12 })
    const result = wrapper.vm.getSelectedMarkdown()

    expect(result).not.toBeNull()
    expect(result.markdown.trim()).toBe('**world**')
  })

  test('returns markdown for selection spanning a heading', async () => {
    const wrapper = await mountEditor('# Title\n\nParagraph text')
    const editor = wrapper.vm.editor

    // Select "Title" inside the heading (positions within the h1 node)
    // h1 node starts at pos 1, text "Title" is at 1-6
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const result = wrapper.vm.getSelectedMarkdown()

    expect(result).not.toBeNull()
    expect(result.markdown.trim()).toBe('Title')
  })

  test('returns markdown for multi-paragraph selection', async () => {
    const wrapper = await mountEditor('First paragraph\n\nSecond paragraph')
    const editor = wrapper.vm.editor

    // Select all content
    editor.commands.selectAll()
    const result = wrapper.vm.getSelectedMarkdown()

    expect(result).not.toBeNull()
    expect(result.markdown).toContain('First paragraph')
    expect(result.markdown).toContain('Second paragraph')
  })

  test('returns markdown for selection with list items', async () => {
    const wrapper = await mountEditor('- item one\n- item two\n- item three')
    const editor = wrapper.vm.editor

    // Select all
    editor.commands.selectAll()
    const result = wrapper.vm.getSelectedMarkdown()

    expect(result).not.toBeNull()
    expect(result.markdown).toContain('item one')
    expect(result.markdown).toContain('item two')
    expect(result.markdown).toContain('item three')
  })

  test('uses saved selection when editor loses focus', async () => {
    const wrapper = await mountEditor('Hello world')
    const editor = wrapper.vm.editor

    // Select "world"
    editor.commands.setTextSelection({ from: 7, to: 12 })

    // Simulate blur — set savedSelection directly
    wrapper.vm.savedSelection = { from: 7, to: 12 }

    // Move cursor to collapse selection (simulating focus elsewhere)
    editor.commands.setTextSelection(1)

    const result = wrapper.vm.getSelectedMarkdown()
    expect(result).not.toBeNull()
    expect(result.markdown.trim()).toBe('world')
  })

})

describe('TiptapEditor - selectMarkdownRange', () => {

  test('selects text at the beginning of document', async () => {
    const wrapper = await mountEditor('Hello world')
    const editor = wrapper.vm.editor

    // "Hello" is chars 0-5 in markdown
    wrapper.vm.selectMarkdownRange(0, 5)

    const { from, to } = editor.state.selection
    expect(editor.state.doc.textBetween(from, to)).toBe('Hello')
  })

  test('selects text in the middle of document', async () => {
    const wrapper = await mountEditor('First paragraph\n\nSecond paragraph')
    const editor = wrapper.vm.editor
    const fullMarkdown = editor.getMarkdown()

    // Find "Second paragraph" in the markdown
    const idx = fullMarkdown.indexOf('Second paragraph')
    expect(idx).toBeGreaterThan(0)
    wrapper.vm.selectMarkdownRange(idx, idx + 'Second paragraph'.length)

    const { from, to } = editor.state.selection
    expect(editor.state.doc.textBetween(from, to)).toBe('Second paragraph')
  })

  test('selects a full heading', async () => {
    const wrapper = await mountEditor('# My Title\n\nSome text')
    const editor = wrapper.vm.editor
    const fullMarkdown = editor.getMarkdown()

    // Select "# My Title"
    const idx = fullMarkdown.indexOf('# My Title')
    wrapper.vm.selectMarkdownRange(idx, idx + '# My Title'.length)

    const { from, to } = editor.state.selection
    expect(editor.state.doc.textBetween(from, to)).toBe('My Title')
  })

  test('selects bold text preserving markdown', async () => {
    const wrapper = await mountEditor('Hello **bold** world')
    const editor = wrapper.vm.editor
    const fullMarkdown = editor.getMarkdown()

    // Select "**bold**"
    const idx = fullMarkdown.indexOf('**bold**')
    wrapper.vm.selectMarkdownRange(idx, idx + '**bold**'.length)

    const { from, to } = editor.state.selection
    expect(editor.state.doc.textBetween(from, to)).toBe('bold')
  })

  test('does nothing when editor is not ready', async () => {
    const wrapper = await mountEditor('Hello')
    // Should not throw
    wrapper.vm.selectMarkdownRange(0, 0)
  })

})

describe('TiptapEditor - replaceSelection', () => {

  test('replaces plain text selection', async () => {
    const wrapper = await mountEditor('Hello world')
    const editor = wrapper.vm.editor

    // Select "Hello"
    editor.commands.setTextSelection({ from: 1, to: 6 })
    wrapper.vm.replaceSelection('Goodbye')

    const markdown = editor.getMarkdown()
    expect(markdown).toContain('Goodbye')
    expect(markdown).toContain('world')
    expect(markdown).not.toContain('Hello')
  })

  test('replaces list items with single item', async () => {
    const wrapper = await mountEditor('- item one\n- item two\n- item three')
    const editor = wrapper.vm.editor

    // Select all three list items
    editor.commands.selectAll()
    wrapper.vm.replaceSelection('- collapsed')

    const markdown = editor.getMarkdown()
    expect(markdown.trim()).toBe('- collapsed')
  })

  test('replaces partial list selection', async () => {
    const wrapper = await mountEditor('- item one\n- item two\n- item three')
    const editor = wrapper.vm.editor

    // Select "item one" and "item two" — positions: list starts at 2
    // item one text: pos 2-10, item two text: pos 12-20
    // We need to select the first two list items
    const doc = editor.state.doc
    // Find positions for first two items: from start of "item one" to end of "item two"
    let firstItemStart = -1
    let secondItemEnd = -1
    let textIndex = 0
    doc.descendants((node, pos) => {
      if (!node.isText) return true
      if (textIndex === 0) firstItemStart = pos
      if (textIndex === 1) secondItemEnd = pos + node.text!.length
      textIndex++
      return true
    })

    editor.commands.setTextSelection({ from: firstItemStart, to: secondItemEnd })
    wrapper.vm.replaceSelection('- merged item')

    const markdown = editor.getMarkdown()
    expect(markdown).toContain('merged item')
    expect(markdown).toContain('item three')
    expect(markdown).not.toContain('item one')
    expect(markdown).not.toContain('item two')
  })

  test('replaces selection with formatted markdown', async () => {
    const wrapper = await mountEditor('Hello world, this is a test')
    const editor = wrapper.vm.editor

    // Select "world"
    editor.commands.setTextSelection({ from: 7, to: 12 })
    wrapper.vm.replaceSelection('**bold world**')

    const markdown = editor.getMarkdown()
    expect(markdown).toContain('**bold world**')
    expect(markdown).toContain('Hello')
    expect(markdown).toContain('this is a test')
  })

  test('replaces heading selection', async () => {
    const wrapper = await mountEditor('# Old Title\n\nSome text')
    const editor = wrapper.vm.editor

    // Select "Old Title"
    editor.commands.setTextSelection({ from: 1, to: 10 })
    wrapper.vm.replaceSelection('New Title')

    const markdown = editor.getMarkdown()
    expect(markdown).toContain('New Title')
    expect(markdown).toContain('Some text')
    expect(markdown).not.toContain('Old Title')
  })

  test('replaces first 3 list items after heading, keeping remaining items', async () => {
    const doc = [
      '### Key Takeaways',
      '',
      '- First item about **thought experiments**.',
      '- Second item about **quantum mechanics**.',
      '- Third item about **superposition**.',
      '- Fourth item about being **both alive and dead**.',
      '- Fifth item about **observing**.',
    ].join('\n')

    const wrapper = await mountEditor(doc)
    const editor = wrapper.vm.editor

    // find ProseMirror positions for 1st and 3rd list item text nodes
    const textNodes: { pos: number, end: number, text: string }[] = []
    editor.state.doc.descendants((node: any, pos: number) => {
      if (!node.isText) return true
      textNodes.push({ pos, end: pos + node.text!.length, text: node.text! })
      return true
    })

    // list item text nodes start after the heading ("Key Takeaways")
    const listTextNodes = textNodes.filter(t => t.text !== 'Key Takeaways')

    // items have bold so: item1 = ["First item about ", "thought experiments", "."]
    // item2 = ["Second item about ", "quantum mechanics", "."]
    // item3 = ["Third item about ", "superposition", "."]
    // = 9 text nodes for first 3 items (indices 0-8)
    const from = listTextNodes[0].pos
    const to = listTextNodes[8].end

    editor.commands.setTextSelection({ from, to })
    wrapper.vm.replaceSelection('- Collapsed single item about **quantum physics**.')

    const markdown = editor.getMarkdown()
    expect(markdown).toContain('Key Takeaways')
    expect(markdown).toContain('Collapsed single item')
    expect(markdown).toContain('quantum physics')
    expect(markdown).toContain('Fourth item')
    expect(markdown).toContain('Fifth item')
    expect(markdown).not.toContain('First item')
    expect(markdown).not.toContain('Second item')
    expect(markdown).not.toContain('Third item')
  })

})
