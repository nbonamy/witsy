import { vi, beforeAll, beforeEach, expect, test, describe } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import { computeBlocks, computeBlocksIncremental, ComputeBlocksOptions } from '@services/message_block_parser'
import { ToolCall } from 'types/index'

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.chatState.filter = null
})

const defaultOptions: ComputeBlocksOptions = {
  role: 'assistant',
  transient: false,
  toolCalls: [],
  showToolCalls: 'never'
}

const userOptions: ComputeBlocksOptions = {
  ...defaultOptions,
  role: 'user'
}

describe('computeBlocks - empty/null content', () => {

  test('returns empty array for null content', () => {
    const blocks = computeBlocks(null, defaultOptions)
    expect(blocks).toEqual([])
  })

  test('returns empty array for empty string', () => {
    const blocks = computeBlocks('', defaultOptions)
    expect(blocks).toEqual([])
  })

  test('returns empty array for whitespace-only content', () => {
    const blocks = computeBlocks('   ', defaultOptions)
    expect(blocks).toEqual([])
  })

  test('returns empty array for newlines-only content', () => {
    const blocks = computeBlocks('\n\n\n', defaultOptions)
    expect(blocks).toEqual([])
  })

})

describe('computeBlocks - user messages', () => {

  test('splits user content by newlines', () => {
    const blocks = computeBlocks('Hello\nWorld', userOptions)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ type: 'text', content: 'Hello' })
    expect(blocks[1]).toMatchObject({ type: 'text', content: 'World' })
  })

  test('does not parse special blocks for user messages', () => {
    const content = 'Check this ![image](http://example.com/img.png)'
    const blocks = computeBlocks(content, userOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'text', content })
  })

  test('user blocks have correct positions', () => {
    const blocks = computeBlocks('Hello\nWorld', userOptions)
    expect(blocks[0]).toMatchObject({ start: 0, end: 5, stable: true })
    expect(blocks[1]).toMatchObject({ start: 6, end: 11, stable: true })
  })

})

describe('computeBlocks - text content', () => {

  test('returns single text block for plain text', () => {
    const blocks = computeBlocks('Hello world', defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'text', content: 'Hello world' })
  })

  test('preserves markdown formatting', () => {
    const content = '**bold** and *italic*'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'text', content })
  })

  test('text block is stable when not transient', () => {
    const blocks = computeBlocks('Hello world', defaultOptions)
    expect(blocks[0]).toMatchObject({ stable: true })
  })

  test('text block is unstable when transient', () => {
    const options = { ...defaultOptions, transient: true }
    const blocks = computeBlocks('Hello world', options)
    expect(blocks[0]).toMatchObject({ stable: false })
  })

})

describe('computeBlocks - media (markdown images)', () => {

  test('parses markdown image with http URL', () => {
    const blocks = computeBlocks('![alt text](http://example.com/image.png)', defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'media',
      url: 'http://example.com/image.png',
      desc: 'alt text',
      prompt: null
    })
  })

  test('parses markdown image with file:// URL', () => {
    const blocks = computeBlocks('![photo](file:///path/to/image.jpg)', defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'media',
      url: 'file:///path/to/image.jpg',
      desc: 'photo',
      prompt: null
    })
  })

  test('adds file:// prefix for local paths', () => {
    const blocks = computeBlocks('![img](/path/to/image.png)', defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'media',
      url: 'file:///path/to/image.png',
      desc: 'img',
      prompt: null
    })
  })

  test('parses data URL images', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo='
    const blocks = computeBlocks(`![base64](${dataUrl})`, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'media',
      url: dataUrl,
      desc: 'base64',
      prompt: null
    })
  })

  test('extracts text before and after image', () => {
    const blocks = computeBlocks('Before ![img](http://a.com/i.png) After', defaultOptions)
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ type: 'text', content: 'Before ' })
    expect(blocks[1].type).toBe('media')
    expect(blocks[2]).toMatchObject({ type: 'text', content: ' After' })
  })

  test('does not parse images inside markdown links', () => {
    const content = '[![alt](http://example.com/img.png)](http://link.com)'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
  })

  test('finds prompt from toolCalls for image', () => {
    const toolCalls: ToolCall[] = [{
      id: '1',
      function: 'generate_image',
      done: true,
      args: { prompt: 'A beautiful sunset' },
      result: { path: '/generated/image.png' }
    }]
    const options = { ...defaultOptions, toolCalls }
    const blocks = computeBlocks('![result](/generated/image.png)', options)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'media',
      url: 'file:///generated/image.png',
      desc: 'result',
      prompt: 'A beautiful sunset'
    })
  })

  test('media blocks are always stable', () => {
    const options = { ...defaultOptions, transient: true }
    const blocks = computeBlocks('![img](http://a.com/i.png)', options)
    expect(blocks[0]).toMatchObject({ type: 'media', stable: true })
  })

})

describe('computeBlocks - media (HTML img/video)', () => {

  test('parses HTML img tag', () => {
    const blocks = computeBlocks('<img src="http://example.com/photo.jpg">', defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'media',
      url: 'http://example.com/photo.jpg',
      desc: 'Video',
      prompt: null
    })
  })

  test('parses HTML video tag', () => {
    const blocks = computeBlocks('<video src="http://example.com/video.mp4">', defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'media',
      url: 'http://example.com/video.mp4',
      desc: 'Video',
      prompt: null
    })
  })

  test('handles img tag with additional attributes', () => {
    const blocks = computeBlocks('<img alt="test" src="http://a.com/b.png" width="100">', defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('media')
    expect((blocks[0] as any).url).toBe('http://a.com/b.png')
  })

})

describe('computeBlocks - artifacts', () => {

  test('parses artifact with title and content', () => {
    const content = '<artifact title="My Code">console.log("hello")</artifact>'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'artifact',
      title: 'My Code',
      content: 'console.log("hello")'
    })
  })

  test('parses artifact with multiline content', () => {
    const artifactContent = `function test() {
  return 42;
}`
    const content = `<artifact title="Function">${artifactContent}</artifact>`
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'artifact',
      title: 'Function',
      content: artifactContent
    })
  })

  test('detects HTML artifact and creates html block', () => {
    const htmlContent = '<!DOCTYPE html><html><body>Hello</body></html>'
    const content = `<artifact title="Page">${htmlContent}</artifact>`
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'html',
      title: 'Page',
      content: htmlContent
    })
  })

  test('detects HTML artifact with html code block', () => {
    const htmlContent = '```html\n<div>Hello</div>\n```'
    const content = `<artifact title="Snippet">${htmlContent}</artifact>`
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('html')
  })

  test('auto-closes unclosed artifact tags', () => {
    const content = '<artifact title="Partial">incomplete content'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('artifact')
    expect((blocks[0] as any).content).toBe('incomplete content')
  })

  test('extracts text before artifact', () => {
    const content = 'Here is the code:\n<artifact title="Code">x = 1</artifact>'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ type: 'text', content: 'Here is the code:\n' })
    expect(blocks[1].type).toBe('artifact')
  })

  test('closed artifact is stable', () => {
    const content = '<artifact title="Code">x = 1</artifact>'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks[0]).toMatchObject({ type: 'artifact', stable: true })
  })

  test('auto-closed artifact is unstable', () => {
    const content = '<artifact title="Partial">incomplete content'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks[0]).toMatchObject({ type: 'artifact', stable: false })
  })

})

describe('computeBlocks - tables', () => {

  test('parses markdown table', () => {
    const content = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('table')
    expect((blocks[0] as any).content).toContain('<table')
  })

  test('parses table with alignment', () => {
    const content = `| Left | Center | Right |
|:---|:---:|---:|
| A | B | C |`
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('table')
  })

  test('extracts text before and after table', () => {
    const content = `Some text

| A | B |
|---|---|
| 1 | 2 |

More text`
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    expect(blocks[0].type).toBe('text')
    expect(blocks.some(b => b.type === 'table')).toBe(true)
  })

})

describe('computeBlocks - tool calls', () => {

  test('does not render tool block when showToolCalls is default', () => {
    const toolCalls: ToolCall[] = [{
      id: 'tool-1',
      function: 'calculator',
      done: true,
      args: {},
      result: { value: 42 }
    }]
    const options = { ...defaultOptions, toolCalls, showToolCalls: 'never' as const }
    const blocks = computeBlocks('<tool id="tool-1"></tool>', options)
    expect(blocks).toHaveLength(0)
  })

  test('renders tool block when showToolCalls is always', () => {
    const toolCalls: ToolCall[] = [{
      id: 'tool-1',
      function: 'calculator',
      done: true,
      args: {},
      result: { value: 42 }
    }]
    const options = { ...defaultOptions, toolCalls, showToolCalls: 'always' as const }
    const blocks = computeBlocks('<tool id="tool-1"></tool>', options)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'tool', toolCall: toolCalls[0] })
  })

  test('renders search block for search plugin', () => {
    const toolCalls: ToolCall[] = [{
      id: 'search-1',
      function: 'search_internet',
      done: true,
      args: { query: 'test' },
      result: { results: [] }
    }]
    const options = { ...defaultOptions, toolCalls }
    const blocks = computeBlocks('<tool id="search-1"></tool>', options)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'search', toolCall: toolCalls[0] })
  })

  test('matches tool by index', () => {
    const toolCalls: ToolCall[] = [{
      id: 'any-id',
      function: 'some_tool',
      done: true,
      args: {},
      result: {}
    }]
    const options = { ...defaultOptions, toolCalls, showToolCalls: 'always' as const }
    const blocks = computeBlocks('<tool index="0"></tool>', options)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'tool', toolCall: toolCalls[0] })
  })

  test('tool blocks are always stable', () => {
    const toolCalls: ToolCall[] = [{
      id: 'tool-1',
      function: 'calculator',
      done: true,
      args: {},
      result: { value: 42 }
    }]
    const options = { ...defaultOptions, toolCalls, showToolCalls: 'always' as const, transient: true }
    const blocks = computeBlocks('<tool id="tool-1"></tool>', options)
    expect(blocks[0]).toMatchObject({ type: 'tool', stable: true })
  })

  test('does not render tool block if tool not done', () => {
    const toolCalls: ToolCall[] = [{
      id: 'tool-1',
      function: 'calculator',
      done: false,
      args: {},
      result: null
    }]
    const options = { ...defaultOptions, toolCalls, showToolCalls: 'always' as const }
    const blocks = computeBlocks('<tool id="tool-1"></tool>', options)
    expect(blocks).toHaveLength(0)
  })

})

describe('computeBlocks - code blocks protection', () => {

  test('does not parse image inside code block', () => {
    const content = '```\n![image](http://example.com/img.png)\n```'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
    expect((blocks[0] as any).content).toContain('![image]')
  })

  test('does not parse artifact inside code block', () => {
    const content = '```xml\n<artifact title="test">content</artifact>\n```'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
  })

  test('does not parse table inside code block', () => {
    const content = '```\n| A | B |\n|---|---|\n| 1 | 2 |\n```'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
  })

  test('parses content after code block', () => {
    const content = '```\ncode\n```\n![image](http://a.com/b.png)'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('text')
    expect(blocks[1].type).toBe('media')
  })

})

describe('computeBlocks - mixed content', () => {

  test('parses multiple images', () => {
    const content = '![a](http://a.com/1.png) and ![b](http://b.com/2.png)'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].type).toBe('media')
    expect(blocks[1].type).toBe('text')
    expect(blocks[2].type).toBe('media')
  })

  test('parses image and artifact together', () => {
    const content = '![img](http://a.com/i.png)\n<artifact title="Code">x=1</artifact>'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].type).toBe('media')
    expect(blocks[1].type).toBe('text')
    expect(blocks[2].type).toBe('artifact')
  })

  test('handles complex mixed content', () => {
    const content = `Here is an image:
![photo](http://example.com/photo.jpg)

And here is some code:
<artifact title="Example">
function hello() {
  console.log("world");
}
</artifact>

| Name | Value |
|------|-------|
| A    | 1     |

That's all!`
    const blocks = computeBlocks(content, defaultOptions)

    const types = blocks.map(b => b.type)
    expect(types).toContain('text')
    expect(types).toContain('media')
    expect(types).toContain('artifact')
    expect(types).toContain('table')
  })

})

describe('computeBlocks - transient messages', () => {

  test('closes open markdown tags for transient messages', () => {
    const options = { ...defaultOptions, transient: true }
    const content = '**bold text'
    const blocks = computeBlocks(content, options)
    expect(blocks).toHaveLength(1)
    // The closeOpenMarkdownTags should have closed the **
    expect((blocks[0] as any).content).toBe('**bold text**')
  })

  test('closes open code block for transient messages', () => {
    const options = { ...defaultOptions, transient: true }
    const content = '```javascript\nconst x = 1'
    const blocks = computeBlocks(content, options)
    expect(blocks).toHaveLength(1)
    expect((blocks[0] as any).content).toContain('```')
  })

})

describe('computeBlocks - search highlighting', () => {

  test('highlights search term in table content', () => {
    store.chatState.filter = 'test'
    const content = `| Header |
|--------|
| test value |`
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('table')
    expect((blocks[0] as any).content).toContain('<mark>test</mark>')
  })

})

describe('computeBlocks - BlockMeta positions', () => {

  test('tracks positions for single block', () => {
    const content = 'Hello world'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks[0]).toMatchObject({
      start: 0,
      end: 11
    })
  })

  test('tracks positions for text before special block', () => {
    const content = 'Before ![img](http://a.com/i.png)'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks[0]).toMatchObject({ type: 'text', start: 0, end: 7 })
    expect(blocks[1]).toMatchObject({ type: 'media', start: 7, end: 33 })
  })

  test('tracks positions for multiple blocks', () => {
    const content = '![a](http://a.com/1.png) and ![b](http://b.com/2.png)'
    const blocks = computeBlocks(content, defaultOptions)
    expect(blocks[0]).toMatchObject({ type: 'media', start: 0, end: 24 })
    expect(blocks[1]).toMatchObject({ type: 'text', start: 24, end: 29 })
    expect(blocks[2]).toMatchObject({ type: 'media', start: 29, end: 53 })
  })

  test('text before matched block is stable', () => {
    const options = { ...defaultOptions, transient: true }
    const content = 'Before text ![img](http://a.com/i.png) more text'
    const blocks = computeBlocks(content, options)
    // "Before text " - before the media, should be stable
    expect(blocks[0]).toMatchObject({ type: 'text', stable: true })
    // media is stable
    expect(blocks[1]).toMatchObject({ type: 'media', stable: true })
    // " more text" - at the end, should be unstable during streaming
    expect(blocks[2]).toMatchObject({ type: 'text', stable: false })
  })

  test('table blocks are stable', () => {
    const content = `| A | B |
|---|---|
| 1 | 2 |`
    const options = { ...defaultOptions, transient: true }
    const blocks = computeBlocks(content, options)
    expect(blocks[0]).toMatchObject({ type: 'table', stable: true })
  })

})

describe('computeBlocksIncremental', () => {

  const transientOptions: ComputeBlocksOptions = {
    ...defaultOptions,
    transient: true
  }

  test('returns full computation when no previous blocks', () => {
    const content = 'Hello world'
    const blocks = computeBlocksIncremental(content, transientOptions, [])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'text', content: 'Hello world' })
  })

  test('returns full computation when not transient', () => {
    const content = 'Hello world'
    const previousBlocks = computeBlocks('Hello', transientOptions)
    const blocks = computeBlocksIncremental(content, defaultOptions, previousBlocks)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'text', content: 'Hello world' })
  })

  test('reuses stable media block when content is appended', () => {
    // Initial content with a stable media block
    const content1 = '![img](http://a.com/i.png)'
    const blocks1 = computeBlocks(content1, transientOptions)
    expect(blocks1[0]).toMatchObject({ type: 'media', stable: true })

    // Append more content
    const content2 = '![img](http://a.com/i.png) More text'
    const blocks2 = computeBlocksIncremental(content2, transientOptions, blocks1)

    expect(blocks2).toHaveLength(2)
    // First block should be the same object reference (reused)
    expect(blocks2[0]).toBe(blocks1[0])
    expect(blocks2[1]).toMatchObject({ type: 'text', content: ' More text' })
  })

  test('reuses multiple stable blocks', () => {
    const content1 = '![a](http://a.com/1.png) and ![b](http://b.com/2.png)'
    const blocks1 = computeBlocks(content1, transientOptions)
    expect(blocks1).toHaveLength(3)

    // Append more content
    const content2 = content1 + ' trailing text'
    const blocks2 = computeBlocksIncremental(content2, transientOptions, blocks1)

    expect(blocks2.length).toBeGreaterThanOrEqual(3)
    // Stable blocks should be reused
    expect(blocks2[0]).toBe(blocks1[0])
    expect(blocks2[1]).toBe(blocks1[1])
    expect(blocks2[2]).toBe(blocks1[2])
  })

  test('does not reuse unstable text block', () => {
    const content1 = 'Streaming text'
    const blocks1 = computeBlocks(content1, transientOptions)
    expect(blocks1[0]).toMatchObject({ type: 'text', stable: false })

    // Append more content
    const content2 = 'Streaming text continues...'
    const blocks2 = computeBlocksIncremental(content2, transientOptions, blocks1)

    // Should be a new block (content changed)
    expect(blocks2[0]).not.toBe(blocks1[0])
    expect(blocks2[0]).toMatchObject({ type: 'text', content: 'Streaming text continues...' })
  })

  test('handles empty content', () => {
    const blocks1 = computeBlocks('Hello', transientOptions)
    const blocks2 = computeBlocksIncremental('', transientOptions, blocks1)
    expect(blocks2).toEqual([])
  })

  test('handles null content', () => {
    const blocks1 = computeBlocks('Hello', transientOptions)
    const blocks2 = computeBlocksIncremental(null, transientOptions, blocks1)
    expect(blocks2).toEqual([])
  })

  test('reuses stable artifact block', () => {
    const content1 = '<artifact title="Code">x = 1</artifact>'
    const blocks1 = computeBlocks(content1, transientOptions)
    expect(blocks1[0]).toMatchObject({ type: 'artifact', stable: true })

    // Append more content
    const content2 = content1 + '\nMore text'
    const blocks2 = computeBlocksIncremental(content2, transientOptions, blocks1)

    expect(blocks2[0]).toBe(blocks1[0])
  })

  test('does not reuse unstable (auto-closed) artifact', () => {
    const content1 = '<artifact title="Code">partial'
    const blocks1 = computeBlocks(content1, transientOptions)
    expect(blocks1[0]).toMatchObject({ type: 'artifact', stable: false })

    // Content continues
    const content2 = '<artifact title="Code">partial content continues'
    const blocks2 = computeBlocksIncremental(content2, transientOptions, blocks1)

    // Unstable block should be recomputed
    expect(blocks2[0]).not.toBe(blocks1[0])
  })

})
