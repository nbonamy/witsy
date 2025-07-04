
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { strDict } from './index'

export type McpServerType = 'stdio' | 'sse' | 'http'

export type McpInstallStatus = 'success' | 'api_key_missing' | 'not_found' | 'error'

export type McpServer = {
  uuid: string | null
  registryId: string | null
  state: 'enabled' | 'disabled'
  type: McpServerType
  title?: string
  command?: string
  url: string
  cwd?: string
  env?: strDict
  headers?: strDict
}

export type McpClient = {
  client: Client
  server: McpServer
  tools: string[]
}

export type McpTool = {
  name: string
  description: string
}

export type McpClaudeServer = {
  command: string
  args: string[]
  cwd?: string
  env?: strDict
  headers?: strDict
}

export type McpServerStatus = McpServer & {
  tools: string[]
}

export type McpStatus = {
  servers: McpServerStatus[]
  logs: { [key: string]: string[] }
}
