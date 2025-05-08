
import { anyDict } from '../types/index'
import { App } from 'electron'
import { McpServer, McpClient, McpStatus, McpTool } from '../types/mcp'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { CompatibilityCallToolResultSchema } from '@modelcontextprotocol/sdk/types'
import { loadSettings, saveSettings, settingsFilePath } from './config'
import { execSync } from 'child_process'
import { LlmTool } from 'multi-llm-ts'
import Monitor from './monitor'

export default class {

  app: App
  monitor: Monitor|null
  currentConfig: string|null
  clients: McpClient[]
  logs: { [key: string]: string[] }
  
  constructor(app: App) {
    this.app = app
    this.clients = []
    this.monitor = null
    this.currentConfig = null
    this.logs = {}
  }

  getStatus = (): McpStatus => {
    return {
      servers: this.clients.map(client => ({
        ...client.server,
        tools: client.tools
      })),
      logs: this.logs
    }
  }

  getServers = (): McpServer[] => {
    const config = loadSettings(this.app)
    return [
      ...config.plugins.mcp.servers,
      ...Object.keys(config.mcpServers).reduce((arr: McpServer[], key: string) => {
        arr.push({
          uuid: key.replace('@', ''),
          registryId: key,
          state: config.plugins.mcp.disabledMcpServers?.includes(key) ? 'disabled' : 'enabled',
          type: 'stdio',
          command: config.mcpServers[key].command,
          url: config.mcpServers[key].args.join(' '),
          cwd: config.mcpServers[key].cwd,
          env: config.mcpServers[key].env
        })
        return arr
      }, [])
    ]
  }

  deleteServer = (uuid: string): boolean => {

    // we need a config
    let deleted = false
    const config = loadSettings(this.app)

    // first shutdown the client
    const client = this.clients.find((c: McpClient) => c.server.uuid === uuid)
    if (client) {
      this.disconnect(client)
    }

    // is it a normal server
    if (config.plugins.mcp.servers.find((s: McpServer) => s.uuid === uuid)) {
      config.plugins.mcp.servers = config.plugins.mcp.servers.filter((s: McpServer) => s.uuid !== uuid)
      deleted = true
    } else if (config.mcpServers[uuid]) {
      delete config.mcpServers[uuid]
      deleted = true
    } else if (config.mcpServers[`@${uuid}`]) {
      delete config.mcpServers[`@${uuid}`]
      deleted = true
    }

    // found
    if (deleted) {
      this.monitor?.stop()
      saveSettings(this.app, config)
      this.startConfigMonitor()
      return true
    }

    // not found
    return false

  }

  installServer = async (registry: string, server: string): Promise<boolean> => {

    const command = this.getInstallCommand(registry, server)
    if (!command) return false

    try {

      const before = this.getServers()

      this.monitor?.stop()
      const result = execSync(command).toString().trim()
      console.log(`MCP install ${server} result:`, result)

      // now we should be able to connect
      const after = this.getServers()
      const servers = after.filter(s => !before.find(b => b.uuid === s.uuid))
      if (servers.length === 1) {
        await this.connectToServer(servers[0])
      }

      // done
      return true

    } catch (e) {
      console.error(`Failed to install MCP server ${server}:`, e)
    } finally {
      this.startConfigMonitor()
    }
    
    // too bad
    return false
    
  }

  getInstallCommand = (registry: string, server: string): string|null => {
    if (registry === 'smithery') {
      return `npx -y @smithery/cli@latest install ${server} --client witsy`
    }
    return null
  }

  editServer = async (server: McpServer): Promise<boolean> => {

    // we need a config
    let edited = false
    const config = loadSettings(this.app)

    // create?
    if (server.uuid === null) {
      server.uuid = crypto.randomUUID()
      server.registryId = server.uuid
      config.plugins.mcp.servers.push(server)
      edited = true
    }

    // disconnect before editing
    const client = this.clients.find((c: McpClient) => c.server.uuid === server.uuid)
    if (client) {
      this.disconnect(client)
    }

    // search for server in normal server
    const original = config.plugins.mcp.servers.find((s: McpServer) => s.uuid === server.uuid)
    if (original) {
      original.type = server.type
      original.state = server.state
      original.command = server.command
      original.url = server.url
      original.cwd = server.cwd
      original.env = server.env
      edited = true
    }

    // and in mcp servers
    const originalMcp = config.mcpServers[server.registryId]
    if (originalMcp) {

      // state is outside of mcpServers
      if (server.state === 'disabled') {
        if (!config.plugins.mcp.disabledMcpServers) {
          config.plugins.mcp.disabledMcpServers = []
        }
        if (!config.plugins.mcp.disabledMcpServers.includes(server.registryId)) {
          config.plugins.mcp.disabledMcpServers.push(server.registryId)
        }
      } else {
        config.plugins.mcp.disabledMcpServers = config.plugins.mcp.disabledMcpServers.filter((s: string) => s !== server.registryId)
      }

      // rest is normal
      originalMcp.command = server.command
      originalMcp.args = server.url.split(' ')
      originalMcp.cwd = server.cwd
      originalMcp.env = server.env
      edited = true
    }

    // if added
    if (edited) {
      this.monitor?.stop()
      saveSettings(this.app, config)
      await this.connectToServer(server)
      this.startConfigMonitor()
      return true
    }
    
    // too bad
    return false

  }

  shutdown = async (): Promise<void> => {
    for (const client of this.clients) {
      await client.client.close()
    }
    this.clients = []
  }


  reload = async (): Promise<void> => {
    this.shutdown()
    await this.connect()
  }

  connect = async (): Promise<void> => {

    // now connect to servers
    const servers = this.getServers()
    for (const server of servers) {
      await this.connectToServer(server)
    }

    // save
    this.currentConfig = JSON.stringify(servers)
    this.startConfigMonitor()

    // done
    console.log('MCP servers connected', this.clients.map(client => client.server.uuid))

  }

  private startConfigMonitor = (): void => {
    if (!this.monitor) {
      this.monitor = new Monitor(() => {
        const servers = this.getServers()
        if (JSON.stringify(servers) !== this.currentConfig) {
          console.log('MCP servers changed, reloading')
          this.reload()
        }
      })
    }
    this.monitor.start(settingsFilePath(this.app))
  }

  private connectToServer = async(server: McpServer): Promise<boolean> => {

    // clear logs
    this.logs[server.uuid] = []

    // enabled
    if (server.state !== 'enabled') {
      return false
    }
    
    // now connect
    let client: Client = null
    if (server.type === 'stdio') {
      client = await this.connectToStdioServer(server)
    } else if (server.type === 'sse') {
      client = await this.connectToSseServer(server)
    }

    if (!client) {
      console.error(`Failed to connect to MCP server ${server.url}`)
      return false
    }

    // // reload on change
    // client.setNotificationHandler({ method: 'notifications/tools/list_changed' }, async () => {
    //   await this.reload()
    // })

    // get tools
    const tools = await client.listTools()
    const toolNames = tools.tools.map(tool => this.uniqueToolName(server, tool.name))

    // store
    this.clients.push({
      client,
      server,
      tools: toolNames
    })

    // done
    return true

  }

  private connectToStdioServer = async(server: McpServer): Promise<Client> => {

    try {

      // build command and args
      const command = process.platform === 'win32' ? 'cmd' : server.command
      const args = process.platform === 'win32' ? ['/C', `"${server.command}" ${server.url}`] : server.url.split(' ')
      let env = {
        ...getDefaultEnvironment(),
        ...server.env,
      }

      // clean up double cmd /c with smithery on windows
      if (command === 'cmd' && args.length > 0 && args[1].toLowerCase().startsWith('"cmd" /c')) {
        args[1] = args[1].slice(9)
      }

      // if env is empty, remove it
      if (Object.keys(env).length === 0) {
        env = undefined
      }

      // working directory
      const cwd = server.cwd || undefined

      // console.log('MCP Stdio command', process.platform, command, args, env)

      const transport = new StdioClientTransport({
        command, args, env, stderr: 'pipe', cwd
      })

      // start transport to get errors
      await transport.start()
      transport.stderr?.on('data', async (data: Buffer) => {
        const error = data.toString()
        this.logs[server.uuid].push(error)
      })

      // build the client
      const client = new Client({
        name: 'witsy-mcp-client',
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      })

      client.onerror = (e) => {
        this.logs[server.uuid].push(e.message)
      }

      // disable start and connect
      transport.start = async () => {}
      await client.connect(transport)

      // done
      return client

    } catch (e) {
      console.error(`Failed to connect to MCP server ${server.command} ${server.url}:`, e)
      this.logs[server.uuid].push(`Failed to connect to MCP server "${server.command} ${server.url}"\n`)
      this.logs[server.uuid].push(`Error: ${e.message}\n`)
      if (e.message.startsWith('spawn')) {
        const words = e.message.split(' ')
        if (words.length >= 2) {
          const cmd = e.message.split(' ')[1]
          this.logs[server.uuid].push(`Command not found: ${cmd}. Please install it and/or add it to your PATH.\n`)
          this.logs[server.uuid].push('Check https://github.com/nbonamy/witsy/wiki/MCP-Server-not-starting-on-macOS-and-Linux for more information.')
        } else {
          this.logs[server.uuid].push('Command not found. Please install it and/or add it to your PATH.\n')
          this.logs[server.uuid].push('Check https://github.com/nbonamy/witsy/wiki/MCP-Server-not-starting-on-macOS-and-Linux for more information.')
        }
      }
    }

  }

  private connectToSseServer = async(server: McpServer): Promise<Client> => {

    try {

      // get transport
      const transport = new SSEClientTransport(
        new URL(server.url)
      )

      // build the client
      const client = new Client({
        name: 'witsy-mcp-client',
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      })

      // connect
      await client.connect(transport)

      // done
      return client


    } catch (e) {
      console.error(`Failed to connect to MCP server ${server.url}:`, e)
      this.logs[server.uuid].push(e.message)
    }

  }
  
  private disconnect = (client: McpClient): void => {
    client.client.close()
    this.clients = this.clients.filter(c => c !== client)
  }

  getServerTools = async (uuid: string): Promise<McpTool[]> => {

    const client = this.clients.find(client => client.server.uuid === uuid)
    if (!client) return []

    const tools = await client.client.listTools()
    return tools.tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description    
    }))

  }

  getTools = async (): Promise<LlmTool[]> => {
    const allTools: LlmTool[] = []
    for (const client of this.clients) {
      try {
        const tools = await client.client.listTools()
        for (const tool of tools.tools) {
          try {
            const functionTool = this.mcpToOpenAI(client.server, tool)
            allTools.push(functionTool)
          } catch (e) {
            console.error(`Failed to convert MCP tool ${tool.name} from MCP server ${client.server.url} to OpenAI tool:`, e)
          }
        }
      } catch (e) {
        console.error(`Failed to get tools from MCP server ${client.server.url}:`, e)
      }
    }
    return allTools
  }

  callTool = async (name: string, args: anyDict): Promise<any> => {

    const client = this.clients.find(client => client.tools.includes(name))
    if (!client) {
      throw new Error(`Tool ${name} not found`)
    }

    // remove unique suffix
    const tool = this.originalToolName(name)
    console.log('Calling MCP tool', tool, args)

    return await client.client.callTool({
      name: tool,
      arguments: args
    }, CompatibilityCallToolResultSchema)

  }

  originalToolName(name: string): string {
    return name.replace(/___....$/, '')
  }

  protected uniqueToolName(server: McpServer, name: string): string {
    return `${name}___${server.uuid.padStart(4, '_').slice(-4)}`
  }

  protected mcpToOpenAI = (server: McpServer, tool: any): LlmTool => {
    return {
      type: 'function',
      function: {
        name: this.uniqueToolName(server, tool.name),
        description: tool.description ? tool.description.slice(0, 1024) : tool.name,
        parameters: {
          type: 'object',
          properties: tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties).reduce((obj: anyDict, key: string) => {
            const prop = tool.inputSchema.properties[key]
            obj[key] = {
              type: prop.type,
              description: (prop.description || key).slice(0, 1024),
              ...(prop.type === 'array' ? { items: prop.items || 'string' } : {}),
            }
            return obj
          }, {}) : {},
          required: tool.inputSchema?.required ?? []
        }
      }
    }
  }

}
