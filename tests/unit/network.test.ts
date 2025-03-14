
import { vi, test, expect, beforeEach } from 'vitest'
import { BrowserWindow } from 'electron'
import { debugWindow } from '../../src/main/windows/debug'
import interceptNetwork  from '../../src/main/network'

global.MAIN_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:3000/'
global.MAIN_WINDOW_VITE_NAME = 'vite'

vi.mock('electron', () => {
  const BrowserWindow = vi.fn()
  BrowserWindow.prototype.webContents = {
    debugger: {
      attach: vi.fn(),
      sendCommand: vi.fn(async (command) => {
        if (command === 'Network.getResponseBody') {
          return { body: 'response', base64encoded: false }
        }
      }),
      on: vi.fn(),
    }
  }
  BrowserWindow.prototype.on = vi.fn()
  return { BrowserWindow }
})

vi.mock('../../src/main/windows/debug.ts', () => {
  return {
    debugWindow: {
      webContents: {
        send: vi.fn()
      }
    }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('attaches debugger', async () => {

  const window = new BrowserWindow()
  interceptNetwork(window)

  expect(window.webContents.debugger.attach).toHaveBeenLastCalledWith('1.3')
  expect(window.webContents.debugger.sendCommand).toHaveBeenLastCalledWith('Network.enable')
  expect(window.webContents.debugger.on).toHaveBeenLastCalledWith('message', expect.any(Function))

  expect(window.on).toHaveBeenLastCalledWith('close', expect.any(Function))

})

test('processes http requests', async () => {

  const window = new BrowserWindow()
  interceptNetwork(window)
  const messageHandler = window.webContents.debugger.on.mock.calls[0][1]

  messageHandler({}, 'Network.requestWillBeSent', {
    requestId: '123',
    request: {
      url: 'http://example.com',
      method: 'GET',
      headers: {
        'header': 'request',
        'authorization': '123',
        'Authorization': '123',
        'x-goog-api-key': '123',
        'x-api-key': '123'
      },
      postData: 'data'
    }
  })

  expect(debugWindow.webContents.send).toHaveBeenLastCalledWith('network', {
    id: '123',
    url: 'http://example.com',
    method: 'GET',
    headers: {
      'header': 'request',
      'authorization': '*** hidden ***',
      'Authorization': '*** hidden ***',
      'x-goog-api-key': '*** hidden ***',
      'x-api-key': '*** hidden ***'
    },
    postData: 'data'
  })

  await messageHandler({}, 'Network.responseReceived', {
    requestId: '123',
    response: {
      status: 200,
      statusText: 'OK',
      headers: {
        'header': 'response'
      },
      mimeType: 'application/json',
    }
  })

  // expect(debugWindow.webContents.send).toHaveBeenLastCalledWith('network', {
  //   id: '123',
  //   url: 'http://example.com',
  //   method: 'GET',
  //   headers: {
  //     'header': 'request',
  //     'authorization': '*** hidden ***',
  //     'Authorization': '*** hidden ***',
  //     'x-goog-api-key': '*** hidden ***',
  //     'x-api-key': '*** hidden ***'
  //   },
  //   postData: 'data',
  //   mimeType: 'application/json',
  //   statusCode: 200,
  //   statusText: 'OK',
  //   responseHeaders: {
  //     'header': 'response'
  //   }
  // })

  expect(debugWindow.webContents.send).toHaveBeenCalledTimes(1)

  await messageHandler({}, 'Network.loadingFinished', {
    requestId: '123',
  })

  expect(debugWindow.webContents.send).toHaveBeenLastCalledWith('network', {
    id: '123',
    url: 'http://example.com',
    method: 'GET',
    headers: {
      'header': 'request',
      'authorization': '*** hidden ***',
      'Authorization': '*** hidden ***',
      'x-goog-api-key': '*** hidden ***',
      'x-api-key': '*** hidden ***'
    },
    postData: 'data',
    mimeType: 'application/json',
    statusCode: 200,
    statusText: 'OK',
    responseBody: 'response',
    responseHeaders: {
      'header': 'response'
    }
  })


})

test('discards invalid requests', async () => {


  const window = new BrowserWindow()
  interceptNetwork(window)
  const messageHandler = window.webContents.debugger.on.mock.calls[0][1]

  messageHandler({}, 'Network.requestWillBeSent', {
    requestId: '123',
    request: {
      url: 'file://file.text',
    }
  })

  messageHandler({}, 'Network.requestWillBeSent', {
    requestId: '123',
    request: {
      url: 'blob://binary',
    }
  })

  messageHandler({}, 'Network.requestWillBeSent', {
    requestId: '123',
    request: {
      url: 'chrome-extension://binary',
    }
  })

  expect(debugWindow.webContents.send).not.toHaveBeenCalled()

})
