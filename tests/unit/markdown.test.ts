
import { test, expect } from 'vitest'
import { renderMarkdown } from '../../src/main/markdown'

test('renders markdown', () => {
  const markdown = '# Hello World'
  const html = renderMarkdown(markdown)
  expect(html).toContain('<h1>Hello World</h1>')
})

test('renders local links', () => {
  const markdown = '[link](file://README.md)'
  const html = renderMarkdown(markdown)
  expect(html).toBe('<p><a href="file://README.md">link</a></p>\n')
})

test('renders external links', () => {
  const markdown = '[link](https://example.com)'
  const html = renderMarkdown(markdown)
  expect(html).toBe('<p><a href="https://example.com">link</a></p>\n')
})

test('renders inline code', () => {
  const markdown = 'This is `inline code`'
  const html = renderMarkdown(markdown)
  expect(html).toContain('<p>This is <code>inline code</code></p>')
})

test('renders typed code block', () => {
  const markdown = '```python\nprint("Hello World")\n```'
  const html = renderMarkdown(markdown)
  const lines = html.split('\n')
  expect(lines.length).toBe(3)
  expect(lines[0]).toBe('<pre class="hljs"><code class="hljs variable-font-size"><span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;Hello World&quot;</span>)')
  expect(lines[1]).toBe('</code></pre><p><a href="#" onclick="navigator.clipboard.writeText(window.api.base64.decode(\'cHJpbnQoIkhlbGxvIFdvcmxkIikK\'));this.innerHTML = \'Copied!\'; setTimeout(() => this.innerHTML = \'Copy code\', 1000); return false;" class="copy">Copy code</a></p>')
  expect(lines[2]).toBe('')
})

test('renders auto code block', () => {
  const markdown = '```\nprint("Hello World")\n```'
  const html = renderMarkdown(markdown)
  const lines = html.split('\n')
  expect(lines.length).toBe(3)
  expect(lines[0]).toBe('<pre class="hljs"><code class="hljs variable-font-size"><span class="hljs-function"><span class="hljs-title">print</span><span class="hljs-params">(<span class="hljs-string">&quot;Hello World&quot;</span>)</span></span>')
  expect(lines[1]).toBe('</code></pre><p><a href="#" onclick="navigator.clipboard.writeText(window.api.base64.decode(\'cHJpbnQoIkhlbGxvIFdvcmxkIikK\'));this.innerHTML = \'Copied!\'; setTimeout(() => this.innerHTML = \'Copy code\', 1000); return false;" class="copy">Copy code</a></p>')
  expect(lines[2]).toBe('')
})

test('renders inline math', () => {
  const markdown = '\\( \\theta^2 \\)'
  const html = renderMarkdown(markdown)
  expect(html).toContain('θ')
})

test('renders block math', () => {
  const markdown = '\\[ \\theta^2 \\]'
  const html = renderMarkdown(markdown)
  expect(html).toContain('θ')
})
