
import { NetworkRequest } from '../types/index'
import { BrowserWindow } from 'electron'
import { debugWindow } from './windows/debug'

const TTL = 1 * 60 * 1000

const requests = new Map<string, NetworkRequest>()

export const getNetworkHistory = (): NetworkRequest[] => Array.from(requests.values())

export const clearNetworkHistory = () => requests.clear()

export default (window: BrowserWindow) => {

  try {
  
    window.webContents.debugger.attach('1.3')
    window.webContents.debugger.sendCommand('Network.enable')
    
    window.webContents.debugger.on('message', async (_: Event, method: string, params: any) => {

      // Handle HTTP requests
      if (method === 'Network.requestWillBeSent') {
        handleHttpRequest(params)
        return
      }

      // Handle WebSocket creation
      if (method === 'Network.webSocketCreated') {
        handleWebSocketCreated(params)
        return
      }

      // Handle WebSocket handshake response
      if (method === 'Network.webSocketHandshakeResponseReceived') {
        handleWebSocketHandshake(params)
        return
      }

      // Handle WebSocket frames (sent/received)
      if (method === 'Network.webSocketFrameSent') {
        handleWebSocketFrameSent(params)
        return
      }

      if (method === 'Network.webSocketFrameReceived') {
        handleWebSocketFrameReceived(params)
        return
      }

      // Handle WebSocket closure
      if (method === 'Network.webSocketClosed') {
        handleWebSocketClosed(params)
        return
      }

      // Handle WebSocket errors
      if (method === 'Network.webSocketFrameError') {
        handleWebSocketError(params)
        return
      }

      // Handle HTTP response received
      if (method === 'Network.responseReceived') {
        handleHttpResponse(params)
        return
      }

      // Handle HTTP loading finished/failed
      if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
        await handleHttpLoadingComplete(params, method, window)
        return
      }

    })

    window.on('closed', () => {
      try {
        window.webContents.debugger.detach()
      } catch (error) {
        console.error('Error detaching debugger', error)
      }
    })

  } catch (error) {
    console.error('Error attaching network debugger', error)
  }

  // Helper functions
  function handleHttpRequest(params: any) {
    const url = params.request.url

    // Filter URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return
    }

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
      return
    }

    if (
      url.includes('googlefonts') ||
      url.includes('storage.googleapis.com')
    ) {
      return
    }

    const { requestId, request } = params
    const networkRequest: NetworkRequest = {
      id: requestId,
      type: 'http',
      url: request.url,
      method: request.method,
      headers: { ...request.headers },
      postData: request.postData,
    }

    // Hide API keys
    hideApiKeys(networkRequest.headers)

    requests.set(requestId, networkRequest)
    debugWindow?.webContents?.send('network', networkRequest)
  }

  function handleWebSocketCreated(params: any) {
    const { requestId, url } = params
    
    // Filter WebSocket URLs if needed
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL.replace('http', 'ws'))) {
      return
    }

    const networkRequest: NetworkRequest = {
      id: requestId,
      type: 'websocket',
      url: url,
      method: 'WEBSOCKET',
      headers: {},
      postData: '',
      frames: [],
    }

    requests.set(requestId, networkRequest)
    debugWindow?.webContents?.send('network', networkRequest)
  }

  function handleWebSocketHandshake(params: any) {
    const { requestId, response } = params
    const request = requests.get(requestId)
    if (!request) return

    request.statusCode = response.status
    request.statusText = response.statusText
    request.responseHeaders = { ...response.headers }

    // Hide API keys in response headers too
    hideApiKeys(request.responseHeaders)

    debugWindow?.webContents?.send('network', request)
  }

  function handleWebSocketFrameSent(params: any) {
    
    const { requestId, timestamp, response } = params
    const request = requests.get(requestId)
    if (!request) return

    request.frames.push({
      type: 'sent',
      timestamp: timestamp,
      opcode: response.opcode,
      mask: response.mask,
      payloadData: response.payloadData,
      payloadLength: response.payloadData?.length || 0
    })

    // // Limit frames to prevent memory issues
    // if (request.webSocketFrames.length > 100) {
    //   request.webSocketFrames = request.webSocketFrames.slice(-50)
    // }

    debugWindow?.webContents?.send('network', request)
  }

  function handleWebSocketFrameReceived(params: any) {
    const { requestId, timestamp, response } = params
    const request = requests.get(requestId)
    if (!request) return

    request.frames.push({
      type: 'received',
      timestamp: timestamp,
      opcode: response.opcode,
      mask: response.mask,
      payloadData: response.payloadData,
      payloadLength: response.payloadData?.length || 0
    })

    // // Limit frames to prevent memory issues
    // if (request.webSocketFrames.length > 100) {
    //   request.webSocketFrames = request.webSocketFrames.slice(-50)
    // }

    debugWindow?.webContents?.send('network', request)
  }

  function handleWebSocketClosed(params: any) {
    const { requestId, timestamp } = params
    const request = requests.get(requestId)
    if (!request) return

    request.endTime = timestamp
    debugWindow?.webContents?.send('network', request)

    // Cleanup after TTL
    setTimeout(() => {
      requests.delete(requestId)
    }, TTL)
  }

  function handleWebSocketError(params: any) {
    const { requestId, timestamp, errorMessage } = params
    const request = requests.get(requestId)
    if (!request) return

    request.errorMessage = errorMessage
    request.endTime = timestamp
    debugWindow?.webContents?.send('network', request)
  }

  function handleHttpResponse(params: any) {
    const { requestId } = params
    if (!requests.has(requestId)) return

    const { response } = params
    const request = requests.get(requestId)
    if (!request) return
      
    request.statusCode = response.status
    request.statusText = response.statusText
    request.responseHeaders = response.headers
    request.mimeType = response.mimeType
  }

  async function handleHttpLoadingComplete(params: any, method: string, window: BrowserWindow) {
    const { requestId } = params
    if (!requests.has(requestId)) return

    const request = requests.get(requestId)
    if (!request) return

    // Get response body for HTTP requests
    try {
      const { body, base64Encoded } = await window.webContents.debugger.sendCommand(
        'Network.getResponseBody', { requestId }
      )
      if (body.length < 256 * 1024) {
        request.responseBody = base64Encoded ? Buffer.from(body, 'base64').toString() : body
      } else {
        request.responseBody = 'Response body too large to display'
      }
    } catch (error) {
      request.responseBody = `Unable to get response body. ${error.message}`
      console.log(`Couldn't get response body for request ${requestId} ${request.url}: ${error.message}`)
    }

    if (method === 'Network.loadingFailed') {
      request.errorMessage = params.errorText
    }

    debugWindow?.webContents?.send('network', request)

    // Cleanup after TTL
    setTimeout(() => {
      requests.delete(requestId)
    }, TTL)
  }

  function hideApiKeys(headers: Record<string, string>) {
    for (const key of ['x-api-key', 'x-goog-api-key', 'authorization']) {
      Object.keys(headers).filter((k) => k.toLowerCase() === key).forEach(k => {
        headers[k] = '*** hidden ***'
      })
    }
  }
}

