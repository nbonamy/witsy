import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useWindowMock } from '../../mocks/window'
import { exportToPptx, savePptxBlob } from '@services/pptx'

beforeEach(() => {
  useWindowMock()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exportToPptx', () => {

  test('should export empty content', async () => {
    const blob = await exportToPptx({
      title: 'Test Presentation',
      content: '',
    })

    expect(blob).toBeInstanceOf(Blob)
  })

  test('should export simple paragraph as single slide', async () => {
    const blob = await exportToPptx({
      title: 'Test Presentation',
      content: 'Hello, world!',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should create slides from H1 headings', async () => {
    const content = `# Slide 1
Content for slide 1

# Slide 2
Content for slide 2

# Slide 3
Content for slide 3`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should create slides from H2 headings', async () => {
    const content = `## Section 1
Content for section 1

## Section 2
Content for section 2`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should handle H3+ as bullets within slide', async () => {
    const content = `# Main Slide

### Subsection 1
Some content

### Subsection 2
More content`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export bullet lists', async () => {
    const content = `# Features

- Feature 1
- Feature 2
- Feature 3`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export ordered lists', async () => {
    const content = `# Steps

1. First step
2. Second step
3. Third step`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export nested lists', async () => {
    const content = `# Outline

- Item 1
  - Sub-item 1.1
  - Sub-item 1.2
- Item 2`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export code blocks', async () => {
    const content = `# Code Example

\`\`\`javascript
function hello() {
  console.log('Hello');
}
\`\`\``

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export tables', async () => {
    const content = `# Data Table

| Name | Value |
| ---- | ----- |
| Alpha | 100 |
| Beta | 200 |`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should export complex presentation', async () => {
    const content = `# Project Overview

Introduction to the project

## Goals

- Goal 1
- Goal 2
- Goal 3

## Implementation

\`\`\`typescript
const x = 1;
\`\`\`

## Data

| Metric | Value |
| ------ | ----- |
| Users | 1000 |
| Revenue | $50k |

## Conclusion

Summary points`

    const blob = await exportToPptx({
      title: 'Project Overview',
      content,
      author: 'Test Author',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should strip markdown formatting from text', async () => {
    const content = `# Title with **bold** and *italic*

This is **bold** and this is *italic* and this is \`code\`.

Check [this link](https://example.com).`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

})

describe('exportToPptx - Marp mode', () => {

  test('should parse Marp content with frontmatter', async () => {
    const content = `---
marp: true
theme: default
---

# Slide 1

Content for slide 1

---

# Slide 2

Content for slide 2`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
      isMarp: true,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should parse Marp slides separated by ---', async () => {
    const content = `# First Slide

Bullet point 1

---

# Second Slide

Bullet point 2

---

# Third Slide

Bullet point 3`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
      isMarp: true,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should handle Marp slide with only content (no title)', async () => {
    const content = `---
marp: true
---

Just some content without a heading

---

# Titled Slide

With content`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
      isMarp: true,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should handle Marp lists', async () => {
    const content = `---
marp: true
---

# Features

- Feature A
- Feature B
- Feature C

---

# More Features

1. First
2. Second
3. Third`

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
      isMarp: true,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('should handle Marp code blocks', async () => {
    const content = `---
marp: true
---

# Code

\`\`\`python
print("Hello")
\`\`\`

---

# More Code

\`\`\`javascript
console.log('World');
\`\`\``

    const blob = await exportToPptx({
      title: 'Test Presentation',
      content,
      isMarp: true,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

})

describe('savePptxBlob', () => {

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

    savePptxBlob(testBlob, 'test-file')

    expect(URL.createObjectURL).toHaveBeenCalledWith(testBlob)
    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(mockClick).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
  })

  test('should add .pptx extension if missing', () => {
    const testBlob = new Blob(['test content'], { type: 'application/octet-stream' })

    savePptxBlob(testBlob, 'test-file')

    expect(downloadFilename).toBe('test-file.pptx')
  })

  test('should not duplicate .pptx extension', () => {
    const testBlob = new Blob(['test content'], { type: 'application/octet-stream' })

    savePptxBlob(testBlob, 'test-file.pptx')

    expect(downloadFilename).toBe('test-file.pptx')
  })

})
