import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import { exportToPdf } from '@services/pdf'

beforeEach(() => {
  useWindowMock()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exportToPdf', () => {
  test('uses app printToPdf and saves resulting bytes', async () => {
    const style = document.createElement('style')
    style.textContent = ':root { --pdf-test-color: #ffffff; }'
    document.head.appendChild(style)

    const element = document.createElement('div')
    element.innerHTML = '<h1>Title</h1><p>Hello world</p>'
    document.body.appendChild(element)

    await exportToPdf({
      title: 'sample',
      element,
    })

    expect(window.api.app.setAppearanceTheme).not.toHaveBeenCalled()
    expect(window.api.app.printToPdf).toHaveBeenCalledOnce()

    const [html, landscape] = vi.mocked(window.api.app.printToPdf).mock.calls[0]
    expect(landscape).toBe(false)
    expect(html).toContain('<article class="witsy-pdf-document">')
    expect(html).toContain('<h1 class="witsy-pdf-title">sample</h1>')
    expect(html).toContain('--pdf-test-color: #ffffff;')

    expect(window.api.file.save).toHaveBeenCalledWith({
      contents: 'JVBERi0xLjQK',
      properties: {
        filename: 'sample.pdf',
        prompt: true
      }
    })
  })
})
