import { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Send JSON response
 */
export function sendJson(res: ServerResponse, data: any, statusCode = 200): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/**
 * Send error response
 */
export function sendError(res: ServerResponse, message: string, statusCode = 400): void {
  sendJson(res, { success: false, error: message }, statusCode)
}

/**
 * Parse request parameters from GET query or POST body
 */
export async function parseParams(req: IncomingMessage, parsedUrl: URL): Promise<Record<string, string>> {
  const params: Record<string, string> = {}

  // Parse query parameters (GET requests)
  parsedUrl.searchParams.forEach((value, key) => {
    params[key] = value
  })

  // Parse POST body if present
  if (req.method === 'POST') {
    try {
      const body = await new Promise<string>((resolve, reject) => {
        let data = ''
        req.on('data', chunk => data += chunk)
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })

      if (body) {
        const contentType = req.headers['content-type'] || ''

        if (contentType.includes('application/json')) {
          const jsonData = JSON.parse(body)
          Object.assign(params, jsonData)
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const urlParams = new URLSearchParams(body)
          urlParams.forEach((value, key) => {
            params[key] = value
          })
        }
      }
    } catch (error) {
      console.error('[http] Error parsing POST body:', error)
    }
  }

  return params
}
