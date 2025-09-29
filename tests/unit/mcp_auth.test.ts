import { vi, test, expect, beforeEach, describe } from 'vitest'
import { App } from 'electron'
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
  finishAuth: vi.fn()
}

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(() => mockClient)
}))

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(() => mockTransport)
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
  let mockApp: App

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.connect.mockClear()
    mockClient.close.mockClear()
    mockTransport.finishAuth.mockClear()
    mockServer.listen.mockClear()
    mockServer.close.mockClear()
    mockServer.on.mockClear()
    
    mockApp = {} as App
    manager = new McpOAuthManager(mockApp)
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

  test('startOAuthFlow with client credentials', async () => {
    const clientMetadata = {
      client_name: 'Test Client',
      redirect_uris: ['http://localhost:8090/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code']
    }
    
    const clientCredentials = {
      client_id: 'test-client-id',
      client_secret: 'test-client-secret'
    }
    
    mockServer.listen.mockImplementation((port, callback) => {
      callback()
    })
    mockClient.connect.mockResolvedValue(undefined)
    
    const result = await manager.startOAuthFlow('http://localhost:3000', clientMetadata, clientCredentials)
    
    const parsedResult = JSON.parse(result)
    expect(parsedResult.clientMetadata).toEqual(clientMetadata)
    expect(parsedResult.clientInformation).toBeDefined()
    expect(parsedResult.clientInformation.client_id).toBe('test-client-id')
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
    
    // Mock the callback server to simulate receiving an auth code
    const originalWaitForCallback = manager['callbackServer'].waitForCallback
    manager['callbackServer'].waitForCallback = vi.fn(() => Promise.resolve('test-auth-code'))
    
    const result = await manager.startOAuthFlow('http://localhost:3000', clientMetadata)
    
    const parsedResult = JSON.parse(result)
    expect(parsedResult.clientMetadata).toEqual(clientMetadata)
    expect(mockTransport.finishAuth).toHaveBeenCalledWith('test-auth-code')
    
    // Restore original method
    manager['callbackServer'].waitForCallback = originalWaitForCallback
  })

  test('completeOAuthFlow returns false (legacy method)', async () => {
    const result = await manager.completeOAuthFlow('server-uuid', 'auth-code')
    expect(result).toBe(false)
  })

  test('shutdown method exists', () => {
    expect(() => manager.shutdown()).not.toThrow()
  })
})

describe('OAuthCallbackServer', () => {
  let server: any
  let manager: McpOAuthManager
  let mockApp: App

  beforeEach(() => {
    vi.clearAllMocks()
    mockServer.listen.mockClear()
    mockServer.close.mockClear()
    mockServer.on.mockClear()
    
    mockApp = {} as App
    manager = new McpOAuthManager(mockApp)
    
    // Reset the singleton instance completely
    const OAuthCallbackServerClass = (manager as any).callbackServer.constructor
    OAuthCallbackServerClass.instance = null
    
    // Get fresh instance and reset all state
    server = OAuthCallbackServerClass.getInstance()
    server.server = null
    server.port = null
    server.pendingCallbacks.clear()
    
    // Close any existing server if it exists
    if (server.server) {
      server.server.close()
      server.server = null
    }
  })

  test('getInstance returns singleton', () => {
    const server1 = server.constructor.getInstance()
    const server2 = server.constructor.getInstance()
    expect(server1).toBe(server2)
  })


  test('ensureServerRunning starts server on available port', async () => {
    const mockCreatedServer = {
      listen: vi.fn((port, callback) => callback()),
      close: vi.fn(),
      on: vi.fn()
    }
    
    // Create a mock createServer function
    const mockCreateServer = vi.fn(() => mockCreatedServer)
    
    // Create a new server instance with the mock createServer
    const OAuthCallbackServerClass = server.constructor
    OAuthCallbackServerClass.instance = null
    const serverWithMock = OAuthCallbackServerClass.getInstance(mockCreateServer)
    
    await serverWithMock.ensureServerRunning()
    
    expect(mockCreateServer).toHaveBeenCalledTimes(1)
    expect(mockCreateServer).toHaveBeenCalledWith(expect.any(Function))
    expect(mockCreatedServer.listen).toHaveBeenCalledWith(8090, expect.any(Function))
    expect(serverWithMock.callbackPort).toBe(8090)
    expect(serverWithMock.server).toBe(mockCreatedServer)
  })

  test('waitForCallback resolves with authorization code', async () => {
    const flowId = 'test-flow'
    
    // Mock ensureServerRunning to avoid actual server creation
    const originalEnsureServerRunning = server.ensureServerRunning
    server.ensureServerRunning = vi.fn().mockResolvedValue(undefined)
    
    // Start the promise
    const callbackPromise = server.waitForCallback(flowId)
    
    // Wait a tick for the promise to set up the pending callback
    await new Promise(resolve => setImmediate(resolve))
    
    // Simulate receiving a callback by resolving the stored promise
    const pendingCallback = server.pendingCallbacks.get(flowId)
    if (pendingCallback) {
      clearTimeout(pendingCallback.timeout)
      pendingCallback.resolve('test-auth-code')
    }
    
    const result = await callbackPromise
    expect(result).toBe('test-auth-code')
    
    // Restore original method
    server.ensureServerRunning = originalEnsureServerRunning
  })

  test('ensureServerRunning reuses existing server', async () => {
    server.server = mockServer
    server.port = 8090
    
    await server.ensureServerRunning()
    
    // Should not create a new server
    expect(mockServer.listen).not.toHaveBeenCalled()
  })

  test('HTTP request handler processes successful OAuth callback', async () => {
    const mockCreatedServer = {
      listen: vi.fn((port, callback) => callback()),
      close: vi.fn(),
      on: vi.fn()
    }
    
    let requestHandler: any
    const mockCreateServer = vi.fn((handler) => {
      requestHandler = handler
      return mockCreatedServer
    })
    
    // Create server instance with mock createServer
    const OAuthCallbackServerClass = server.constructor
    OAuthCallbackServerClass.instance = null
    const serverWithMock = OAuthCallbackServerClass.getInstance(mockCreateServer)
    
    await serverWithMock.ensureServerRunning()
    
    // Set up a pending callback
    const mockResolve = vi.fn()
    const mockReject = vi.fn()
    const mockTimeout = setTimeout(() => {}, 1000)
    serverWithMock.pendingCallbacks.set('test-flow', {
      resolve: mockResolve,
      reject: mockReject,
      timeout: mockTimeout
    })
    
    // Mock request and response
    const mockReq = {
      url: '/callback?code=test-auth-code&state=test-flow'
    }
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    }
    
    // Call the request handler
    requestHandler(mockReq, mockRes)
    
    // Verify response
    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' })
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('mcp.oauth.success.title'))
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('mcp.oauth.success.message'))
    
    // Verify callback was resolved
    expect(mockResolve).toHaveBeenCalledWith('test-auth-code')
    expect(serverWithMock.pendingCallbacks.has('test-flow')).toBe(false)
    
    clearTimeout(mockTimeout)
  })

  test('HTTP request handler processes OAuth error callback', async () => {
    const mockCreatedServer = {
      listen: vi.fn((port, callback) => callback()),
      close: vi.fn(),
      on: vi.fn()
    }
    
    let requestHandler: any
    const mockCreateServer = vi.fn((handler) => {
      requestHandler = handler
      return mockCreatedServer
    })
    
    // Create server instance with mock createServer
    const OAuthCallbackServerClass = server.constructor
    OAuthCallbackServerClass.instance = null
    const serverWithMock = OAuthCallbackServerClass.getInstance(mockCreateServer)
    
    await serverWithMock.ensureServerRunning()
    
    // Set up a pending callback
    const mockResolve = vi.fn()
    const mockReject = vi.fn()
    const mockTimeout = setTimeout(() => {}, 1000)
    serverWithMock.pendingCallbacks.set('test-flow', {
      resolve: mockResolve,
      reject: mockReject,
      timeout: mockTimeout
    })
    
    // Mock request and response
    const mockReq = {
      url: '/callback?error=access_denied&state=test-flow'
    }
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    }
    
    // Call the request handler
    requestHandler(mockReq, mockRes)
    
    // Verify response
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'text/html' })
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Authorization Failed'))
    
    // Verify callback was rejected
    expect(mockReject).toHaveBeenCalledWith(new Error('OAuth authorization failed: access_denied'))
    expect(serverWithMock.pendingCallbacks.has('test-flow')).toBe(false)
    
    clearTimeout(mockTimeout)
  })

  test('HTTP request handler processes invalid callback requests', async () => {
    const mockCreatedServer = {
      listen: vi.fn((port, callback) => callback()),
      close: vi.fn(),
      on: vi.fn()
    }
    
    let requestHandler: any
    const mockCreateServer = vi.fn((handler) => {
      requestHandler = handler
      return mockCreatedServer
    })
    
    // Create server instance with mock createServer
    const OAuthCallbackServerClass = server.constructor
    OAuthCallbackServerClass.instance = null
    const serverWithMock = OAuthCallbackServerClass.getInstance(mockCreateServer)
    
    await serverWithMock.ensureServerRunning()
    
    // Set up a pending callback
    const mockResolve = vi.fn()
    const mockReject = vi.fn()
    const mockTimeout = setTimeout(() => {}, 1000)
    serverWithMock.pendingCallbacks.set('test-flow', {
      resolve: mockResolve,
      reject: mockReject,
      timeout: mockTimeout
    })
    
    // Mock request and response with no code or error
    const mockReq = {
      url: '/callback?state=test-flow'
    }
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn()
    }
    
    // Call the request handler
    requestHandler(mockReq, mockRes)
    
    // Verify response
    expect(mockRes.writeHead).toHaveBeenCalledWith(400)
    expect(mockRes.end).toHaveBeenCalledWith('Bad request')
    
    // Verify callback was rejected
    expect(mockReject).toHaveBeenCalledWith(new Error('No authorization code provided'))
    expect(serverWithMock.pendingCallbacks.has('test-flow')).toBe(false)
    
    clearTimeout(mockTimeout)
  })
})