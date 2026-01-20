import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useWindowMock } from '../../mocks/window'
import { exportToDocx, saveDocxBlob } from '@services/docx'

beforeEach(() => {
  useWindowMock()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exportToDocx', () => {

  test('should export empty content', async () => {
    const blob = await exportToDocx({
      title: 'Test Document',
      content: '',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  test('should export simple paragraph', async () => {
    const blob = await exportToDocx({
      title: 'Test Document',
      content: 'Hello, world!',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export heading levels', async () => {
    const content = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export bold and italic text', async () => {
    const content = `This is **bold** and this is *italic* and this is ***bold italic***.`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export strikethrough text', async () => {
    const content = `This is ~~strikethrough~~ text.`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export bullet list', async () => {
    const content = `- Item 1
- Item 2
- Item 3`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export ordered list', async () => {
    const content = `1. First item
2. Second item
3. Third item`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export nested list', async () => {
    const content = `- Item 1
  - Nested item 1.1
  - Nested item 1.2
- Item 2`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export code block', async () => {
    const content = `\`\`\`javascript
function hello() {
  console.log('Hello, world!');
}
\`\`\``

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export inline code', async () => {
    const content = 'Use the `console.log()` function to print output.'

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export blockquote', async () => {
    const content = `> This is a blockquote.
> It can span multiple lines.`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export horizontal rule', async () => {
    const content = `First section

---

Second section`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export links', async () => {
    const content = `Visit [Google](https://google.com) for more information.`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export table', async () => {
    const content = `| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export complex document', async () => {
    const content = `# Project Documentation

## Introduction

This is a **bold** statement and this is *italic*.

## Features

- Feature 1
- Feature 2
  - Sub-feature 2.1
  - Sub-feature 2.2
- Feature 3

## Code Example

\`\`\`typescript
const greeting = 'Hello, world!';
console.log(greeting);
\`\`\`

## Data Table

| Name | Value |
| ---- | ----- |
| Alpha | 100 |
| Beta | 200 |

> This is an important note.

For more info, visit [our website](https://example.com).`

    const blob = await exportToDocx({
      title: 'Project Documentation',
      content,
      author: 'Test Author',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should handle special characters', async () => {
    const content = `Special chars: & < > " ' © ® ™ € £ ¥`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should handle unicode content', async () => {
    const content = `Unicode: 你好世界 🌍 Привет мир مرحبا بالعالم`

    const blob = await exportToDocx({
      title: 'Unicode Test',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should handle image placeholder', async () => {
    const content = `![Alt text](https://example.com/image.png)`

    const blob = await exportToDocx({
      title: 'Test Document',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

})

describe('saveDocxBlob', () => {

  let mockClick: ReturnType<typeof vi.fn>
  let downloadFilename: string
  let downloadHref: string

  beforeEach(() => {
    mockClick = vi.fn()
    downloadFilename = ''
    downloadHref = ''

    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(value: string) { downloadHref = value },
      get href() { return downloadHref },
      set download(value: string) { downloadFilename = value },
      get download() { return downloadFilename },
      click: mockClick,
    } as unknown as HTMLAnchorElement)

    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  test('should trigger download with correct filename', () => {
    const testBlob = new Blob(['test content'], { type: 'application/octet-stream' })

    saveDocxBlob(testBlob, 'test-file')

    expect(URL.createObjectURL).toHaveBeenCalledWith(testBlob)
    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(mockClick).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
  })

  test('should add .docx extension if missing', () => {
    const testBlob = new Blob(['test content'], { type: 'application/octet-stream' })

    saveDocxBlob(testBlob, 'test-file')

    expect(downloadFilename).toBe('test-file.docx')
  })

  test('should not duplicate .docx extension', () => {
    const testBlob = new Blob(['test content'], { type: 'application/octet-stream' })

    saveDocxBlob(testBlob, 'test-file.docx')

    expect(downloadFilename).toBe('test-file.docx')
  })

})
