
import { vi, expect, test } from 'vitest'
import LocalSearch from '../../src/main/search'

// Mock fetch for content fetching
// @ts-expect-error mock
global.fetch = vi.fn(async () => {
  return {
    ok: true,
    headers: {
      get: () => 'text/html',
    },
    text: async () => '<html><body>test</body></html>',
  }
})

vi.mock('electron', async () => {
  const BrowserWindow = vi.fn(function() {
    const handler = (signal: string, callback: () => void) => {
      if (signal === 'dom-ready' || signal === 'did-finish-load') {
        callback()
      }
    }
    // @ts-expect-error mock
    this.webContents = {
      setMaxListeners: vi.fn(),
      session: {
        on: vi.fn(),
        once: vi.fn(),
        setMaxListeners: vi.fn(),
        getUserAgent: vi.fn(() => 'Mozilla/5.0 Witsy/1.0.0 Electron/28.0.0 Safari/537.36'),
        setUserAgent: vi.fn(),
      },
      on: vi.fn(handler),
      once: vi.fn(handler),
      executeJavaScript: vi.fn((script) => {
        if (script === 'document.body.outerHTML') {
          return `<html><body>test</body></html>`
        } else if (script === 'document.title') {
          return 'title'
        } else {
          return [
            { title: 'title1', url: 'url1' },
            { title: 'title2', url: 'url2' },
            { title: 'title3', url: 'url2' },
            { title: 'title4', url: 'url4' },
            { title: 'title5', url: 'url5' },
          ]
        }
      }),
    }
    // @ts-expect-error mock
    this.show = vi.fn()
    // @ts-expect-error mock
    this.hide = vi.fn()
    // @ts-expect-error mock
    let destroyed = false
    // @ts-expect-error mock
    this.isDestroyed = vi.fn(() => destroyed)
    // @ts-expect-error mock
    this.close = vi.fn(() => { destroyed = true })
    // @ts-expect-error mock
    this.destroy = vi.fn(() => { destroyed = true })
  })
  BrowserWindow.prototype.loadURL = vi.fn()
  return { BrowserWindow }
})

test('search', async () => {

  const search = new LocalSearch()
  const res = await search.search('witsy', 3)
  expect(res).toEqual({ results: [
    { title: 'title1', url: 'url1', html: '<html><body>test</body></html>' },
    { title: 'title2', url: 'url2', html: '<html><body>test</body></html>' },
    { title: 'title4', url: 'url4', html: '<html><body>test</body></html>' },
  ]})

})

test('search with abortSignal - basic completion', async () => {
  const search = new LocalSearch()
  const abortController = new AbortController()

  const res = await search.search('witsy', 3, false, abortController.signal)
  expect(res).toEqual({ results: [
    { title: 'title1', url: 'url1', html: '<html><body>test</body></html>' },
    { title: 'title2', url: 'url2', html: '<html><body>test</body></html>' },
    { title: 'title4', url: 'url4', html: '<html><body>test</body></html>' },
  ]})
})

test('search aborted before window opens', async () => {
  const search = new LocalSearch()
  const abortController = new AbortController()

  // Abort immediately
  abortController.abort()

  await expect(
    search.search('witsy', 3, false, abortController.signal)
  ).rejects.toThrow('Operation cancelled')
})

test('search with non-aborted signal completes normally', async () => {
  const search = new LocalSearch()
  const abortController = new AbortController()

  // Don't abort - just pass the signal
  const res = await search.search('witsy', 3, false, abortController.signal)

  // Should complete successfully
  expect(res.results).toHaveLength(3)
  expect(abortController.signal.aborted).toBe(false)
})

test('search without abortSignal works normally', async () => {
  const search = new LocalSearch()

  // No signal provided (undefined)
  const res = await search.search('witsy', 3, false, undefined)
  expect(res.results).toHaveLength(3)
})

test('search accepts abortSignal parameter', async () => {
  const search = new LocalSearch()
  const abortController = new AbortController()

  // Verify the method signature accepts abortSignal
  const res = await search.search('witsy', 3, false, abortController.signal)
  expect(res.results).toHaveLength(3)
})

test('search aborted before execution rejects immediately', async () => {
  const search = new LocalSearch()
  const abortController = new AbortController()

  // Abort before calling search
  abortController.abort()

  await expect(
    search.search('witsy', 3, false, abortController.signal)
  ).rejects.toThrow('Operation cancelled')
})
