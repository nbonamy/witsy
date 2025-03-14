
import { vi, expect, test } from 'vitest'
import LocalSearch from '../../src/main/search'

vi.mock('electron', async () => {
  const BrowserWindow = vi.fn(function() {
    this.webContents = {
      on: vi.fn((signal, callback) => {
        if (signal === 'dom-ready' || signal === 'did-finish-load') {
          callback()
        }
      }),
      executeJavaScript: vi.fn((script) => {
        if (script === 'document.body.outerHTML') {
          return `<html><body>test</body></html>`
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
  })
  BrowserWindow.prototype.loadURL = vi.fn()
  return { BrowserWindow }
})

test('search', async () => {

  const search = new LocalSearch()
  const res = await search.search('witsy', 3)
  expect(res).toEqual([
    { title: 'title1', url: 'url1', content: '<html><body>test</body></html>' },
    { title: 'title2', url: 'url2', content: '<html><body>test</body></html>' },
    { title: 'title4', url: 'url4', content: '<html><body>test</body></html>' },
  ])

})
