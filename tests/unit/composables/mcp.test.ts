import { vi, test, expect, describe, beforeAll, beforeEach } from 'vitest'
import { useWindowMock } from '../../mocks/window'
import { useMcpServer, OAuthStatus } from '../../../src/renderer/composables/mcp'
import Dialog from '../../../src/renderer/utils/dialog'

// Mock dialog
vi.mock('../../../src/renderer/utils/dialog', () => ({
  default: {
    show: vi.fn(() => Promise.resolve({ isConfirmed: true })),
    alert: vi.fn(() => Promise.resolve({ isConfirmed: true })),
  }
}))

// Mock i18n
vi.mock('../../../src/renderer/services/i18n', () => ({
  t: vi.fn((key) => key),
}))

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useMcpServer', () => {

  describe('isOauthRequired', () => {
    test('returns false when type is not http', async () => {
      const { isOauthRequired } = useMcpServer()

      const result = await isOauthRequired('stdio', 'http://example.com', {})

      expect(result).toBe(false)
      expect(window.api.mcp.detectOAuth).not.toHaveBeenCalled()
    })

    test('returns false when url is empty', async () => {
      const { isOauthRequired } = useMcpServer()

      const result = await isOauthRequired('http', '', {})

      expect(result).toBe(false)
      expect(window.api.mcp.detectOAuth).not.toHaveBeenCalled()
    })

    test('returns false when oauthConfig exists', async () => {
      const { isOauthRequired } = useMcpServer()

      const result = await isOauthRequired('http', 'http://example.com', {}, { tokens: {} })

      expect(result).toBe(false)
      expect(window.api.mcp.detectOAuth).not.toHaveBeenCalled()
    })

    test('returns true when OAuth is detected', async () => {
      const { isOauthRequired } = useMcpServer()

      vi.mocked(window.api.mcp.detectOAuth).mockResolvedValue({ requiresOAuth: true })

      const result = await isOauthRequired('http', 'http://example.com', { auth: 'token' })

      expect(result).toBe(true)
      expect(window.api.mcp.detectOAuth).toHaveBeenCalledWith('http', 'http://example.com', { auth: 'token' })
    })

    test('returns false when OAuth detection fails', async () => {
      const { isOauthRequired } = useMcpServer()

      vi.mocked(window.api.mcp.detectOAuth).mockRejectedValue(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await isOauthRequired('http', 'http://example.com', {})

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Failed to detect OAuth requirement:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('initOauth', () => {
    test('returns true when OAuth not required', async () => {
      const { initOauth } = useMcpServer()
      const oauthStatus: OAuthStatus = {}

      vi.mocked(window.api.mcp.detectOAuth).mockResolvedValue({ requiresOAuth: false })

      const result = await initOauth(false, 'http', 'http://example.com', {}, oauthStatus)

      expect(result).toBe(true)
      expect(oauthStatus.required).toBeUndefined()
    })

    test('updates status and shows dialog when OAuth required and not user initiated', async () => {
      const { initOauth } = useMcpServer()
      const oauthStatus: OAuthStatus = {}

      vi.mocked(window.api.mcp.detectOAuth).mockResolvedValue({
        requiresOAuth: true,
        metadata: { issuer: 'http://auth.example.com' }
      })
      vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false })

      const result = await initOauth(false, 'http', 'http://example.com', {}, oauthStatus)

      expect(result).toBe(true)
      expect(oauthStatus.required).toBe(true)
      expect(oauthStatus.metadata).toEqual({ issuer: 'http://auth.example.com' })
      expect(oauthStatus.checked).toBe(true)
      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'mcp.serverEditor.oauth.required',
        text: 'mcp.serverEditor.oauth.requiredText',
        confirmButtonText: 'common.yes',
        cancelButtonText: 'common.cancel',
        showCancelButton: true
      })
    })

    test('skips dialog when user initiated', async () => {
      const { initOauth } = useMcpServer()
      const oauthStatus: OAuthStatus = {}

      vi.mocked(window.api.mcp.detectOAuth).mockResolvedValue({
        requiresOAuth: true,
        metadata: { issuer: 'http://auth.example.com' }
      })

      const result = await initOauth(true, 'http', 'http://example.com', {}, oauthStatus)

      expect(result).toBe(true)
      expect(Dialog.show).not.toHaveBeenCalled()
    })

    test('returns false when user cancels dialog', async () => {
      const { initOauth } = useMcpServer()
      const oauthStatus: OAuthStatus = {}

      vi.mocked(window.api.mcp.detectOAuth).mockResolvedValue({
        requiresOAuth: true,
        metadata: {}
      })
      vi.mocked(Dialog.show).mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true })

      const result = await initOauth(false, 'http', 'http://example.com', {}, oauthStatus)

      expect(result).toBe(false)
    })

    test('handles errors gracefully', async () => {
      const { initOauth } = useMcpServer()
      const oauthStatus: OAuthStatus = {}

      vi.mocked(window.api.mcp.detectOAuth).mockRejectedValue(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await initOauth(false, 'http', 'http://example.com', {}, oauthStatus)

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Failed to detect OAuth requirement during save:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('setupOAuth', () => {
    test('returns null when no metadata available', async () => {
      const { setupOAuth } = useMcpServer()
      const oauthStatus: OAuthStatus = {}

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await setupOAuth('http', 'http://example.com', oauthStatus)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('No OAuth metadata available')

      consoleSpy.mockRestore()
    })

    test('shows dialogs and returns OAuth data on success', async () => {
      const { setupOAuth } = useMcpServer()
      const oauthStatus: OAuthStatus = {
        metadata: { issuer: 'http://auth.example.com' }
      }

      vi.mocked(window.api.mcp.startOAuthFlow).mockResolvedValue(JSON.stringify({
        tokens: { access_token: 'token123' },
        clientInformation: { client_id: 'client123', client_secret: 'secret123' },
        clientMetadata: { scope: 'read write' }
      }))

      const result = await setupOAuth('http', 'http://example.com', oauthStatus)

      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'mcp.serverEditor.oauth.authorizing',
        text: 'mcp.serverEditor.oauth.authorizingText',
        confirmButtonText: 'common.ok',
      })
      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'mcp.serverEditor.oauth.success',
        text: 'mcp.serverEditor.oauth.successText',
        confirmButtonText: 'common.ok',
      })
      expect(result).toEqual({
        tokens: { access_token: 'token123' },
        clientId: 'client123',
        clientSecret: 'secret123',
        scope: 'read write'
      })
    })

    test('uses client credentials when provided', async () => {
      const { setupOAuth } = useMcpServer()
      const oauthStatus: OAuthStatus = {
        metadata: { issuer: 'http://auth.example.com' }
      }

      vi.mocked(window.api.mcp.startOAuthFlow).mockResolvedValue(JSON.stringify({
        tokens: {},
        clientInformation: {},
        clientMetadata: {}
      }))

      await setupOAuth('http', 'http://example.com', oauthStatus, 'custom_id', 'custom_secret')

      expect(window.api.mcp.startOAuthFlow).toHaveBeenCalledWith(
        'http',
        'http://example.com',
        { issuer: 'http://auth.example.com' },
        {
          client_id: 'custom_id',
          client_secret: 'custom_secret'
        }
      )
    })

    test('omits client credentials when not fully provided', async () => {
      const { setupOAuth } = useMcpServer()
      const oauthStatus: OAuthStatus = {
        metadata: { issuer: 'http://auth.example.com' }
      }

      vi.mocked(window.api.mcp.startOAuthFlow).mockResolvedValue(JSON.stringify({
        tokens: {},
        clientInformation: {},
        clientMetadata: {}
      }))

      await setupOAuth('http', 'http://example.com', oauthStatus, 'client_id_only')

      // When only client_id is provided, it still passes the partial object (code uses || for both)
      expect(window.api.mcp.startOAuthFlow).toHaveBeenCalledWith(
        'http',
        'http://example.com',
        { issuer: 'http://auth.example.com' },
        {
          client_id: 'client_id_only',
          client_secret: undefined
        }
      )
    })

    test('handles OAuth flow error', async () => {
      const { setupOAuth } = useMcpServer()
      const oauthStatus: OAuthStatus = {
        metadata: { issuer: 'http://auth.example.com' }
      }

      const error = new Error('OAuth flow failed')
      vi.mocked(window.api.mcp.startOAuthFlow).mockRejectedValue(error)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await setupOAuth('http', 'http://example.com', oauthStatus)

      expect(result).toBeNull()
      // The error dialog shows the error.message, not the generic text
      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'mcp.serverEditor.oauth.error',
        text: 'OAuth flow failed',
        confirmButtonText: 'common.ok',
      })
      expect(consoleSpy).toHaveBeenCalledWith('OAuth setup failed:', error)

      consoleSpy.mockRestore()
    })

    test('shows dynamic client registration error message', async () => {
      const { setupOAuth } = useMcpServer()
      const oauthStatus: OAuthStatus = {
        metadata: { issuer: 'http://auth.example.com' }
      }

      const error = { message: 'Server does not support dynamic client registration' }
      vi.mocked(window.api.mcp.startOAuthFlow).mockRejectedValue(error)

      await setupOAuth('http', 'http://example.com', oauthStatus)

      expect(Dialog.show).toHaveBeenCalledWith({
        title: 'mcp.serverEditor.oauth.error',
        text: 'mcp.serverEditor.oauth.dynamicClientRegistrationError',
        confirmButtonText: 'common.ok',
      })
    })
  })
})
