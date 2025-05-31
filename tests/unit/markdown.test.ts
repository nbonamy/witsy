import { test, expect } from 'vitest'
import { renderMarkdown } from '../../src/main/markdown'
import { closeOpenMarkdownTags } from '../../src/services/markdown'

test('renders markdown', () => {
  const markdown = '# Hello World'
  const html = renderMarkdown(markdown)
  expect(html).toContain('<h1>Hello World</h1>')
})

test('does not render html', () => {
  const markdown = '<h1>Hello World</h1>'
  const html = renderMarkdown(markdown)
  expect(html).toContain('<p>&lt;h1&gt;Hello World&lt;/h1&gt;</p>')
})

// test('renders deeplinks', () => {
//   const markdown = 'Click <a href="#section">here</a>'
//   const html = renderMarkdown(markdown)
//   expect(html).toContain('<p>Click <a href="#section">here</a></p>')
// })

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
  expect(lines[1]).toBe('</code></pre><p><a onclick="navigator.clipboard.writeText(window.api.base64.decode(\'cHJpbnQoIkhlbGxvIFdvcmxkIikK\'));this.innerHTML = \'Copied!\'; setTimeout(() => this.innerHTML = \'Copy code\', 1000); return false;" class="copy">Copy code</a></p>')
  expect(lines[2]).toBe('')
})

test('renders auto code block', () => {
  const markdown = '```\nprint("Hello World")\n```'
  const html = renderMarkdown(markdown)
  const lines = html.split('\n')
  expect(lines.length).toBe(3)
  expect(lines[0]).toBe('<pre class="hljs"><code class="hljs variable-font-size"><span class="hljs-function"><span class="hljs-title">print</span><span class="hljs-params">(<span class="hljs-string">&quot;Hello World&quot;</span>)</span></span>')
  expect(lines[1]).toBe('</code></pre><p><a onclick="navigator.clipboard.writeText(window.api.base64.decode(\'cHJpbnQoIkhlbGxvIFdvcmxkIikK\'));this.innerHTML = \'Copied!\'; setTimeout(() => this.innerHTML = \'Copy code\', 1000); return false;" class="copy">Copy code</a></p>')
  expect(lines[2]).toBe('')
})

test('renders inline math', () => {
  const markdown = '\\( \\theta^2 \\) \\(\\alpha^2\\)'
  const html = renderMarkdown(markdown)
  expect(html).toContain('θ')
  expect(html).toContain('α')
})

test('renders block math', () => {
  const markdown = '\\[ \\theta^2 \\]'
  const html = renderMarkdown(markdown)
  expect(html).toContain('θ')
})

test('render <think>', () => {
  const markdown = '<think>Thinking</think>'
  const html = renderMarkdown(markdown)
  expect(html).toContain('<p><think>Thinking</think></p>')
})

test('render mix', () => {
  const markdown = '<think>Reasoning...</think># <b>instructions.default:\n"Title"</b>'
  const html = renderMarkdown(markdown)
  expect(html).toContain('<p><think>Reasoning...</think># &lt;b&gt;instructions.default:\n&quot;Title&quot;&lt;/b&gt;</p>')
})

test('close open markdowntags', () => {

  // invalid
  expect(closeOpenMarkdownTags('This is bold text**')).toBe('This is bold text**')
  expect(closeOpenMarkdownTags('This is bold text*')).toBe('This is bold text*')
  expect(closeOpenMarkdownTags('This is bold text')).toBe('This is bold text')

  // simple cases
  expect(closeOpenMarkdownTags('This is **bold text**')).toBe('This is **bold text**')
  expect(closeOpenMarkdownTags('This is **bold text*')).toBe('This is **bold text**')
  expect(closeOpenMarkdownTags('This is **bold text')).toBe('This is **bold text**')

  // nested cases
  expect(closeOpenMarkdownTags('This is **bold *nested* text**')).toBe('This is **bold *nested* text**')
  // expect(closeOpenMarkdownTags('This is **bold *nested* text*')).toBe('This is **bold *nested* text**')
  expect(closeOpenMarkdownTags('This is **bold *nested* text')).toBe('This is **bold *nested* text**')
  expect(closeOpenMarkdownTags('This is **bold *nested*')).toBe('This is **bold *nested***')
  expect(closeOpenMarkdownTags('This is **bold *nested')).toBe('This is **bold *nested***')

  // inline code cases
  expect(closeOpenMarkdownTags('This is `inline code')).toBe('This is `inline code`')
  expect(closeOpenMarkdownTags('This is `inline **code')).toBe('This is `inline **code`')
  expect(closeOpenMarkdownTags('This is `inline **code*')).toBe('This is `inline **code*`')
  expect(closeOpenMarkdownTags('This is `inline **code**')).toBe('This is `inline **code**`')

  // inline code cases
  expect(closeOpenMarkdownTags('This is ```inline code')).toBe('This is ```inline code```')
  expect(closeOpenMarkdownTags('This is ```inline **code')).toBe('This is ```inline **code```')
  expect(closeOpenMarkdownTags('This is ```inline **code*')).toBe('This is ```inline **code*```')
  expect(closeOpenMarkdownTags('This is ```inline **code**')).toBe('This is ```inline **code**```')

  // links
  expect(closeOpenMarkdownTags('[link](file://README.md)')).toBe('[link](file://README.md)')
  expect(closeOpenMarkdownTags('[link](https://example.com')).toBe('[link](https://example.com)')
  expect(closeOpenMarkdownTags('[link]')).toBe('[link]')
  expect(closeOpenMarkdownTags('[link')).toBe('[link]')

  // Underscore formatting (equivalent to asterisk)
  expect(closeOpenMarkdownTags('This is __bold text__')).toBe('This is __bold text__')
  expect(closeOpenMarkdownTags('This is __bold text_')).toBe('This is __bold text__')
  expect(closeOpenMarkdownTags('This is __bold text')).toBe('This is __bold text__')
  expect(closeOpenMarkdownTags('This is _italic text_')).toBe('This is _italic text_')
  expect(closeOpenMarkdownTags('This is _italic text')).toBe('This is _italic text_')

  // Mixed asterisk and underscore
  expect(closeOpenMarkdownTags('This is **bold _italic_**')).toBe('This is **bold _italic_**')
  expect(closeOpenMarkdownTags('This is **bold _italic_')).toBe('This is **bold _italic_**')
  expect(closeOpenMarkdownTags('This is **bold _italic')).toBe('This is **bold _italic_**')
  expect(closeOpenMarkdownTags('This is _italic **bold**_')).toBe('This is _italic **bold**_')
  expect(closeOpenMarkdownTags('This is _italic **bold**')).toBe('This is _italic **bold**_')
  expect(closeOpenMarkdownTags('This is _italic **bold')).toBe('This is _italic **bold**_')

  // Tilde code blocks
  expect(closeOpenMarkdownTags('~~~code block')).toBe('~~~code block~~~')
  expect(closeOpenMarkdownTags('~~~python\nprint("hello")')).toBe('~~~python\nprint("hello")~~~')
  expect(closeOpenMarkdownTags('~~~\n**bold inside code**')).toBe('~~~\n**bold inside code**~~~')

  // Mixed code block types
  expect(closeOpenMarkdownTags('```code\n~~~nested')).toBe('```code\n~~~nested```')
  expect(closeOpenMarkdownTags('~~~code\n```nested')).toBe('~~~code\n```nested~~~')

  // Multiple unclosed tags
  expect(closeOpenMarkdownTags('**bold _italic `code')).toBe('**bold _italic `code`_**')
  expect(closeOpenMarkdownTags('_italic **bold `code')).toBe('_italic **bold `code`**_')

  // Code blocks with markdown inside (should not process internal markdown)
  expect(closeOpenMarkdownTags('```\n**this should not be processed**\n*neither this*')).toBe('```\n**this should not be processed**\n*neither this*```')
  expect(closeOpenMarkdownTags('`**bold inside inline code**')).toBe('`**bold inside inline code**`')

  // Empty tags at end of input (should not be stacked)
  expect(closeOpenMarkdownTags('Text **')).toBe('Text **')
  expect(closeOpenMarkdownTags('Text *')).toBe('Text *')
  expect(closeOpenMarkdownTags('Text `')).toBe('Text `')
  expect(closeOpenMarkdownTags('Text ```')).toBe('Text ```')
  expect(closeOpenMarkdownTags('Text ~~~')).toBe('Text ~~~')

  // Link edge cases
  expect(closeOpenMarkdownTags('[text](url')).toBe('[text](url)')
  expect(closeOpenMarkdownTags('[text](')).toBe('[text]()')
  expect(closeOpenMarkdownTags('[text]')).toBe('[text]')
  expect(closeOpenMarkdownTags('[incomplete')).toBe('[incomplete]')
  expect(closeOpenMarkdownTags('![image](url')).toBe('![image](url)')
  expect(closeOpenMarkdownTags('![image](')).toBe('![image]()')

  // Complex nested scenarios
  expect(closeOpenMarkdownTags('**bold with `code` inside**')).toBe('**bold with `code` inside**')
  expect(closeOpenMarkdownTags('**bold with `code` inside')).toBe('**bold with `code` inside**')
  expect(closeOpenMarkdownTags('**bold with `unclosed code')).toBe('**bold with `unclosed code`**')

  // Empty string and whitespace
  expect(closeOpenMarkdownTags('')).toBe('')
  expect(closeOpenMarkdownTags('   ')).toBe('   ')
  expect(closeOpenMarkdownTags('**   **')).toBe('**   **')

  // Single characters
  expect(closeOpenMarkdownTags('*')).toBe('*')
  expect(closeOpenMarkdownTags('`')).toBe('`')
  expect(closeOpenMarkdownTags('_')).toBe('_')

  // Multiple separate unclosed tags
  expect(closeOpenMarkdownTags('**bold and _italic')).toBe('**bold and _italic_**')
  expect(closeOpenMarkdownTags('_italic and **bold')).toBe('_italic and **bold**_')

  // Tags separated by completed tags
  expect(closeOpenMarkdownTags('**complete** and **incomplete')).toBe('**complete** and **incomplete**')
  expect(closeOpenMarkdownTags('_complete_ and _incomplete')).toBe('_complete_ and _incomplete_')

  // Code blocks preventing markdown processing
  expect(closeOpenMarkdownTags('```\n**should not close\n_should not close')).toBe('```\n**should not close\n_should not close```')
  expect(closeOpenMarkdownTags('`inline **bold _italic`')).toBe('`inline **bold _italic`')

  // Real-world streaming scenarios
  expect(closeOpenMarkdownTags('Here is some **bold text that is being stre')).toBe('Here is some **bold text that is being stre**')
  expect(closeOpenMarkdownTags('```python\ndef function():\n    print("hello"')).toBe('```python\ndef function():\n    print("hello"```')
  expect(closeOpenMarkdownTags('Check this [link](https://example.com/very/long/url/that/might/be/cut')).toBe('Check this [link](https://example.com/very/long/url/that/might/be/cut)')

})

