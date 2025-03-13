
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

      // requestWillBeSent
      if (method === 'Network.requestWillBeSent') {

        // for all
        if (params.request.url.startsWith('file://') || params.request.url.startsWith('chrome-extension://')) {
          return
        }

        // for debug
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL && params.request.url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
          return
        }

        const { requestId, request } = params
        requests.set(requestId, {
          id: requestId,
          url: request.url,
          method: request.method,
          headers: request.headers,
          postData: request.postData,
        })

        // emit event
        debugWindow?.webContents?.send('network', requests.get(requestId))

        // done
        return
      }

      // only for requests we are tracking
      const { requestId } = params
      if (!requests.has(requestId)) {
        return
      }

      // responseReceived
      if (method === 'Network.responseReceived') {
        const { requestId, response } = params
        const request = requests.get(requestId)
        if (request) {
          const statusCode = response.status
          request.statusCode = statusCode
          request.statusText = response.statusText
          request.responseHeaders = response.headers
          request.mimeType = response.mimeType
        }

      }

      // loadingFinished
      if (method === 'Network.loadingFinished') {
        
        const request = requests.get(requestId)
        if (!request) return

        // get body
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
          request.responseBody = 'Unable to get response body. Error unknown'
          console.log(`Couldn't get response body for request ${requestId} ${request.url}: ${error.message}`)
        }

        // emit event
        debugWindow?.webContents?.send('network', request)

        // cleanup
        setTimeout(() => {
          requests.delete(requestId)
        }, TTL);

        // done
        return
      }

    })

  } catch (error) {
    console.error('Error attaching debugger', error)
  }

}

