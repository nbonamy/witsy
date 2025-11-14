
import { expect, test, vi, beforeEach } from 'vitest'
import Loader from '../../../../src/main/rag/loader'
import { Configuration } from '../../../../src/types/config'

const mockConfig = {} as Configuration

beforeEach(() => {
  vi.restoreAllMocks()
})

test('isParseable returns true for url', () => {
  const loader = new Loader(mockConfig)
  expect(loader.isParseable('url', 'https://example.com')).toBe(true)
})

test('isParseable returns true for sitemap', () => {
  const loader = new Loader(mockConfig)
  expect(loader.isParseable('sitemap', 'https://example.com/sitemap.xml')).toBe(true)
})

test('isParseable returns true for text', () => {
  const loader = new Loader(mockConfig)
  expect(loader.isParseable('text', 'some text')).toBe(true)
})

test('loadUrl converts HTML to text', async () => {
  const loader = new Loader(mockConfig)
  const html = '<html><body><p>Test</p><p>Content</p></body></html>'

  global.fetch = vi.fn().mockResolvedValue({
    text: async () => html
  })

  const result = await loader.loadUrl('https://example.com')
  expect(result).toContain('Test')
  expect(result).toContain('Content')
  expect(result).not.toContain('<html>')
  expect(result).not.toContain('<body>')
  expect(result).not.toContain('<p>')
})

test('getSitemapUrls extracts URLs from sitemap', async () => {
  const loader = new Loader(mockConfig)
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`

  global.fetch = vi.fn().mockResolvedValue({ text: async () => sitemapXml })

  const urls = await loader.getSitemapUrls('https://example.com/sitemap.xml')
  expect(urls).toEqual(['https://example.com/page1', 'https://example.com/page2'])
})

test('getSitemapUrls handles single URL in sitemap', async () => {
  const loader = new Loader(mockConfig)
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
</urlset>`

  global.fetch = vi.fn().mockResolvedValue({ text: async () => sitemapXml })

  const urls = await loader.getSitemapUrls('https://example.com/sitemap.xml')
  expect(urls).toEqual(['https://example.com/page1'])
})

test('getSitemapUrls throws on sitemap fetch error', async () => {
  const loader = new Loader(mockConfig)

  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

  await expect(loader.getSitemapUrls('https://example.com/sitemap.xml'))
    .rejects.toThrow('Failed to load sitemap')
})

test('getSitemapUrls handles invalid XML gracefully', async () => {
  const loader = new Loader(mockConfig)
  const invalidXml = 'not valid xml'

  global.fetch = vi.fn().mockResolvedValue({ text: async () => invalidXml })

  const urls = await loader.getSitemapUrls('https://example.com/sitemap.xml')
  expect(urls).toEqual([])
})
