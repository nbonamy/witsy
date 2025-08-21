import { App, shell } from 'electron'
import { createServer } from 'node:http'
import * as portfinder from 'portfinder'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { OAuthClientInformation, OAuthClientInformationFull, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import { OAuthClientProvider, UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'



/**
 * OAuth client provider for MCP servers that persists tokens to configuration
 */
export class McpOAuthClientProvider implements OAuthClientProvider {
  private _codeVerifier?: string
  private _redirectUrl: string | URL
  private _clientMetadata: OAuthClientMetadata
  private _onRedirect: (url: URL) => void
  private _clientInformation?: OAuthClientInformationFull
  private _tokens?: OAuthTokens

  constructor(
    redirectUrl: string | URL, 
    clientMetadata: OAuthClientMetadata, 
    onRedirect?: (url: URL) => void
  ) {
    this._redirectUrl = redirectUrl
    this._clientMetadata = clientMetadata
    this._onRedirect = onRedirect || ((url) => {
      console.log(`Redirect to: ${url.toString()}`)
    })
  }

  get redirectUrl(): string | URL {
    return this._redirectUrl
  }

  get clientMetadata(): OAuthClientMetadata {
    return this._clientMetadata
  }

  clientInformation(): OAuthClientInformation | undefined {
    return this._clientInformation
  }

  saveClientInformation(clientInformation: OAuthClientInformationFull): void {
    this._clientInformation = clientInformation
  }

  tokens(): OAuthTokens | undefined {
    return this._tokens
  }

  saveTokens(tokens: OAuthTokens): void {
    this._tokens = tokens
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this._onRedirect(authorizationUrl)
  }

  saveCodeVerifier(codeVerifier: string): void {
    this._codeVerifier = codeVerifier
  }

  codeVerifier(): string {
    if (!this._codeVerifier) {
      throw new Error('No code verifier saved')
    }
    return this._codeVerifier
  }

}

/**
 * OAuth flow manager for MCP servers
 */
// Global OAuth callback server singleton
class OAuthCallbackServer {
  private static instance: OAuthCallbackServer | null = null
  private server: any = null
  private port: number | null = null
  private pendingCallbacks: Map<string, { resolve: (code: string) => void, reject: (error: Error) => void, timeout: NodeJS.Timeout }> = new Map()

  get callbackPort(): number | null {
    return this.port
  }

  static getInstance(): OAuthCallbackServer {
    if (!OAuthCallbackServer.instance) {
      OAuthCallbackServer.instance = new OAuthCallbackServer()
    }
    return OAuthCallbackServer.instance
  }

  async waitForCallback(flowId: string): Promise<string> {
    // Start server if not already running (outside the Promise)
    await this.ensureServerRunning()
    
    return new Promise<string>((resolve, reject) => {
      // Set up timeout for this specific flow
      const timeout = setTimeout(() => {
        console.log(`⏰ OAuth callback timeout for flow ${flowId}`)
        this.pendingCallbacks.delete(flowId)
        reject(new Error('OAuth callback timeout'))
        
        // If no more pending callbacks, shutdown server
        if (this.pendingCallbacks.size === 0) {
          this.shutdown()
        }
      }, 300000) // 5 minute timeout

      // Store the callback handlers
      this.pendingCallbacks.set(flowId, { resolve, reject, timeout })
    })
  }

  async ensureServerRunning(): Promise<void> {
    if (this.server) {
      console.log('📡 OAuth callback server already running, reusing...')
      return
    }

    // Find an available port starting from 8090
    this.port = await portfinder.getPortPromise({ port: 8090 })
    console.log(`🚀 Starting OAuth callback server on port ${this.port}...`)
    this.server = createServer((req, res) => {
      // Ignore favicon requests
      if (req.url === '/favicon.ico') {
        res.writeHead(404)
        res.end()
        return
      }

      console.log(`📥 Received OAuth callback: ${req.url}`)
      const parsedUrl = new URL(req.url || '', 'http://localhost')
      const code = parsedUrl.searchParams.get('code')
      const error = parsedUrl.searchParams.get('error')
      const state = parsedUrl.searchParams.get('state') || 'default' // Use state to identify flow

      const pendingCallback = this.pendingCallbacks.get(state)
      
      if (code && pendingCallback) {
        console.log(`✅ Authorization code received for flow ${state}: ${code?.substring(0, 10)}...`)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <body>
              <h1>Authorization Successful!</h1>
              <p>You can close this window and return to the application.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `)

        // Clean up this specific callback
        clearTimeout(pendingCallback.timeout)
        this.pendingCallbacks.delete(state)
        pendingCallback.resolve(code)

        // If no more pending callbacks, shutdown server after a delay
        if (this.pendingCallbacks.size === 0) {
          setTimeout(() => this.shutdown(), 3000)
        }
      } else if (error) {
        console.log(`❌ Authorization error for flow ${state}: ${error}`)
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <body>
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
            </body>
          </html>
        `)

        if (pendingCallback) {
          clearTimeout(pendingCallback.timeout)
          this.pendingCallbacks.delete(state)
          pendingCallback.reject(new Error(`OAuth authorization failed: ${error}`))
        }

        // If no more pending callbacks, shutdown server
        if (this.pendingCallbacks.size === 0) {
          setTimeout(() => this.shutdown(), 1000)
        }
      } else {
        console.log(`❌ Invalid OAuth callback: no code or error parameter`)
        res.writeHead(400)
        res.end('Bad request')

        if (pendingCallback) {
          clearTimeout(pendingCallback.timeout)
          this.pendingCallbacks.delete(state)
          pendingCallback.reject(new Error('No authorization code provided'))
        }
      }
    })

    this.server.listen(this.port, () => {
      console.log(`✅ OAuth callback server listening on http://localhost:${this.port}`)
    })

    this.server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${this.port} is already in use - OAuth callback server may already be running`)
      } else {
        console.error('❌ OAuth callback server error:', err)
      }
    })
  }

  private shutdown(): void {
    if (this.server) {
      console.log('🛑 Shutting down OAuth callback server')
      this.server.close()
      this.server = null
      
      // Clean up any remaining callbacks
      for (const [flowId, callback] of this.pendingCallbacks) {
        clearTimeout(callback.timeout)
        callback.reject(new Error(`OAuth server shutdown (flow ${flowId})`))
      }
      this.pendingCallbacks.clear()
    }
  }
}

export default class McpOAuthManager {
  private app: App
  private client: Client | null = null
  private serverUrl: string = ''
  private callbackServer: OAuthCallbackServer
  
  constructor(app: App) {
    this.app = app
    this.callbackServer = OAuthCallbackServer.getInstance()
  }

  /**
   * Get standardized client metadata for Witsy
   */
  async getClientMetadata(): Promise<OAuthClientMetadata> {
    // Ensure server is running to get the port
    await this.callbackServer.ensureServerRunning()
    const callbackUrl = `http://localhost:${this.callbackServer.callbackPort}/callback`
    
    return {
      client_name: 'Witsy MCP Client',
      redirect_uris: [callbackUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      scope: 'mcp:tools'
    }
  }

  /**
   * Detect if a server requires OAuth by attempting to connect
   */
  async detectOAuth(url: string): Promise<{ requiresOAuth: boolean, metadata?: OAuthClientMetadata }> {
    try {
      // Try to connect to the server without OAuth to see if it's required
      const testTransport = new StreamableHTTPClientTransport(new URL(url))
      const testClient = new Client({
        name: 'witsy-oauth-detection',
        version: '1.0.0'
      }, {
        capabilities: {}
      })

      try {
        await testClient.connect(testTransport)
        await testClient.close()
        // If connection succeeds, OAuth is not required
        return { requiresOAuth: false }
      } catch (error) {
        // Check if this is an OAuth-related error
        const isOAuthError = this.isOAuthRequiredError(error)
        
        if (isOAuthError) {
          // OAuth is required - provide standardized Witsy client metadata
          const clientMetadata = await this.getClientMetadata()
          console.log(`OAuth required for ${url}:`, error.message)
          return { requiresOAuth: true, metadata: clientMetadata }
        } else {
          // Some other error - re-throw
          throw error
        }
      }
    } catch (error) {
      console.error(`Failed to detect OAuth requirement for ${url}:`, error)
      throw error
    }
  }

  /**
   * Check if an error indicates OAuth is required
   */
  isOAuthRequiredError(error: any): boolean {
    // Check for UnauthorizedError from MCP SDK
    if (error instanceof UnauthorizedError) {
      return true
    }

    // Check for HTTP 401 errors with OAuth-specific messages
    const errorMessage = error?.message || ''
    const lowerMessage = errorMessage.toLowerCase()
    
    // Treat dynamic client registration errors as OAuth requirement
    if (lowerMessage.includes('dynamic client registration') ||
        lowerMessage.includes('does not support dynamic client registration')) {
      return true
    }
    
    // Look for OAuth-specific error patterns
    if (lowerMessage.includes('http 401') && (
      lowerMessage.includes('invalid_token') ||
      lowerMessage.includes('missing') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('authentication required')
    )) {
      return true
    }

    // Check for common OAuth error responses
    if (lowerMessage.includes('invalid_token') || 
        lowerMessage.includes('access_denied') ||
        lowerMessage.includes('insufficient_scope')) {
      return true
    }

    return false
  }

  /**
   * Opens the authorization URL in the user's default browser
   */
  private async openBrowser(url: string): Promise<void> {
    console.log(`🌐 Opening browser for authorization: ${url}`);

    // Use shell.openExternal for Electron instead of exec for cross-platform compatibility
    shell.openExternal(url);
  }

  /**
   * Start OAuth authorization flow - simplified to match reference implementation
   */
  async startOAuthFlow(
    url: string, 
    clientMetadata: OAuthClientMetadata,
    clientCredentials?: { client_id: string; client_secret: string }
  ): Promise<string> {
    console.log(`🔗 Attempting to connect to ${url}...`);
    this.serverUrl = url;
    
    // Generate unique flow ID for this OAuth attempt
    const flowId = `oauth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    console.log(`🆔 OAuth flow ID: ${flowId}`)
    
    console.log('🔐 Creating OAuth provider...');
    const callbackUrl = `http://localhost:${this.callbackServer.callbackPort}/callback`
    const oauthProvider = new McpOAuthClientProvider(
      callbackUrl,
      clientMetadata,
      (redirectUrl: URL) => {
        // Add state parameter to identify this specific flow
        const urlWithState = new URL(redirectUrl.toString())
        urlWithState.searchParams.set('state', flowId)
        
        console.log(`📌 OAuth redirect handler called - opening browser`);
        console.log(`Opening browser to: ${urlWithState.toString()}`);
        this.openBrowser(urlWithState.toString());
      }
    );
    
    // Set client credentials if provided (for servers that don't support dynamic registration)
    if (clientCredentials) {
      console.log('🔑 Using provided client credentials');
      const clientInformation = {
        client_id: clientCredentials.client_id,
        client_secret: clientCredentials.client_secret,
        redirect_uris: [callbackUrl],
        token_endpoint_auth_method: 'client_secret_post',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        client_name: 'Witsy MCP Client',
        scope: 'mcp:tools'
      }
      oauthProvider.saveClientInformation(clientInformation);
    }
    
    console.log('🔐 OAuth provider created');

    console.log('👤 Creating MCP client...');
    this.client = new Client({
      name: 'witsy-oauth-client',
      version: '1.0.0',
    }, { capabilities: {} });
    console.log('👤 Client created');

    console.log('🔐 Starting OAuth flow...');
    await this.attemptConnection(oauthProvider, flowId);
    
    // Return the OAuth configuration with tokens
    const tokens = oauthProvider.tokens();
    return JSON.stringify({
      clientMetadata,
      tokens,
      clientInformation: oauthProvider.clientInformation()
    });
  }

  /**
   * Attempt connection - matches reference implementation exactly
   */
  private async attemptConnection(oauthProvider: McpOAuthClientProvider, flowId: string): Promise<void> {
    console.log('🚢 Creating transport with OAuth provider...');
    const baseUrl = new URL(this.serverUrl);
    const transport = new StreamableHTTPClientTransport(baseUrl, {
      authProvider: oauthProvider
    });
    console.log('🚢 Transport created');

    try {
      console.log('🔌 Attempting connection (this will trigger OAuth redirect)...');
      await this.client!.connect(transport);
      console.log('✅ Connected successfully');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        console.log('🔐 OAuth required - waiting for authorization...');
        const authCode = await this.callbackServer.waitForCallback(flowId);
        await transport.finishAuth(authCode);
        console.log('🔐 Authorization code received:', authCode);
        console.log('🔌 Reconnecting with authenticated transport...');
        await this.attemptConnection(oauthProvider, flowId);
      } else {
        console.error('❌ Connection failed with non-auth error:', error);
        throw error;
      }
    }
  }


  /**
   * Complete OAuth flow with authorization code - for test compatibility
   */
  async completeOAuthFlow(serverUuid: string, authorizationCode: string): Promise<boolean> {
    console.log(`Completing OAuth flow for server ${serverUuid} with code: ${authorizationCode.substring(0, 10)}...`)
    
    // In the new reference implementation pattern, OAuth completion is handled
    // by the temporary callback server in waitForOAuthCallback()
    // This method is mainly kept for backward compatibility with tests
    
    // The OAuth manager doesn't track individual server flows anymore,
    // so we return false to let the Mcp class handle it via transport.finishAuth()
    return false
  }


  /**
   * Create an OAuth provider for a server - simplified
   */
  async createOAuthProvider(
    clientMetadata?: OAuthClientMetadata, 
    onRedirect?: (url: URL) => void
  ): Promise<McpOAuthClientProvider> {
    // Use provided metadata or generate standardized Witsy client metadata
    const metadata = clientMetadata || await this.getClientMetadata()
    const redirectUrl = metadata.redirect_uris?.[0] || `http://localhost:${this.callbackServer.callbackPort}/callback`
    return new McpOAuthClientProvider(redirectUrl, metadata, onRedirect)
  }

  /**
   * Clean up resources - simplified
   */
  shutdown(): void {
    // No persistent resources to clean up in the new implementation
  }

}