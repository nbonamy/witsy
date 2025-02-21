
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { strDict } from './index'

export type McpServerType = 'stdio' | 'sse'

export type McpServer = {
  uuid: string|null
  registryId: string|null
  state: 'enabled' | 'disabled'
  type: McpServerType
  command?: string
  url: string
  env?: strDict
}

export type McpClient = {
  client: Client
  server: McpServer
  tools: string[]
}

export type McpClaudeServer = {
  command: string
  args: string[]
  env?: strDict
}

export type McpServerStatus = McpServer & {
  tools: string[]
}

export type McpStatus = {
  servers: McpServerStatus[]
  logs: { [key: string]: string[] }
}
