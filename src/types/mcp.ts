
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { strDict } from './index'
import { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import { ToolSelection } from './llm'

export type McpServerType = 'stdio' | 'sse' | 'http'

export type McpInstallStatus = 'success' | 'api_key_missing' | 'not_found' | 'error'

export type McpServerState = 'enabled' | 'disabled'

export type McpServer = {
  uuid: string | null
  registryId: string | null
  state: McpServerState
  type: McpServerType
  label?: string
  command?: string
  url: string
  cwd?: string
  env?: strDict
  headers?: strDict
  oauth?: McpOAuthConfig
  timeout?: number
  toolSelection: ToolSelection
  toolMappings?: Record<string, string> // originalName -> mappedName (only for collisions)
}

export type McpOAuthConfig = {
  tokens?: OAuthTokens
  clientId?: string
  clientSecret?: string
  scope?: string
}

export type McpClient = {
  client: Client
  server: McpServer
  tools: string[]
}

export type McpTool = {
  name: string
  function: string
  description: string
  inputSchema?: {
    type: 'object'
    properties?: Record<string, any>
    required?: string[]
  }
}

export type McpServerWithTools = McpServer & {
  tools: McpTool[]
}

export type McpClaudeServer = {
  command: string
  args: string[]
  cwd?: string
  env?: strDict
  headers?: strDict
}

export type McpServerStatus = McpServer & {
  tools?: string[] | null
}

export type McpStatus = {
  servers: McpServerStatus[]
  logs: { [key: string]: string[] }
}
