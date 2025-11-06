
import { NetworkRequest } from '../types/index'
import { BrowserWindow } from 'electron'
import { debugWindow } from './windows/debug'

const TTL = (process.env.DEBUG ? 10 : 3) * 60 * 1000

const requests = new Map<string, NetworkRequest>()

export const getNetworkHistory = (): NetworkRequest[] => Array.from(requests.values())

export const clearNetworkHistory = () => requests.clear()

export default (window: BrowserWindow) => {

  try {

    // requests.set('28253.461', JSON.parse('{"id":"28253.461","type":"websocket","url":"wss://eu2.rt.speechmatics.com/v2?jwt=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzbWlzc3VlciIsImF1ZCI6WyJldSIsImV1LTEiXSwiZXhwIjoxNzQ5MTQyODcwLCJuYmYiOjE3NDkxMzkyMTAsImlhdCI6MTc0OTE0MjgxMCwiY29udHJhY3RfaWQiOiIxNjI2MDgiLCJwcm9qZWN0X2lkIjoiMTYyNjA4IiwicHJvZHVjdCI6InJ0IiwidXNlcl9pZCI6InNlbGZzZXJ2aWNlLTE2MjYwOSIsImFjY291bnRfdHlwZSI6ImZyZWUiLCJjb25uZWN0aW9uX3F1b3RhIjoiMiJ9.i2BR0KFIs9JYICa8jqighU7l03v7eCUxpgxidcGZZi4IJE0sBwR_GdCNxBcCwTHPNd46iQORgSSBiqxJ39e5UrYRvr54zS-vUZfejPPjVEcBppLDvwHs3chFAXgTGyYyYx-Kc4D21C7_i0aswJ_6QT1lvGFB6rW3PDzh-j6Dclic65yZ6r8OHKtw5cEAOkbvGQ4u6cakC19QL-sPm3kQNK1-yvVnaI-5b1gBg0b2nA8qXaiYtg0_dikbjZmLw7maw4RiP0XvAP2A90Dv4IwbtwLXFMvIMVgboyjDVN72ynnm5H_OIgA-lgkC8NPs7HxO_lXdf6FhyoZUm2KEqATm9IbyKh6jxffbeA2oif5pIZaKKNJ_hq3CwM9uPku3veW7AGF4x4C9w8PqiDFLT6cRY6dnVrHBdn27mZ6dni89EWXGayWku6js2iFsYRhRSJE9ejHZGMiRvUBlXuCOJdKONQzTe5KBOmsCEYNV2DN8a82uo5-Xx2hbLqaTQ0rVMyBG","method":"OPEN","headers":{},"postData":"","frames":[{"type":"sent","timestamp":221411.570907,"opcode":1,"mask":true,"payloadData":"{\\"audio_format\\":{\\"type\\":\\"file\\"},\\"transcription_config\\":{\\"operating_point\\":\\"standard\\",\\"language\\":\\"en\\",\\"additional_vocab\\":[],\\"enable_partials\\":true},\\"message\\":\\"StartRecognition\\"}","payloadLength":176},{"type":"received","timestamp":221411.571294,"opcode":1,"mask":false,"payloadData":"{\\"message\\":\\"Info\\",\\"type\\":\\"concurrent_session_usage\\",\\"reason\\":\\"1 concurrent sessions active out of quota 2\\",\\"usage\\":1,\\"quota\\":2,\\"last_updated\\":\\"2025-06-05T17:00:10Z\\"}","payloadLength":165},{"type":"received","timestamp":221411.774372,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"RecognitionStarted\\", \\"orchestrator_version\\": \\"2025.05.28399+604523eab4.HEAD\\", \\"id\\": \\"42ff5182-df7d-4ec1-b871-f57bfd2617dd\\", \\"language_pack_info\\": {\\"adapted\\": false, \\"itn\\": true, \\"language_description\\": \\"English\\", \\"word_delimiter\\": \\" \\", \\"writing_direction\\": \\"left-to-right\\"}}","payloadLength":287},{"type":"received","timestamp":221411.781857,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"Info\\", \\"type\\": \\"recognition_quality\\", \\"reason\\": \\"Running recognition using a broadcast model quality.\\", \\"quality\\": \\"broadcast\\"}","payloadLength":140},{"type":"sent","timestamp":221412.010368,"opcode":2,"mask":true,"payloadData":"","payloadLength":0},{"type":"received","timestamp":221412.130028,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AudioAdded\\", \\"seq_no\\": 1}","payloadLength":38},{"type":"sent","timestamp":221412.250305,"opcode":2,"mask":true,"payloadData":"","payloadLength":0},{"type":"received","timestamp":221412.360328,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AudioAdded\\", \\"seq_no\\": 2}","payloadLength":38},{"type":"received","timestamp":221412.406405,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AddPartialTranscript\\", \\"format\\": \\"2.9\\", \\"results\\": [], \\"metadata\\": {\\"end_time\\": 0.28, \\"start_time\\": 0.0, \\"transcript\\": \\"\\"}}","payloadLength":136},{"type":"sent","timestamp":221412.491263,"opcode":2,"mask":true,"payloadData":"","payloadLength":0},{"type":"received","timestamp":221412.606397,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AudioAdded\\", \\"seq_no\\": 3}","payloadLength":38},{"type":"sent","timestamp":221412.729726,"opcode":2,"mask":true,"payloadData":"","payloadLength":0},{"type":"received","timestamp":221412.836862,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AudioAdded\\", \\"seq_no\\": 4}","payloadLength":38},{"type":"received","timestamp":221412.880953,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AddPartialTranscript\\", \\"format\\": \\"2.9\\", \\"results\\": [{\\"alternatives\\": [{\\"confidence\\": 1.0, \\"content\\": \\"So\\", \\"language\\": \\"en\\"}], \\"end_time\\": 0.32, \\"start_time\\": 0.08, \\"type\\": \\"word\\"}, {\\"alternatives\\": [{\\"confidence\\": 1.0, \\"content\\": \\"with\\", \\"language\\": \\"en\\"}], \\"end_time\\": 0.56, \\"start_time\\": 0.32, \\"type\\": \\"word\\"}], \\"metadata\\": {\\"end_time\\": 0.56, \\"start_time\\": 0.0, \\"transcript\\": \\"So with\\"}}","payloadLength":403},{"type":"sent","timestamp":221412.970206,"opcode":2,"mask":true,"payloadData":"","payloadLength":0},{"type":"received","timestamp":221413.091332,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AudioAdded\\", \\"seq_no\\": 5}","payloadLength":38},{"type":"received","timestamp":221413.131439,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AddPartialTranscript\\", \\"format\\": \\"2.9\\", \\"results\\": [{\\"alternatives\\": [{\\"confidence\\": 1.0, \\"content\\": \\"So\\", \\"language\\": \\"en\\"}], \\"end_time\\": 0.32, \\"start_time\\": 0.08, \\"type\\": \\"word\\"}, {\\"alternatives\\": [{\\"confidence\\": 1.0, \\"content\\": \\"with\\", \\"language\\": \\"en\\"}], \\"end_time\\": 0.52, \\"start_time\\": 0.32, \\"type\\": \\"word\\"}, {\\"alternatives\\": [{\\"confidence\\": 1.0, \\"content\\": \\"all\\", \\"language\\": \\"en\\"}], \\"end_time\\": 0.76, \\"start_time\\": 0.52, \\"type\\": \\"word\\"}], \\"metadata\\": {\\"end_time\\": 0.92, \\"start_time\\": 0.0, \\"transcript\\": \\"So with all\\"}}","payloadLength":538},{"type":"sent","timestamp":221413.21173,"opcode":2,"mask":true,"payloadData":"","payloadLength":0},{"type":"received","timestamp":221413.329229,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AudioAdded\\", \\"seq_no\\": 6}","payloadLength":38},{"type":"sent","timestamp":221413.367316,"opcode":1,"mask":true,"payloadData":"{\\"message\\":\\"EndOfStream\\",\\"last_seq_no\\":6}","payloadLength":41},{"type":"received","timestamp":221413.627391,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AddTranscript\\", \\"format\\": \\"2.9\\", \\"results\\": [{\\"alternatives\\": [{\\"confidence\\": 1.0, \\"content\\": \\"So\\", \\"language\\": \\"en\\"}], \\"end_time\\": 0.32, \\"start_time\\": 0.08, \\"type\\": \\"word\\"}, {\\"alternatives\\": [{\\"confidence\\": 0.8, \\"content\\": \\"with\\", \\"language\\": \\"en\\"}], \\"end_time\\": 0.52, \\"start_time\\": 0.32, \\"type\\": \\"word\\"}, {\\"alternatives\\": [{\\"confidence\\": 0.69, \\"content\\": \\"all\\", \\"language\\": \\"en\\"}], \\"end_time\\": 0.72, \\"start_time\\": 0.52, \\"type\\": \\"word\\"}, {\\"alternatives\\": [{\\"confidence\\": 1.0, \\"content\\": \\",\\", \\"language\\": \\"en\\"}], \\"attaches_to\\": \\"previous\\", \\"end_time\\": 0.72, \\"is_eos\\": false, \\"start_time\\": 0.72, \\"type\\": \\"punctuation\\"}, {\\"alternatives\\": [{\\"confidence\\": 0.97, \\"content\\": \\"lets\\", \\"language\\": \\"en\\"}], \\"end_time\\": 0.96, \\"start_time\\": 0.76, \\"type\\": \\"word\\"}, {\\"alternatives\\": [{\\"confidence\\": 0.98, \\"content\\": \\"try\\", \\"language\\": \\"en\\"}], \\"end_time\\": 1.16, \\"start_time\\": 0.96, \\"type\\": \\"word\\"}, {\\"alternatives\\": [{\\"confidence\\": 0.94, \\"content\\": \\"here\\", \\"language\\": \\"en\\"}], \\"end_time\\": 1.28, \\"start_time\\": 1.16, \\"type\\": \\"word\\"}, {\\"alternatives\\": [{\\"confidence\\": 1.0, \\"content\\": \\".\\", \\"language\\": \\"en\\"}], \\"attaches_to\\": \\"previous\\", \\"end_time\\": 1.28, \\"is_eos\\": true, \\"start_time\\": 1.28, \\"type\\": \\"punctuation\\"}], \\"metadata\\": {\\"end_time\\": 1.28, \\"start_time\\": 0.0, \\"transcript\\": \\"So with all, lets try here. \\"}}","payloadLength":1308},{"type":"received","timestamp":221413.629776,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"AddPartialTranscript\\", \\"format\\": \\"2.9\\", \\"results\\": [], \\"metadata\\": {\\"end_time\\": 1.36, \\"start_time\\": 1.36, \\"transcript\\": \\"\\"}}","payloadLength":137},{"type":"received","timestamp":221413.643802,"opcode":1,"mask":false,"payloadData":"{\\"message\\": \\"EndOfTranscript\\"}","payloadLength":30}],"statusCode":101,"statusText":"Switching Protocols","responseHeaders":{"Access-Control-Allow-Credentials":"true","Access-Control-Allow-Headers":"DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Request-Id","Access-Control-Allow-Methods":"GET, PUT, POST, DELETE, PATCH, OPTIONS","Access-Control-Allow-Origin":"*","Access-Control-Max-Age":"600","Connection":"upgrade","Date":"Thu, 05 Jun 2025 17:00:10 GMT","Proxy-Request-Id":"d10210d544691f42150c9d98a16f4c06","Request-Id":"d10210d544691f42150c9d98a16f4c06","Sec-WebSocket-Accept":"QmIeXpSjzEMY550rhcNFIaxnD00=","Strict-Transport-Security":"max-age=31536000; includeSubDomains","Upgrade":"websocket"},"endTime":221414.067829}'))
  
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
      url.includes('googleapis.com') ||
      url.includes('googleusercontent.com') ||
      url.includes('gstatic.com')
    ) {
      return
    }

    const { requestId, request } = params
    const networkRequest: NetworkRequest = {
      id: requestId,
      startTime: Date.now(),
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
      startTime: Date.now(),
      type: 'websocket',
      url: url,
      method: 'OPEN',
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
    const { requestId } = params
    const request = requests.get(requestId)
    if (!request) return

    request.endTime = Date.now()
    debugWindow?.webContents?.send('network', request)

    // console.log('WS Done', JSON.stringify(request))

    // Cleanup after TTL
    setTimeout(() => {
      requests.delete(requestId)
    }, TTL)
  }

  function handleWebSocketError(params: any) {
    const { requestId, errorMessage } = params
    const request = requests.get(requestId)
    if (!request) return

    request.errorMessage = errorMessage
    request.endTime = Date.now()
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

    request.endTime = Date.now()

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

