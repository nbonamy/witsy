import { vi, test, expect, beforeEach, describe } from 'vitest'
import { app } from 'electron'
import McpOAuthManager, { McpOAuthClientProvider } from '../../src/main/mcp_auth'

// Mock Electron
vi.mock('electron', () => ({
  app: {
    getLocale: vi.fn(() => 'en-US'),
    getPath: vi.fn(() => '')
  },
  shell: {
    openExternal: vi.fn()
  }
}))

// Mock node:http
const mockServer = {
  listen: vi.fn(),
  close: vi.fn(),
  on: vi.fn()
}

// Mock HttpServer
const mockHttpServerInstance = {
  port: 8090,
  registerRoute: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  listen: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  ensureServerRunning: vi.fn(() => Promise.resolve()),
  getBaseUrl: vi.fn(() => 'http://localhost:8090')
}

vi.mock('../../src/main/http_server', () => ({
  HttpServer: {
    getInstance: vi.fn(() => mockHttpServerInstance)
  }
}))

// Mock portfinder
vi.mock('portfinder', () => ({
  default: {
    getPortPromise: vi.fn(() => Promise.resolve(8090))
  },
  getPortPromise: vi.fn(() => Promise.resolve(8090))
}))

vi.mock('../../src/main/i18n', () => ({
  useI18n: vi.fn(() => (key: string) => key)
}))

// Mock MCP SDK
const mockClient = {
  connect: vi.fn(),
  close: vi.fn()
}

const mockTransport = {
  finishAuth: vi.fn(),
  start: vi.fn(),
  send: vi.fn()
}

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => mockClient)
}))

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => mockTransport)
}))

vi.mock('@modelcontextprotocol/sdk/client/auth.js', () => ({
  UnauthorizedError: class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'UnauthorizedError'
    }
  }
}))

vi.mock('@modelcontextprotocol/sdk/shared/auth.js', () => ({
  OAuthClientInformation: {},
  OAuthClientInformationFull: {},
  OAuthClientMetadata: {},
  OAuthTokens: {}
}))

describe('McpOAuthClientProvider', () => {
  let provider: McpOAuthClientProvider
  let mockOnRedirect: ReturnType<typeof vi.fn>
  let mockOnTokensUpdated: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnRedirect = vi.fn()
    mockOnTokensUpdated = vi.fn()
    provider = new McpOAuthClientProvider(
      'http://localhost:8090/callback',
      {
        client_name: 'Test Client',
        redirect_uris: ['http://localhost:8090/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code']
      },
      mockOnRedirect,
      mockOnTokensUpdated
    )
  })

  test('constructor initializes properties correctly', () => {
    expect(provider.redirectUrl).toBe('http://localhost:8090/callback')
    expect(provider.clientMetadata).toEqual({
      client_name: 'Test Client',
      redirect_uris: ['http://localhost:8090/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code']
    })
  })

  test('clientInformation returns undefined initially', () => {
    expect(provider.clientInformation()).toBeUndefined()
  })

  test('saveClientInformation stores client info', () => {
    const clientInfo = {
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      redirect_uris: ['http://localhost:8090/callback'],
      token_endpoint_auth_method: 'client_secret_post',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      client_name: 'Test Client'
    }
    
    provider.saveClientInformation(clientInfo)
    expect(provider.clientInformation()).toEqual(clientInfo)
  })

  test('tokens returns undefined initially', () => {
    expect(provider.tokens()).toBeUndefined()
  })

  test('saveTokens stores tokens and calls callback', () => {
    const tokens = {
      access_token: 'test-access-token',
      token_type: 'bearer',
      refresh_token: 'test-refresh-token'
    }
    
    provider.saveTokens(tokens)
    expect(provider.tokens()).toEqual(tokens)
    expect(mockOnTokensUpdated).toHaveBeenCalledWith(tokens, '')
  })

  test('redirectToAuthorization calls redirect callback', () => {
    const authUrl = new URL('https://auth.example.com/oauth/authorize?client_id=test')
    provider.redirectToAuthorization(authUrl)
    expect(mockOnRedirect).toHaveBeenCalledWith(authUrl)
  })

  test('saveCodeVerifier stores code verifier', () => {
    const codeVerifier = 'test-code-verifier'
    provider.saveCodeVerifier(codeVerifier)
    expect(provider.codeVerifier()).toBe(codeVerifier)
  })

  test('codeVerifier throws error when not set', () => {
    expect(() => provider.codeVerifier()).toThrow('No code verifier saved')
  })
})

describe('McpOAuthManager', () => {
  let manager: McpOAuthManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.connect.mockClear()
    mockClient.close.mockClear()
    mockTransport.finishAuth.mockClear()
    mockServer.listen.mockClear()
    mockServer.close.mockClear()
    mockServer.on.mockClear()
    manager = new McpOAuthManager(app)
  })

  test('constructor initializes with app', () => {
    expect(manager).toBeDefined()
  })


  test('detectOAuth detects no OAuth required', async () => {
    mockClient.connect.mockResolvedValue(undefined)
    mockClient.close.mockResolvedValue(undefined)
    
    const result = await manager.detectOAuth('http://localhost:3000', {})
    
    expect(result).toEqual({ requiresOAuth: false })
    expect(mockClient.connect).toHaveBeenCalled()
    expect(mockClient.close).toHaveBeenCalled()
  })

  test('detectOAuth throws non-OAuth errors', async () => {
    const networkError = new Error('Network connection failed')
    mockClient.connect.mockRejectedValue(networkError)
    
    await expect(manager.detectOAuth('http://localhost:3000', {})).rejects.toThrow('Network connection failed')
  })

  describe('isOAuthRequiredError', () => {
    test('returns true for UnauthorizedError', async () => {
      const { UnauthorizedError } = await import('@modelcontextprotocol/sdk/client/auth.js')
      const error = new UnauthorizedError('Unauthorized')
      expect(manager.isOAuthRequiredError(error)).toBe(true)
    })

    test('returns true for dynamic client registration errors', () => {
      const error1 = new Error('Dynamic client registration required')
      const error2 = new Error('Server does not support dynamic client registration')
      
      expect(manager.isOAuthRequiredError(error1)).toBe(true)
      expect(manager.isOAuthRequiredError(error2)).toBe(true)
    })

    test('returns true for HTTP 401 with OAuth indicators', () => {
      const error1 = new Error('HTTP 401: invalid_token')
      const error2 = new Error('HTTP 401: missing authorization')
      const error3 = new Error('HTTP 401: authentication required')
      
      expect(manager.isOAuthRequiredError(error1)).toBe(true)
      expect(manager.isOAuthRequiredError(error2)).toBe(true)
      expect(manager.isOAuthRequiredError(error3)).toBe(true)
    })

    test('returns true for OAuth error responses', () => {
      const error1 = new Error('invalid_token')
      const error2 = new Error('access_denied')
      const error3 = new Error('insufficient_scope')
      
      expect(manager.isOAuthRequiredError(error1)).toBe(true)
      expect(manager.isOAuthRequiredError(error2)).toBe(true)
      expect(manager.isOAuthRequiredError(error3)).toBe(true)
    })

    test('returns false for non-OAuth errors', () => {
      const error1 = new Error('Network timeout')
      const error2 = new Error('HTTP 500: Internal server error')
      
      expect(manager.isOAuthRequiredError(error1)).toBe(false)
      expect(manager.isOAuthRequiredError(error2)).toBe(false)
    })
  })


  test('createOAuthProvider creates provider with custom metadata', async () => {
    const customMetadata = {
      client_name: 'Custom Client',
      redirect_uris: ['http://localhost:9000/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code']
    }
    
    const provider = await manager.createOAuthProvider(customMetadata)
    
    expect(provider.clientMetadata).toEqual(customMetadata)
  })

  test('startOAuthFlow handles UnauthorizedError', async () => {
    const clientMetadata = {
      client_name: 'Test Client',
      redirect_uris: ['http://localhost:8090/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code']
    }
    
    mockServer.listen.mockImplementation((port, callback) => {
      callback()
    })
    
    const { UnauthorizedError } = await import('@modelcontextprotocol/sdk/client/auth.js')
    const unauthorizedError = new UnauthorizedError('OAuth required')
    mockClient.connect.mockRejectedValueOnce(unauthorizedError).mockResolvedValueOnce(undefined)
    mockTransport.finishAuth.mockResolvedValue(undefined)
    
    // Mock the waitForCallback method on the manager itself
    const originalWaitForCallback = manager.waitForCallback
    manager.waitForCallback = vi.fn(() => Promise.resolve('test-auth-code'))
    
    await manager.startOAuthFlow('http://localhost:3000', clientMetadata)
    expect(mockTransport.finishAuth).toHaveBeenCalledWith('test-auth-code')
    
    // Restore original method
    manager.waitForCallback = originalWaitForCallback
  })

  test('completeOAuthFlow returns false (legacy method)', async () => {
    const result = await manager.completeOAuthFlow('server-uuid', 'auth-code')
    expect(result).toBe(false)
  })

  test('shutdown method exists', () => {
    expect(() => manager.shutdown()).not.toThrow()
  })
})

describe('McpOAuthManager - Callback Functionality', () => {
  let manager: McpOAuthManager
  let mockApp: App

  beforeEach(() => {
    vi.clearAllMocks()
    mockHttpServerInstance.registerRoute.mockClear()
    mockHttpServerInstance.listen.mockClear()
    mockHttpServerInstance.close.mockClear()
    
    mockApp = {} as App
    manager = new McpOAuthManager(mockApp)
  })

  test('waitForCallback resolves with authorization code', async () => {
    const flowId = 'test-flow'
    
    // Start the promise
    const callbackPromise = manager.waitForCallback(flowId)
    
    // Wait a tick for the promise to set up the pending callback
    await new Promise(resolve => setImmediate(resolve))
    
    // Simulate receiving a callback by resolving the stored promise
    const pendingCallback = (manager as any).pendingCallbacks.get(flowId)
    if (pendingCallback) {
      clearTimeout(pendingCallback.timeout)
      pendingCallback.resolve('test-auth-code')
    }
    
    const result = await callbackPromise
    expect(result).toBe('test-auth-code')
  })

  test('waitForCallback times out after 5 minutes', async () => {
    const flowId = 'test-timeout-flow'
    
    // Mock setTimeout to immediately trigger timeout
    const originalSetTimeout = global.setTimeout
    global.setTimeout = vi.fn((callback) => {
      // Immediately call the timeout callback
      callback()
      return {} as NodeJS.Timeout
    })
    
    await expect(manager.waitForCallback(flowId)).rejects.toThrow('OAuth callback timeout')
    
    // Restore original setTimeout
    global.setTimeout = originalSetTimeout
  })

  test('handleCallback processes successful OAuth callback', async () => {
    const flowId = 'test-flow'
    
    // Set up a pending callback
    const mockResolve = vi.fn()
    const mockReject = vi.fn()
    const mockTimeout = setTimeout(() => {}, 1000)
    ;(manager as any).pendingCallbacks.set(flowId, {
      resolve: mockResolve,
      reject: mockReject,
      timeout: mockTimeout
    })
    
    // Mock request and response
    const mockReq = {}
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    }
    const mockParsedUrl = new URL('http://localhost:8090/callback?code=test-auth-code&state=' + flowId)
    
    // Call the handleCallback method
    ;(manager as any).handleCallback(mockReq, mockRes, mockParsedUrl)
    
    // Verify response
    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' })
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('mcp.oauth.success.title'))
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('mcp.oauth.success.message'))
    
    // Verify callback was resolved
    expect(mockResolve).toHaveBeenCalledWith('test-auth-code')
    expect((manager as any).pendingCallbacks.has(flowId)).toBe(false)
    
    clearTimeout(mockTimeout)
  })

  test('handleCallback processes OAuth error callback', async () => {
    const flowId = 'test-error-flow'
    
    // Set up a pending callback
    const mockResolve = vi.fn()
    const mockReject = vi.fn()
    const mockTimeout = setTimeout(() => {}, 1000)
    ;(manager as any).pendingCallbacks.set(flowId, {
      resolve: mockResolve,
      reject: mockReject,
      timeout: mockTimeout
    })
    
    // Mock request and response
    const mockReq = {}
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    }
    const mockParsedUrl = new URL('http://localhost:8090/callback?error=access_denied&state=' + flowId)
    
    // Call the handleCallback method
    ;(manager as any).handleCallback(mockReq, mockRes, mockParsedUrl)
    
    // Verify response
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'text/html' })
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Authorization Failed'))
    
    // Verify callback was rejected
    expect(mockReject).toHaveBeenCalledWith(new Error('OAuth authorization failed: access_denied'))
    expect((manager as any).pendingCallbacks.has(flowId)).toBe(false)
    
    clearTimeout(mockTimeout)
  })

  test('handleCallback processes invalid callback requests', async () => {
    const flowId = 'test-invalid-flow'
    
    // Set up a pending callback
    const mockResolve = vi.fn()
    const mockReject = vi.fn()
    const mockTimeout = setTimeout(() => {}, 1000)
    ;(manager as any).pendingCallbacks.set(flowId, {
      resolve: mockResolve,
      reject: mockReject,
      timeout: mockTimeout
    })
    
    // Mock request and response with no code or error
    const mockReq = {}
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    }
    const mockParsedUrl = new URL('http://localhost:8090/callback?state=' + flowId)
    
    // Call the handleCallback method
    ;(manager as any).handleCallback(mockReq, mockRes, mockParsedUrl)
    
    // Verify response
    expect(mockRes.writeHead).toHaveBeenCalledWith(400)
    expect(mockRes.end).toHaveBeenCalledWith('Bad request')
    
    // Verify callback was rejected
    expect(mockReject).toHaveBeenCalledWith(new Error('No authorization code provided'))
    expect((manager as any).pendingCallbacks.has(flowId)).toBe(false)
    
    clearTimeout(mockTimeout)
  })

  test('handleCallback handles missing pending callback gracefully', async () => {
    // Mock request and response
    const mockReq = {}
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    }
    const mockParsedUrl = new URL('http://localhost:8090/callback?code=test-auth-code&state=nonexistent-flow')
    
    // Call the handleCallback method with no pending callback
    ;(manager as any).handleCallback(mockReq, mockRes, mockParsedUrl)
    
    // Should send 400 response when there's a code but no pending callback (falls through to else block)
    expect(mockRes.writeHead).toHaveBeenCalledWith(400)
    expect(mockRes.end).toHaveBeenCalledWith('Bad request')
  })

  test('multiple pending callbacks are handled independently', async () => {
    const flowId1 = 'test-flow-1'
    const flowId2 = 'test-flow-2'
    
    // Set up two pending callbacks
    const mockResolve1 = vi.fn()
    const mockResolve2 = vi.fn()
    const mockReject1 = vi.fn()
    const mockReject2 = vi.fn()
    
    ;(manager as any).pendingCallbacks.set(flowId1, {
      resolve: mockResolve1,
      reject: mockReject1,
      timeout: setTimeout(() => {}, 1000)
    })
    
    ;(manager as any).pendingCallbacks.set(flowId2, {
      resolve: mockResolve2,
      reject: mockReject2,
      timeout: setTimeout(() => {}, 1000)
    })
    
    // Mock first callback response
    const mockRes1 = { writeHead: vi.fn(), end: vi.fn() }
    const mockParsedUrl1 = new URL('http://localhost:8090/callback?code=auth-code-1&state=' + flowId1)
    ;(manager as any).handleCallback({}, mockRes1, mockParsedUrl1)
    
    // Verify first callback resolved, second still pending
    expect(mockResolve1).toHaveBeenCalledWith('auth-code-1')
    expect(mockResolve2).not.toHaveBeenCalled()
    expect((manager as any).pendingCallbacks.has(flowId1)).toBe(false)
    expect((manager as any).pendingCallbacks.has(flowId2)).toBe(true)
    
    // Mock second callback response  
    const mockRes2 = { writeHead: vi.fn(), end: vi.fn() }
    const mockParsedUrl2 = new URL('http://localhost:8090/callback?code=auth-code-2&state=' + flowId2)
    ;(manager as any).handleCallback({}, mockRes2, mockParsedUrl2)
    
    // Verify second callback resolved
    expect(mockResolve2).toHaveBeenCalledWith('auth-code-2')
    expect((manager as any).pendingCallbacks.has(flowId2)).toBe(false)
  })
})
