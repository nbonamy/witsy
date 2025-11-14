
import { vi, test, expect, beforeEach } from 'vitest'
import { BrowserWindow } from 'electron'
import { debugWindow } from '../../../src/main/windows/debug'
import interceptNetwork  from '../../../src/main/network'

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

vi.mock('../../../src/main/windows/debug.ts', () => {
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

  expect(window.on).toHaveBeenLastCalledWith('closed', expect.any(Function))

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
    startTime: expect.any(Number),
    type: 'http',
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
    startTime: expect.any(Number),
    endTime: expect.any(Number),
    type: 'http',
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

test('processes websocket requests', async () => {

  const window = new BrowserWindow()
  interceptNetwork(window)
  const messageHandler = window.webContents.debugger.on.mock.calls[0][1]

  // Create WebSocket connection
  messageHandler({}, 'Network.webSocketCreated', {
    requestId: 'ws-123',
    url: 'wss://api.example.com/stream',
    initiator: {}
  })

  expect(debugWindow.webContents.send).toHaveBeenLastCalledWith('network', {
    id: 'ws-123',
    startTime: expect.any(Number),
    type: 'websocket',
    url: 'wss://api.example.com/stream',
    method: 'OPEN',
    headers: {},
    postData: '',
    frames: [],
  })

  // Handle handshake response
  await messageHandler({}, 'Network.webSocketHandshakeResponseReceived', {
    requestId: 'ws-123',
    response: {
      status: 101,
      statusText: 'Switching Protocols',
      headers: {
        'upgrade': 'websocket',
        'connection': 'Upgrade',
        'authorization': 'Bearer secret123'
      }
    }
  })

  expect(debugWindow.webContents.send).toHaveBeenLastCalledWith('network', {
    id: 'ws-123',
    startTime: expect.any(Number),
    type: 'websocket',
    url: 'wss://api.example.com/stream',
    method: 'OPEN',
    headers: {},
    postData: '',
    frames: [],
    statusCode: 101,
    statusText: 'Switching Protocols',
    responseHeaders: {
      'upgrade': 'websocket',
      'connection': 'Upgrade',
      'authorization': '*** hidden ***'
    }
  })

  // Send frame
  await messageHandler({}, 'Network.webSocketFrameSent', {
    requestId: 'ws-123',
    timestamp: 1234567890,
    response: {
      opcode: 1,
      mask: true,
      payloadData: 'Hello WebSocket!'
    }
  })

  expect(debugWindow.webContents.send).toHaveBeenLastCalledWith('network', {
    id: 'ws-123',
    startTime: expect.any(Number),
    type: 'websocket',
    url: 'wss://api.example.com/stream',
    method: 'OPEN',
    headers: {},
    postData: '',
    frames: [{
      type: 'sent',
      timestamp: 1234567890,
      opcode: 1,
      mask: true,
      payloadData: 'Hello WebSocket!',
      payloadLength: 16
    }],
    statusCode: 101,
    statusText: 'Switching Protocols',
    responseHeaders: {
      'upgrade': 'websocket',
      'connection': 'Upgrade',
      'authorization': '*** hidden ***'
    }
  })

  // Receive frame
  await messageHandler({}, 'Network.webSocketFrameReceived', {
    requestId: 'ws-123',
    timestamp: 1234567891,
    response: {
      opcode: 1,
      mask: false,
      payloadData: 'Hello from server!'
    }
  })

  // Send another frame
  await messageHandler({}, 'Network.webSocketFrameSent', {
    requestId: 'ws-123',
    timestamp: 1234567892,
    response: {
      opcode: 1,
      mask: true,
      payloadData: 'How are you?'
    }
  })

  // Receive another frame
  await messageHandler({}, 'Network.webSocketFrameReceived', {
    requestId: 'ws-123',
    timestamp: 1234567893,
    response: {
      opcode: 1,
      mask: false,
      payloadData: 'I am doing well, thanks!'
    }
  })

  expect(debugWindow.webContents.send).toHaveBeenLastCalledWith('network', {
    id: 'ws-123',
    startTime: expect.any(Number),
    type: 'websocket',
    url: 'wss://api.example.com/stream',
    method: 'OPEN',
    headers: {},
    postData: '',
    frames: [
      {
        type: 'sent',
        timestamp: 1234567890,
        opcode: 1,
        mask: true,
        payloadData: 'Hello WebSocket!',
        payloadLength: 16
      },
      {
        type: 'received',
        timestamp: 1234567891,
        opcode: 1,
        mask: false,
        payloadData: 'Hello from server!',
        payloadLength: 18
      },
      {
        type: 'sent',
        timestamp: 1234567892,
        opcode: 1,
        mask: true,
        payloadData: 'How are you?',
        payloadLength: 12
      },
      {
        type: 'received',
        timestamp: 1234567893,
        opcode: 1,
        mask: false,
        payloadData: 'I am doing well, thanks!',
        payloadLength: 24
      }
    ],
    statusCode: 101,
    statusText: 'Switching Protocols',
    responseHeaders: {
      'upgrade': 'websocket',
      'connection': 'Upgrade',
      'authorization': '*** hidden ***'
    }
  })

  // Close WebSocket
  await messageHandler({}, 'Network.webSocketClosed', {
    requestId: 'ws-123',
    timestamp: 1234567894
  })

  expect(debugWindow.webContents.send).toHaveBeenLastCalledWith('network', {
    id: 'ws-123',
    startTime: expect.any(Number),
    endTime: expect.any(Number),
    type: 'websocket',
    url: 'wss://api.example.com/stream',
    method: 'OPEN',
    headers: {},
    postData: '',
    frames: [
      {
        type: 'sent',
        timestamp: 1234567890,
        opcode: 1,
        mask: true,
        payloadData: 'Hello WebSocket!',
        payloadLength: 16
      },
      {
        type: 'received',
        timestamp: 1234567891,
        opcode: 1,
        mask: false,
        payloadData: 'Hello from server!',
        payloadLength: 18
      },
      {
        type: 'sent',
        timestamp: 1234567892,
        opcode: 1,
        mask: true,
        payloadData: 'How are you?',
        payloadLength: 12
      },
      {
        type: 'received',
        timestamp: 1234567893,
        opcode: 1,
        mask: false,
        payloadData: 'I am doing well, thanks!',
        payloadLength: 24
      }
    ],
    statusCode: 101,
    statusText: 'Switching Protocols',
    responseHeaders: {
      'upgrade': 'websocket',
      'connection': 'Upgrade',
      'authorization': '*** hidden ***'
    },
  })

})

test('handles websocket errors', async () => {

  const window = new BrowserWindow()
  interceptNetwork(window)
  const messageHandler = window.webContents.debugger.on.mock.calls[0][1]

  // Create WebSocket connection
  messageHandler({}, 'Network.webSocketCreated', {
    requestId: 'ws-error-123',
    url: 'wss://api.example.com/stream'
  })

  // WebSocket error
  await messageHandler({}, 'Network.webSocketFrameError', {
    requestId: 'ws-error-123',
    timestamp: 1234567890,
    errorMessage: 'Connection failed'
  })

  expect(debugWindow.webContents.send).toHaveBeenLastCalledWith('network', {
    id: 'ws-error-123',
    startTime: expect.any(Number),
    endTime: expect.any(Number),
    type: 'websocket',
    url: 'wss://api.example.com/stream',
    method: 'OPEN',
    headers: {},
    postData: '',
    frames: [],
    errorMessage: 'Connection failed',
  })

})

test('discards invalid websocket requests', async () => {

  const window = new BrowserWindow()
  interceptNetwork(window)
  const messageHandler = window.webContents.debugger.on.mock.calls[0][1]

  // Try to create WebSocket with dev server URL (should be filtered)
  messageHandler({}, 'Network.webSocketCreated', {
    requestId: 'ws-invalid-123',
    url: 'ws://localhost:3000/socket'
  })

  expect(debugWindow.webContents.send).not.toHaveBeenCalled()

})
