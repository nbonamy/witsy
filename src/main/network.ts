
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

        // get
        const url = params.request.url

        // for all
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return
        }

        // for debug
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
          return
        }

        // other stuff
        if (
          url.includes('googlefonts') ||
          url.includes('storage.googleapis.com')/* ||
          (url.includes('queue.fal.run') && url.includes('status?logs=0'))*/
        ) {
          return
        }

        const { requestId, request } = params
        const networkRequest = {
          id: requestId,
          url: request.url,
          method: request.method,
          headers: request.headers,
          postData: request.postData,
        }

        // hide api keys
        // anthropic: x-api-key
        // google: x-goog-api-key
        // replicate/huggingface: Authorization
        // others: authorization
        for (const key of ['x-api-key', 'x-goog-api-key', 'authorization' ]) {
          Object.keys(networkRequest.headers).filter((k) => k.toLocaleLowerCase() == key).forEach(k => {
            networkRequest.headers[k] = '*** hidden ***'
          })
        }

        // save
        requests.set(requestId, networkRequest)

        // emit event
        debugWindow?.webContents?.send('network', networkRequest)

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
        if (!request) return
          
        const statusCode = response.status
        request.statusCode = statusCode
        request.statusText = response.statusText
        request.responseHeaders = response.headers
        request.mimeType = response.mimeType

        // // emit event
        // debugWindow?.webContents?.send('network', request)

        // done
        return
      }

      // loadingFinished / loadingFailed
      if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
        
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
          request.responseBody = `Unable to get response body. ${error.message}`
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

      // debug
      //console.log('Unhandled Network event', method, params)

    })

    window.on('close', () => {
      try {
        window.webContents.debugger.detach()
      } catch (error) {
        console.error('Error detaching debugger', error)
      }
    })

  } catch (error) {
    console.error('Error attaching debugger', error)
  }

}

