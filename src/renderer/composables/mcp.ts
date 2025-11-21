import { anyDict } from 'types/index'
import { McpServerType } from 'types/mcp'
import { t } from '@services/i18n'
import Dialog from '@renderer/utils/dialog'

export type OAuthStatus = {
  checking?: boolean
  checked?: boolean
  required?: boolean
  metadata?: any
}

export function useMcpServer() {

  const isOauthRequired = async (type: McpServerType, url: string, headers: Record<string, string>, oauthConfig?: any): Promise<boolean> => {

    if (!['http', 'sse'].includes(type) || !url || oauthConfig) {
      return false
    }

    try {
      const oauthCheck = await window.api.mcp.detectOAuth(type as 'http' | 'sse', url, JSON.parse(JSON.stringify(headers)))
      return oauthCheck.requiresOAuth
    } catch (e) {
      console.error('Failed to detect OAuth requirement:', e)
      return false
    }

  }

  const initOauth = async (userInitiated: boolean, type: McpServerType, url: string, headers: Record<string, string>, oauthStatus: OAuthStatus): Promise<boolean> => {

    try {
      const oauthCheck = await window.api.mcp.detectOAuth(type as 'http' | 'sse', url, JSON.parse(JSON.stringify(headers)))
      if (!oauthCheck.requiresOAuth) {
        return true
      }

      // Update OAuth status for UI
      oauthStatus.required = true
      oauthStatus.metadata = oauthCheck.metadata
      oauthStatus.checked = true

      // ask if required
      let result = { isConfirmed: true }
      if (!userInitiated) {
        result = await Dialog.show({
          title: t('mcp.serverEditor.oauth.required'),
          text: t('mcp.serverEditor.oauth.requiredText'),
          confirmButtonText: t('common.yes'),
          cancelButtonText: t('common.cancel'),
          showCancelButton: true
        })
      }

      if (result.isConfirmed) {
        return true
      } else {
        return false
      }
    
    } catch (error) {
      console.error('Failed to detect OAuth requirement during save:', error)
      return false
    }
  }

  const setupOAuth = async (type: McpServerType, url: string, oauthStatus: OAuthStatus, oauthClientId?: string, oauthClientSecret?: string): Promise<anyDict|null> => {

    if (!oauthStatus.metadata) {
      console.error('No OAuth metadata available')
      return null
    }

    try {
      // Show loading state
      await Dialog.show({
        title: t('mcp.serverEditor.oauth.authorizing'),
        text: t('mcp.serverEditor.oauth.authorizingText'),
        confirmButtonText: t('common.ok'),
      })

      // Start OAuth flow with optional client credentials
      const clientCredentials = (oauthClientId || oauthClientSecret) ? {
        client_id: oauthClientId,
        client_secret: oauthClientSecret
      } : undefined

      const oauthResult = await window.api.mcp.startOAuthFlow(
        type as 'http' | 'sse',
        url,
        JSON.parse(JSON.stringify(oauthStatus.metadata)),
        clientCredentials
      )
      
      await Dialog.show({
        title: t('mcp.serverEditor.oauth.success'),
        text: t('mcp.serverEditor.oauth.successText'),
        confirmButtonText: t('common.ok'),
      })

      const oauthData = JSON.parse(oauthResult)
      return {
        tokens: oauthData.tokens,
        clientId: oauthData.clientInformation?.client_id,
        clientSecret: oauthData.clientInformation?.client_secret,
        scope: oauthData.clientMetadata?.scope
      }

    } catch (error) {

      console.error('OAuth setup failed:', error)

      let text = error.message || t('mcp.serverEditor.oauth.errorText')
      if (text.includes('does not support dynamic client registration')) {
        text = t('mcp.serverEditor.oauth.dynamicClientRegistrationError')
      }

      await Dialog.show({
        title: t('mcp.serverEditor.oauth.error'),
        text: text,
        confirmButtonText: t('common.ok'),
      })

      return null
    }
  }


  return {
    isOauthRequired,
    initOauth,
    setupOAuth,
  }
}
