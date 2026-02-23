
import { vi, test, expect, beforeEach } from 'vitest'
import type { McpServer } from '@/types/mcp'
import { app } from 'electron'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import mcpConfig from '@tests/fixtures/mcp.json'
import Mcp from '@main/mcp'
import { Configuration } from '@/types/config'

vi.mock('electron', async() => {
  return {
    app: {
      getPath: () => './tests/fixtures',
      getLocale: () => 'en-US'
    },
  }
})

vi.mock('@main/i18n', () => ({
  useI18n: vi.fn(() => (key: string) => key)
}))

// mess with default / execSync so hack
let command: string|null = null
vi.mock('child_process', async () => {
  return { default: {
    exec: vi.fn((cmd) => { command = cmd; return {
      on: vi.fn(),
      stdout: { on: vi.fn((signal, callback) => {
        console.log('stdout', signal, callback)
        if (signal === 'data') {
          callback('successfully installed')
        }
      }) },
      stderr: { on: vi.fn() },
    } })
  }}
})

let config: Configuration = mcpConfig as unknown as Configuration

vi.mock('@main/config', async () => {
  return {
    settingsFilePath: vi.fn(() => './tests/fixtures/config1.json'),
    saveSettings: vi.fn((_, cfg) => config = cfg),
    loadSettings: vi.fn(() => config)
  }
})

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', async () => {
  const StdioClientTransport = vi.fn()
  StdioClientTransport.prototype.start = vi.fn()
  StdioClientTransport.prototype.close = vi.fn()
  StdioClientTransport.prototype.send = vi.fn()
  return { StdioClientTransport, getDefaultEnvironment: vi.fn(() => ({
    PATH: '/tmp'
  })) }
})

vi.mock('@modelcontextprotocol/sdk/client/sse.js', async () => {
  const SSEClientTransport = vi.fn(function(url, options) {
    this.options = options
    this.finishAuth = vi.fn()
  })
  SSEClientTransport.prototype.start = vi.fn()
  SSEClientTransport.prototype.close = vi.fn()
  SSEClientTransport.prototype.send = vi.fn()
  return { SSEClientTransport }
})

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', async () => {
  const StreamableHTTPClientTransport = vi.fn(function(url, options) {
    this.options = options
    this.finishAuth = vi.fn()
  })
  StreamableHTTPClientTransport.prototype.start = vi.fn()
  StreamableHTTPClientTransport.prototype.close = vi.fn()
  StreamableHTTPClientTransport.prototype.send = vi.fn()
  return { StreamableHTTPClientTransport }
})

vi.mock('@modelcontextprotocol/sdk/client/auth.js', async () => {
  const UnauthorizedError = class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'UnauthorizedError'
    }
  }
  return { UnauthorizedError }
})

vi.mock('@modelcontextprotocol/sdk/shared/auth.js', async () => {
  return {
    OAuthClientInformation: {},
    OAuthClientInformationFull: {},
    OAuthClientMetadata: {},
    OAuthTokens: {}
  }
})

let count = 1
const mockConnect = vi.fn()
vi.mock('@modelcontextprotocol/sdk/client/index.js', async () => {
  const Client = vi.fn(function() {
    this.id = count++
  })
  Client.prototype.connect = vi.fn(function(transport) { 
    this.transport = transport 
    return mockConnect()
  })
  Client.prototype.close = vi.fn()
  Client.prototype.listTools = vi.fn(async () => ({
    tools: [
      { name: 'tool1', description: 'tool1 description', inputSchema: { type: 'object', properties: { arg: { type: 'string' }}, required: [] } },
      { name: 'tool2', inputSchema: { type: 'object', properties: { arg: { type: 'number', description: 'desc' }}, required: [] } },
      { name: 'tool3', description: 'tool3 description' },
    ]
  }))
  Client.prototype.callTool = vi.fn(function(params) {
    if (this.id == 1) return { toolResult: `${this.id}-${params.name}-${params.arguments.arg}-result` }
    else return { content: [ { type: 'text', text: `${this.id}-${params.name}-${params.arguments.arg}-result` }]}
  })
  return { Client }
})

beforeEach(() => {
  count = 1
  config = JSON.parse(JSON.stringify(mcpConfig))
  mockConnect.mockResolvedValue(undefined)
  vi.clearAllMocks()
})
  
test('Initialization', async () => {
  const mcp = new Mcp(app)
  expect(mcp).toBeDefined()
  expect(mcp.clients).toBeDefined()
  expect(Client.prototype.connect).toHaveBeenCalledTimes(0)
  expect(await mcp.getStatus()).toEqual({ servers: [
    expect.objectContaining({ uuid: '1234-5678-90ab', tools: undefined }),
    expect.objectContaining({ uuid: '2345-6789-0abc', tools: undefined }),
    expect.objectContaining({ uuid: '4567-890a-bcde', tools: undefined }),
    expect.objectContaining({ uuid: 's1', tools: undefined }),
  ], logs: {} })
  expect(mcp.getServers()).toStrictEqual([
    { uuid: '1234-5678-90ab', registryId: '1234-5678-90ab', state: 'enabled', type: 'stdio', command: 'node', url: 'script.js', cwd: 'cwd1', env: { KEY: 'value' }, oauth: null, toolSelection: null },
    { uuid: '2345-6789-0abc', registryId: '2345-6789-0abc', state: 'enabled', type: 'sse', url: 'http://localhost:3000', oauth: null, toolSelection: null },
    { uuid: '3456-7890-abcd', registryId: '3456-7890-abcd', state: 'disabled', type: 'stdio', command: 'python3', url: 'script.py', oauth: null, toolSelection: null },
    { uuid: '4567-890a-bcde', registryId: '4567-890a-bcde', state: 'enabled', type: 'http', url: 'http://localhost:3002', oauth: null, toolSelection: ['tool2'] },
    { uuid: 's1', registryId: 's1', state: 'enabled', type: 'stdio', label: undefined, command: 'npx', url: '-y run s1.js', cwd: 'cwd2', env: { KEY: 'value' }, oauth: undefined, toolSelection: null, toolMappings: undefined },
    { uuid: 'mcp2', registryId: 'mcp2', state: 'disabled', type: 'stdio', label: undefined, command: 'npx', url: '-y run mcp2.js', cwd: undefined, env: undefined, oauth: undefined, toolSelection: null, toolMappings: undefined }
  ])
})

test('Create server - Stdio', async () => {

  const mcp = new Mcp(app)
  expect(await mcp.editServer({
    uuid: null, registryId: null, state: 'enabled', type: 'stdio',
    command: 'node', url: 'script2.js', cwd: 'cwd1', env: { KEY: 'value' },
    toolSelection: ['tool1']
  })).toBe(true)
  expect(mcp.getServers()).toHaveLength(7)

  expect(getDefaultEnvironment).toHaveBeenCalledTimes(1)
  expect(SSEClientTransport).not.toHaveBeenCalled()
  expect(StreamableHTTPClientTransport).not.toHaveBeenCalled()
  expect(StdioClientTransport).toHaveBeenLastCalledWith({
    command: 'node',
    args: ['script2.js'],
    cwd: 'cwd1',
    env: { KEY: 'value', PATH: '/tmp' },
    stderr: 'pipe'
  })

  expect(mcp.getServers().find(s => s.url === 'script2.js')).toBeDefined()
  expect(config.mcp.servers.find(s => s.url === 'script2.js')).toStrictEqual({
    uuid: expect.any(String),
    registryId: expect.any(String),
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'script2.js',
    cwd: 'cwd1',
    env: { KEY: 'value' },
    headers: undefined,
    oauth: undefined,
    timeout: undefined,
    toolSelection: ['tool1'],
  })
})

test('Create server - SSE', async () => {
  const mcp = new Mcp(app)
  expect(await mcp.editServer({
    uuid: null, registryId: null, state: 'enabled', type: 'sse',
    url: 'http://localhost:3001',
    toolSelection: null,
  })).toBe(true)
  expect(mcp.getServers()).toHaveLength(7)
  
  expect(getDefaultEnvironment).not.toHaveBeenCalled()
  expect(StdioClientTransport).not.toHaveBeenCalled()
  expect(StreamableHTTPClientTransport).not.toHaveBeenCalled()
  expect(SSEClientTransport).toHaveBeenLastCalledWith(new URL('http://localhost:3001/'), {})
  expect(Client.prototype.connect).toHaveBeenLastCalledWith(expect.objectContaining({
    onerror: expect.any(Function),
  }))
  
  expect(mcp.getServers().find(s => s.url === 'http://localhost:3001')).toBeDefined()
  expect(config.mcp.servers.find(s => s.url === 'http://localhost:3001')).toStrictEqual({
    uuid: expect.any(String),
    registryId: expect.any(String),
    state: 'enabled',
    type: 'sse',
    command: undefined,
    url: 'http://localhost:3001',
    cwd: undefined,
    env: undefined,
    headers: undefined,
    oauth: undefined,
    timeout: undefined,
    toolSelection: null,
  })
})

test('Create server - HTTP', async () => {
  const mcp = new Mcp(app)
  expect(await mcp.editServer({
    uuid: null, registryId: null, state: 'enabled', type: 'http',
    url: 'http://localhost:3001', headers: { key: 'value' },
    toolSelection: null
  })).toBe(true)
  expect(mcp.getServers()).toHaveLength(7)
  
  expect(getDefaultEnvironment).not.toHaveBeenCalled()
  expect(StdioClientTransport).not.toHaveBeenCalled()
  expect(SSEClientTransport).not.toHaveBeenCalled()
  expect(StreamableHTTPClientTransport).toHaveBeenLastCalledWith(new URL('http://localhost:3001/'), {
    requestInit: {
      headers: { key: 'value' },
    }
  })
  expect(Client.prototype.connect).toHaveBeenLastCalledWith(expect.objectContaining({
    onerror: expect.any(Function),
    //onmessage: expect.any(Function),
  }))
  
  expect(mcp.getServers().find(s => s.url === 'http://localhost:3001')).toBeDefined()
  expect(config.mcp.servers.find(s => s.url === 'http://localhost:3001')).toStrictEqual({
    uuid: expect.any(String),
    registryId: expect.any(String),
    state: 'enabled',
    type: 'http',
    command: undefined,
    url: 'http://localhost:3001',
    cwd: undefined,
    env: undefined,
    headers: { key: 'value' },
    oauth: undefined,
    timeout: undefined,
    toolSelection: null,
  })
})

test('Edit normal server', async () => {
  const mcp = new Mcp(app)
  expect(await mcp.editServer({
    uuid: '2345-6789-0abc', registryId: '2345-6789-0abc', state: 'disabled', type: 'sse',
    url: 'http://localhost:3001',
    toolSelection: ['tool1']
  })).toBe(true)
  expect(mcp.getServers()[1]).toMatchObject({
    uuid: '2345-6789-0abc',
    registryId: '2345-6789-0abc',
    state: 'disabled',
    type: 'sse',
    url: 'http://localhost:3001',
  })
  expect(config.mcp.servers[1]).toMatchObject({
    uuid: '2345-6789-0abc',
    registryId: '2345-6789-0abc',
    state: 'disabled',
    type: 'sse',
    url: 'http://localhost:3001',
    toolSelection: ['tool1']
  })
})

test('Edit server label', async () => {
  const mcp = new Mcp(app)
  // set a non-empty label (trimmed)
  expect(await mcp.editServer({
    uuid: '2345-6789-0abc', registryId: '2345-6789-0abc', state: 'enabled', type: 'sse',
    url: 'http://localhost:3001', label: '  My Title  ', toolSelection: null
  })).toBe(true)
  const withLabel = mcp.getServers().find(s => s.uuid === '2345-6789-0abc') as McpServer | undefined
  expect(withLabel?.label).toBe('My Title')
  const cfgWithLabel = config.mcp.servers.find(s => s.uuid === '2345-6789-0abc') as McpServer | undefined
  expect(cfgWithLabel?.label).toBe('My Title')

  // clear the label by providing an empty string
  expect(await mcp.editServer({
    uuid: '2345-6789-0abc', registryId: '2345-6789-0abc', state: 'enabled', type: 'sse',
    url: 'http://localhost:3001', label: '', toolSelection: null
  })).toBe(true)
  const noTitle = mcp.getServers().find(s => s.uuid === '2345-6789-0abc') as McpServer | undefined
  expect(noTitle?.label).toBeUndefined()
  const cfgNoTitle = config.mcp.servers.find(s => s.uuid === '2345-6789-0abc') as McpServer | undefined
  expect(cfgNoTitle?.label).toBeUndefined()
})

test('Edit mcp server', async () => {
  const mcp = new Mcp(app)
  expect(await mcp.editServer({
    uuid: 's1', registryId: 's1', state: 'enabled', type: 'stdio',
    command: 'node', url: '-f exec s1.js',
    toolSelection: null
  })).toBe(true)
  
  expect(getDefaultEnvironment).toHaveBeenCalledTimes(1)
  expect(StdioClientTransport).toHaveBeenLastCalledWith({
    command: 'node',
    args: ['-f', 'exec', 's1.js'],
    env: { PATH: '/tmp' },
    stderr: 'pipe'
  })
  expect(StdioClientTransport.prototype.start).toHaveBeenLastCalledWith()
  expect(Client.prototype.connect).toHaveBeenLastCalledWith({ start: expect.any(Function) })
  expect(SSEClientTransport.prototype.start).toHaveBeenCalledTimes(0)
  
  expect(mcp.getServers()[4]).toMatchObject({
    uuid: 's1',
    registryId: 's1',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: '-f exec s1.js',
  })
  expect(config.mcp.mcpServersExtra['mcp2'].state).toEqual('disabled')
  expect(config.mcpServers['s1']).toMatchObject({
    command: 'node',
    args: ['-f', 'exec', 's1.js'],
  })
  expect(await mcp.editServer({
    uuid: 'mcp2', registryId: 'mcp2', state: 'disabled', type: 'stdio',
    command: 'npx', url: '-y run mcp2.js',
    toolSelection: null
  })).toBe(true)
  expect(config.mcp.mcpServersExtra['mcp2'].state).toEqual('disabled')
  expect(config.mcp.mcpServersExtra['mcp2'].toolSelection).toBeNull()
  
  expect(await mcp.editServer({
    uuid: 'mcp2', registryId: 'mcp2', state: 'enabled', type: 'stdio',
    command: 'npx', url: '-y run mcp2.js',
    toolSelection: null
  })).toBe(true)
  expect(config.mcp.mcpServersExtra['mcp2'].state).toEqual('enabled')
  expect(config.mcp.mcpServersExtra['mcp2'].toolSelection).toBeNull()
  
  expect(await mcp.editServer({
    uuid: 'mcp2', registryId: 'mcp2', state: 'disabled', type: 'stdio',
    command: 'npx', url: '-y run mcp2.js',
    toolSelection: ['tool1']
  })).toBe(true)
  expect(config.mcp.mcpServersExtra['mcp2'].state).toEqual('disabled')
  expect(config.mcp.mcpServersExtra['mcp2'].toolSelection).toStrictEqual(['tool1'])
  
  expect(await mcp.editServer({
    uuid: 's1', registryId: 's1', state: 'disabled', type: 'stdio',
    command: 'node', url: '-f exec s1.js',
    toolSelection: ['tool1']
  })).toBe(true)
  expect(config.mcp.mcpServersExtra['mcp2'].state).toEqual('disabled')
  expect(config.mcp.mcpServersExtra['s1'].state).toEqual('disabled')

})

test('Delete server', async () => {
  const mcp = new Mcp(app)
  expect(mcp.getServers().length).toBe(6)
  expect(mcp.deleteServer('1234-5678-90ab')).toBe(true)
  expect(mcp.getServers().length).toBe(5)
  expect(mcp.getServers().find(s => s.uuid === '1234-5678-90ab')).toBeUndefined()
  expect(config.mcp.servers.find(s => s.uuid === '1234-5678-90ab')).toBeUndefined()
  expect(mcp.deleteServer('s1')).toBe(true)
  expect(mcp.getServers().length).toBe(4)
  expect(mcp.getServers().find(s => s.uuid === 's1')).toBeUndefined()
  expect(config.mcpServers['s1']).toBeUndefined()
  expect(mcp.deleteServer('4')).toBe(false)
  expect(mcp.getServers().length).toBe(4)
  expect(mcp.deleteServer('@mcp2')).toBe(false)
})

test('Connect', async () => {
  const mcp = new Mcp(app)
  expect(await mcp.connect())
  expect(mcp.clients).toHaveLength(4)
  // With new collision handling: first server keeps original names, subsequent servers get _N suffixes
  expect(await mcp.getStatus()).toStrictEqual({
    servers: [
      { uuid: '1234-5678-90ab', registryId: '1234-5678-90ab', state: 'enabled', type: 'stdio', command: 'node', url: 'script.js', cwd: 'cwd1', env: { KEY: 'value' }, oauth: null, toolSelection: null, tools: ['tool1', 'tool2', 'tool3'] },
      { uuid: '2345-6789-0abc', registryId: '2345-6789-0abc', state: 'enabled', type: 'sse', url: 'http://localhost:3000', oauth: null, toolSelection: null, toolMappings: { tool1: 'tool1_1', tool2: 'tool2_1', tool3: 'tool3_1' }, tools: ['tool1_1', 'tool2_1', 'tool3_1'] },
      { uuid: '4567-890a-bcde', registryId: '4567-890a-bcde', state: 'enabled', type: 'http', url: 'http://localhost:3002', oauth: null, toolSelection: ['tool2'], toolMappings: { tool1: 'tool1_2', tool2: 'tool2_2', tool3: 'tool3_2' }, tools: ['tool1_2', 'tool2_2', 'tool3_2'] },
      { uuid: 's1', registryId: 's1', state: 'enabled', type: 'stdio', label: undefined, command: 'npx', url: '-y run s1.js', cwd: 'cwd2', env: { KEY: 'value' }, oauth: undefined, toolSelection: null, toolMappings: { tool1: 'tool1_3', tool2: 'tool2_3', tool3: 'tool3_3' }, tools: ['tool1_3', 'tool2_3', 'tool3_3'] },
    ],
    logs: {
      '1234-5678-90ab': [],
      '2345-6789-0abc': [ 'Connected to MCP server at http://localhost:3000' ],
      '3456-7890-abcd': [],
      '4567-890a-bcde': [ 'Connected to MCP server at http://localhost:3002' ],
      's1': [],
      'mcp2': [],
    }
  })
  expect(await mcp.getLlmTools()).toStrictEqual([
    { name: 'tool1', description: 'tool1 description', parameters: [{ name: 'arg', type: 'string', description: 'arg', required: false }] },
    { name: 'tool2', description: 'tool2', parameters: [{ name: 'arg', type: 'number', description: 'desc', required: false }] },
    { name: 'tool3', description: 'tool3 description', parameters: [] },
    { name: 'tool1_1', description: 'tool1 description', parameters: [{ name: 'arg', type: 'string', description: 'arg', required: false }] },
    { name: 'tool2_1', description: 'tool2', parameters: [{ name: 'arg', type: 'number', description: 'desc', required: false }] },
    { name: 'tool3_1', description: 'tool3 description', parameters: [] },
    { name: 'tool2_2', description: 'tool2', parameters: [{ name: 'arg', type: 'number', description: 'desc', required: false }] },
    { name: 'tool1_3', description: 'tool1 description', parameters: [{ name: 'arg', type: 'string', description: 'arg', required: false }] },
    { name: 'tool2_3', description: 'tool2', parameters: [{ name: 'arg', type: 'number', description: 'desc', required: false }] },
    { name: 'tool3_3', description: 'tool3 description', parameters: [] },
  ])
})

test('getAllServersWithTools', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  const result = await mcp.getAllServersWithTools()
  expect(result).toHaveLength(4)

  // Check the structure of each server with tools (flattened structure)
  // First server keeps original names (no collisions yet)
  expect(result[0]).toEqual(expect.objectContaining({
    uuid: '1234-5678-90ab',
    type: 'stdio',
    command: 'node',
    url: 'script.js',
    tools: [
      { name: 'tool1', function: 'tool1', description: 'tool1 description' },
      { name: 'tool2', function: 'tool2', description: 'tool2' },
      { name: 'tool3', function: 'tool3', description: 'tool3 description' }
    ]
  }))

  // Second server gets _1 suffix due to collision
  expect(result[1]).toEqual(expect.objectContaining({
    uuid: '2345-6789-0abc',
    type: 'sse',
    url: 'http://localhost:3000',
    tools: [
      { name: 'tool1', function: 'tool1_1', description: 'tool1 description' },
      { name: 'tool2', function: 'tool2_1', description: 'tool2' },
      { name: 'tool3', function: 'tool3_1', description: 'tool3 description' }
    ]
  }))

  // Verify that tools have the original names (not the unique suffixed ones)
  // Plus tool1 and tool3 are skipped in this server (toolSelection: ['tool2'])
  expect(result[2].tools[0].name).toBe('tool2')
  expect(result[2].tools[0].name).not.toMatch(/_.$/)

})

test('Does not connect twice', async () => {
  const mcp = new Mcp(app)
  expect(await mcp.connect())
  expect(await mcp.connect())
  expect(mcp.clients).toHaveLength(4)
})

test('originalToolName instance method does reverse lookup', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  // Instance method does reverse lookup via toolMappings
  // tool1_1 is mapped from tool1 on second server
  expect(mcp.originalToolName('tool1_1')).toBe('tool1')
  expect(mcp.originalToolName('tool2_2')).toBe('tool2')

  // Names without mappings return as-is
  expect(mcp.originalToolName('tool1')).toBe('tool1')
  expect(mcp.originalToolName('unknown_tool')).toBe('unknown_tool')
})

test('detectAndResolveCollisions basic functionality', async () => {
  const mcp = new Mcp(app)

  // No collisions - returns empty mappings
  const noCollisions = (mcp as any).detectAndResolveCollisions('server1', ['tool1', 'tool2'])
  expect(noCollisions).toEqual({})
})

test('detectAndResolveCollisions with collisions', async () => {
  const mcp = new Mcp(app)
  await mcp.connect() // This populates tools from first server

  // New server with same tool names should get collision suffixes
  // After connect, we have 4 servers with tools. The collision detection uses getServers()
  // which returns all servers, and checks the cache for tools.
  // Server 1 has tool1, tool2, tool3 (original names)
  // Server 2 has tool1_1, tool2_1, tool3_1
  // Server 3 has tool1_2, tool2_2, tool3_2
  // Server 4 has tool1_3, tool2_3, tool3_3
  // A new server would get _4 suffix
  const collisions = (mcp as any).detectAndResolveCollisions('new-server', ['tool1', 'tool2', 'new_tool'])
  expect(collisions).toEqual({
    tool1: 'tool1_4',
    tool2: 'tool2_4'
    // new_tool has no collision, so no mapping
  })
})

test('detectAndResolveCollisions preserves existing mappings on reconnect', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  // Simulate a server reconnecting with existing mappings
  const existingMappings = { tool1: 'tool1_1', tool2: 'tool2_1' }
  const collisions = (mcp as any).detectAndResolveCollisions('2345-6789-0abc', ['tool1', 'tool2', 'tool3'], existingMappings)

  // Should preserve the existing mappings
  expect(collisions.tool1).toBe('tool1_1')
  expect(collisions.tool2).toBe('tool2_1')
})

test('Call tool', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()
  // First server keeps original names
  expect(await mcp.callTool('tool1', { arg: 'arg1' })).toStrictEqual({ toolResult: '1-tool1-arg1-result' })
  expect(await mcp.callTool('tool2', { arg: 'arg2' })).toStrictEqual({ toolResult: '1-tool2-arg2-result' })
  // Second server gets _1 suffix
  expect(await mcp.callTool('tool1_1', { arg: 'arg3' })).toStrictEqual({ content: [{ type: 'text', text: '2-tool1-arg3-result' }] })
  expect(await mcp.callTool('tool2_1', { arg: 'arg4' })).toStrictEqual({ content: [{ type: 'text', text: '2-tool2-arg4-result' }] })
  // Non-existent tool
  await expect(() => mcp.callTool('tool3_nonexistent', { arg: 'modern' })).rejects.toThrowError(/not found/)
})

test('Call tool passes timeout when configured', async () => {
  // Set a timeout on the first server
  config.mcp.servers[0].timeout = 120
  const mcp = new Mcp(app)
  await mcp.connect()

  await mcp.callTool('tool1', { arg: 'arg1' })

  // Should pass timeout in ms in options
  expect(Client.prototype.callTool).toHaveBeenLastCalledWith(
    { name: 'tool1', arguments: { arg: 'arg1' } },
    expect.anything(),
    { signal: undefined, timeout: 120000 }
  )
})

test('Disconnect', async () => {
  const mcp = new Mcp(app)
  expect(await mcp.connect())
  expect(mcp.clients).toHaveLength(4)
  expect(mcp.deleteServer('1234-5678-90ab')).toBe(true)
  expect(Client.prototype.close).toHaveBeenCalledTimes(1)
  expect(mcp.clients).toHaveLength(3)
})

test('Reload', async () => {
  const mcp = new Mcp(app)
  expect(await mcp.connect())
  expect(mcp.clients).toHaveLength(4)
  expect(Client.prototype.close).toHaveBeenCalledTimes(0)
  expect(await mcp.reload())
  expect(mcp.clients).toHaveLength(4)
  expect(Client.prototype.close).toHaveBeenCalledTimes(4)
})

test('Install smithery', async () => {
  const mcp = new Mcp(app)
  expect(await mcp.getInstallCommand('smithery', 'server', 'key')).toBe('npx -y @smithery/cli@latest install server --client witsy --key key')
  expect(await mcp.installServer('smithery', 'server', 'key')).toBe('success')
  expect(command).toBe('npx -y @smithery/cli@latest install server --client witsy --key key')
})

test('Create HTTP server with OAuth', async () => {
  const mcp = new Mcp(app)
  const oauthConfig = {
    tokens: {
      access_token: 'test-access-token',
      token_type: 'bearer'
    },
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret'
  }
  
  expect(await mcp.editServer({ 
    uuid: null, 
    registryId: null, 
    state: 'enabled', 
    type: 'http', 
    url: 'http://localhost:3001', 
    oauth: oauthConfig,
    toolSelection: null,
  })).toBe(true)
  
  expect(mcp.getServers()).toHaveLength(7)
  expect(StreamableHTTPClientTransport).toHaveBeenLastCalledWith(new URL('http://localhost:3001/'), {
    requestInit: {
      headers: {},
    },
    authProvider: expect.any(Object)
  })
  
  const server = mcp.getServers().find(s => s.url === 'http://localhost:3001')
  expect(server?.oauth).toEqual(oauthConfig)
  expect(config.mcp.servers.find(s => s.url === 'http://localhost:3001')?.oauth).toEqual(oauthConfig)
})

test('Create SSE server with OAuth', async () => {
  const mcp = new Mcp(app)
  const oauthConfig = {
    tokens: {
      access_token: 'test-access-token-sse',
      token_type: 'bearer'
    },
    clientId: 'test-client-id-sse',
    clientSecret: 'test-client-secret-sse'
  }

  expect(await mcp.editServer({
    uuid: null,
    registryId: null,
    state: 'enabled',
    type: 'sse',
    url: 'http://localhost:3003',
    oauth: oauthConfig,
    toolSelection: null,
  })).toBe(true)

  expect(mcp.getServers()).toHaveLength(7)
  expect(SSEClientTransport).toHaveBeenLastCalledWith(
    new URL('http://localhost:3003/'),
    {
      authProvider: expect.any(Object)
    }
  )

  const server = mcp.getServers().find(s => s.url === 'http://localhost:3003')
  expect(server?.oauth).toEqual(oauthConfig)
  expect(config.mcp.servers.find(s => s.url === 'http://localhost:3003')?.oauth).toEqual(oauthConfig)
})

test('OAuth flow completion', async () => {
  const mcp = new Mcp(app)
  const oauthConfig = {}
  
  // Create server with OAuth
  await mcp.editServer({ 
    uuid: null, 
    registryId: null, 
    state: 'enabled', 
    type: 'http', 
    url: 'http://localhost:3001', 
    oauth: oauthConfig,
    toolSelection: null,
  })
  
  await mcp.connect()
  
  const server = mcp.getServers().find(s => s.url === 'http://localhost:3001')
  const client = mcp.clients.find(c => c.server.uuid === server?.uuid)
  
  // Mock the finishAuth method
  if (client?.client.transport && 'finishAuth' in client.client.transport) {
    const finishAuthMock = client.client.transport.finishAuth as any
    finishAuthMock.mockResolvedValue(undefined)
    
    const result = await mcp.completeOAuthFlow(server!.uuid!, 'test-auth-code')
    expect(result).toBe(true)
    expect(finishAuthMock).toHaveBeenCalledWith('test-auth-code')
  }
})

test('OAuth flow completion - server not found', async () => {
  const mcp = new Mcp(app)
  const result = await mcp.completeOAuthFlow('non-existent', 'test-code')
  expect(result).toBe(false)
})

test('OAuth flow completion - no OAuth config', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  const server = mcp.getServers()[0] // First server without OAuth
  const result = await mcp.completeOAuthFlow(server.uuid!, 'test-code')
  expect(result).toBe(false)
})

test('getCachedTools returns empty for previously failed server', async () => {
  const mcp = new Mcp(app)

  // Manually set a failed cache entry (tools = null)
  const server: McpServer = {
    uuid: 'test-server',
    registryId: 'test',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  // Access private toolsCache
  const cache = (mcp as any).toolsCache as Map<string, any>
  cache.set('test-server', { tools: null, timestamp: 0 })

  // Create a mock client
  const mockClient = { server, client: {}, tools: [] as any[] }

  // Call getCachedTools
  const result = await (mcp as any).getCachedTools(mockClient)
  expect(result).toEqual({ tools: [] })
})

test('getCachedTools handles listTools error', async () => {
  const mcp = new Mcp(app)

  const server: McpServer = {
    uuid: 'error-server',
    registryId: 'test',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  // Initialize logs for this server
  mcp.logs['error-server'] = []

  // Create mock client with failing listTools
  const mockClient = {
    server,
    client: {
      listTools: vi.fn().mockRejectedValue(new Error('Connection failed'))
    },
    tools: [] as any[]
  }

  const result = await (mcp as any).getCachedTools(mockClient)
  expect(result).toStrictEqual({ tools: [] })

  // Check that error was logged
  expect(mcp.logs['error-server']).toContain('[mcp] Failed to get tools')

  // Check that cache was set to null for future calls
  const cache = (mcp as any).toolsCache as Map<string, any>
  expect(cache.get('error-server').tools).toBeNull()
})

test('getStatus with cached non-persistent server tools', async () => {
  const mcp = new Mcp(app)

  // Manually add a cache entry for a server
  const cache = (mcp as any).toolsCache as Map<string, any>
  cache.set('1234-5678-90ab', {
    tools: { tools: [{ name: 'cachedTool' }] },
    timestamp: Date.now()
  })

  // Don't connect - so we're testing the cached non-persistent server path
  const status = await mcp.getStatus()

  // The server should show cached tools (no collision suffix since no mappings)
  const serverStatus = status.servers.find(s => s.uuid === '1234-5678-90ab')
  expect(serverStatus).toBeDefined()
  expect(serverStatus!.tools).toContain('cachedTool')
})

test('getStatus with cached null tools (error state)', async () => {
  const mcp = new Mcp(app)

  // Manually add a cache entry with null tools (error state)
  const cache = (mcp as any).toolsCache as Map<string, any>
  cache.set('1234-5678-90ab', {
    tools: null,
    timestamp: Date.now()
  })

  const status = await mcp.getStatus()

  // The server should show null tools (error state)
  const serverStatus = status.servers.find(s => s.uuid === '1234-5678-90ab')
  expect(serverStatus).toBeDefined()
  expect(serverStatus!.tools).toBeNull()
})

test('getServerTools returns tools for connected server', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  const tools = await mcp.getServerTools('1234-5678-90ab')
  expect(tools).toHaveLength(3)
  // First server keeps original names (no collisions)
  expect(tools[0]).toEqual({
    name: 'tool1',
    function: 'tool1',
    description: 'tool1 description',
    inputSchema: { type: 'object', properties: { arg: { type: 'string' }}, required: [] }
  })
})

test('getServerTools returns empty for unknown server', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  const tools = await mcp.getServerTools('non-existent-server')
  expect(tools).toEqual([])
})

test('translateError translates connection errors', () => {
  const mcp = new Mcp(app)
  const translateError = (mcp as any).translateError.bind(mcp)

  // Test fetch failed error
  expect(translateError('fetch failed')).toBe('mcp.connectionErrors.fetchFailed')
  expect(translateError('ECONNREFUSED')).toBe('mcp.connectionErrors.fetchFailed')

  // Test auth errors
  expect(translateError('POSTing to endpoint HTTP 500')).toBe('mcp.connectionErrors.authFailed')
  expect(translateError('server_error occurred')).toBe('mcp.connectionErrors.authFailed')
  expect(translateError('Internal Server Error')).toBe('mcp.connectionErrors.authFailed')

  // Test unknown error (returns original)
  expect(translateError('Some random error')).toBe('Some random error')
})

test('restartServer restarts an enabled server', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  expect(mcp.clients).toHaveLength(4)

  // Restart one of the connected servers
  const result = await mcp.restartServer('1234-5678-90ab')
  expect(result).toBe(true)

  // Server should still be connected
  expect(mcp.clients).toHaveLength(4)
})

test('restartServer returns false for non-existent server', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  const result = await mcp.restartServer('non-existent-uuid')
  expect(result).toBe(false)
})

test('restartServer returns false for disabled server', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  // Try to restart a disabled server
  const result = await mcp.restartServer('3456-7890-abcd')
  expect(result).toBe(false)
})

test('getAllServersWithTools handles error when getting tools', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  // Make getCachedTools fail for one client
  const originalGetCachedTools = (mcp as any).getCachedTools
  let callCount = 0;
  (mcp as any).getCachedTools = vi.fn(async (client: any) => {
    callCount++
    if (callCount === 1) {
      throw new Error('Failed to get tools')
    }
    return originalGetCachedTools.call(mcp, client)
  })

  const result = await mcp.getAllServersWithTools()

  // First server should have empty tools due to error
  expect(result[0].tools).toEqual([])
  // Other servers should have tools
  expect(result[1].tools.length).toBeGreaterThan(0)
})

test('connectToServer returns false for disabled server', async () => {
  const mcp = new Mcp(app)

  const server: McpServer = {
    uuid: 'disabled-server',
    registryId: 'disabled',
    state: 'disabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  const result = await (mcp as any).connectToServer(server)
  expect(result).toBe(false)
})

test('connectToServer handles connection failure', async () => {
  const mcp = new Mcp(app)

  // Make connect fail
  mockConnect.mockRejectedValueOnce(new Error('Connection failed'))

  const server: McpServer = {
    uuid: 'fail-server',
    registryId: 'fail',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  const result = await (mcp as any).connectToServer(server)
  expect(result).toBe(false)

  // Check that error state was cached
  const cache = (mcp as any).toolsCache as Map<string, any>
  expect(cache.get('fail-server').tools).toBeNull()
})

test('editServer with label on mcp server', async () => {
  const mcp = new Mcp(app)

  // Edit mcp server with label
  expect(await mcp.editServer({
    uuid: 's1', registryId: 's1', state: 'enabled', type: 'stdio',
    command: 'npx', url: '-y run s1.js', label: '  Custom Label  ',
    toolSelection: null
  })).toBe(true)

  // Check label was set
  expect(config.mcp.mcpServersExtra['s1'].label).toBe('Custom Label')

  // Clear label
  expect(await mcp.editServer({
    uuid: 's1', registryId: 's1', state: 'enabled', type: 'stdio',
    command: 'npx', url: '-y run s1.js', label: '',
    toolSelection: null
  })).toBe(true)

  // Check label was removed
  expect(config.mcp.mcpServersExtra['s1'].label).toBeUndefined()
})

test('editServer returns false for unknown server', async () => {
  const mcp = new Mcp(app)

  const result = await mcp.editServer({
    uuid: 'unknown-uuid',
    registryId: 'unknown',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  })

  expect(result).toBe(false)
})

test('updateTokens returns false for null uuid', async () => {
  const mcp = new Mcp(app)

  const result = await mcp.updateTokens(
    { uuid: null, registryId: null, state: 'enabled', type: 'http', url: 'test', toolSelection: null },
    { access_token: 'test', token_type: 'bearer' },
    'read'
  )

  expect(result).toBe(false)
})

test('updateTokens saves tokens for normal server', async () => {
  const mcp = new Mcp(app)

  // Create a server with OAuth
  await mcp.editServer({
    uuid: null,
    registryId: null,
    state: 'enabled',
    type: 'http',
    url: 'http://localhost:4000',
    oauth: { tokens: { access_token: 'old', token_type: 'bearer' } },
    toolSelection: null
  })

  const server = mcp.getServers().find(s => s.url === 'http://localhost:4000')
  expect(server).toBeDefined()

  const result = await mcp.updateTokens(
    server!,
    { access_token: 'new-token', token_type: 'bearer' },
    'read write'
  )

  expect(result).toBe(true)

  // Check tokens were updated
  const updatedServer = config.mcp.servers.find((s: any) => s.url === 'http://localhost:4000')
  expect(updatedServer?.oauth?.tokens?.access_token).toBe('new-token')
  expect(updatedServer?.oauth?.scope).toBe('read write')
})

test('deleteServer with @prefix mcp server', async () => {
  const mcp = new Mcp(app)

  // Add a server with @ prefix
  config.mcpServers['@test-mcp'] = { command: 'node', args: ['test.js'] }
  expect(mcp.getServers().find(s => s.uuid === 'test-mcp')).toBeDefined()

  // Delete it
  const result = mcp.deleteServer('test-mcp')
  expect(result).toBe(true)
  expect(config.mcpServers['@test-mcp']).toBeUndefined()
})

test('getInstallCommand returns null for unknown registry', () => {
  const mcp = new Mcp(app)
  const result = mcp.getInstallCommand('unknown-registry', 'server', 'key')
  expect(result).toBeNull()
})

test('getInstallCommand without api key', () => {
  const mcp = new Mcp(app)
  const result = mcp.getInstallCommand('smithery', 'server', '')
  expect(result).toBe('npx -y @smithery/cli@latest install server --client witsy')
})

test('mcpToPluginTool handles array type properties', () => {
  const mcp = new Mcp(app)
  const mcpToPluginTool = (mcp as any).mcpToPluginTool.bind(mcp)

  const server: McpServer = {
    uuid: 'test-server',
    registryId: 'test',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  const tool = {
    name: 'arrayTool',
    description: 'Tool with array param',
    inputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' }, description: 'List of items' }
      },
      required: ['items']
    }
  }

  const result = mcpToPluginTool(server, tool)
  expect(result.parameters[0]).toEqual({
    name: 'items',
    type: 'array',
    description: 'List of items',
    required: true,
    items: { type: 'string' }
  })
})

test('mcpToPluginTool handles tool without description', () => {
  const mcp = new Mcp(app)
  const mcpToPluginTool = (mcp as any).mcpToPluginTool.bind(mcp)

  const server: McpServer = {
    uuid: 'test-server',
    registryId: 'test',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  const tool = {
    name: 'noDescTool',
    inputSchema: { type: 'object', properties: {}, required: [] as any[] }
  }

  const result = mcpToPluginTool(server, tool)
  expect(result.description).toBe('noDescTool')
})

test('mcpToPluginTool handles tool without inputSchema', () => {
  const mcp = new Mcp(app)
  const mcpToPluginTool = (mcp as any).mcpToPluginTool.bind(mcp)

  const server: McpServer = {
    uuid: 'test-server',
    registryId: 'test',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  const tool = {
    name: 'simpleTool',
    description: 'A simple tool'
  }

  const result = mcpToPluginTool(server, tool)
  expect(result.parameters).toEqual([])
})

test('mcpToPluginTool handles enum properties', () => {
  const mcp = new Mcp(app)
  const mcpToPluginTool = (mcp as any).mcpToPluginTool.bind(mcp)

  const server: McpServer = {
    uuid: 'test-server',
    registryId: 'test',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  const tool = {
    name: 'enumTool',
    description: 'Tool with enum param',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: 'Output format', enum: ['json', 'xml', 'csv'] }
      },
      required: ['format']
    }
  }

  const result = mcpToPluginTool(server, tool)
  expect(result.parameters[0]).toEqual({
    name: 'format',
    type: 'string',
    description: 'Output format',
    required: true,
    enum: ['json', 'xml', 'csv']
  })
})

test('mcpToPluginTool handles nested object properties', () => {
  const mcp = new Mcp(app)
  const mcpToPluginTool = (mcp as any).mcpToPluginTool.bind(mcp)

  const server: McpServer = {
    uuid: 'test-server',
    registryId: 'test',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  const tool = {
    name: 'nestedTool',
    description: 'Tool with nested object',
    inputSchema: {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          description: 'Configuration object',
          properties: {
            host: { type: 'string', description: 'Hostname' },
            port: { type: 'number', description: 'Port number' }
          },
          required: ['host']
        }
      },
      required: ['config']
    }
  }

  const result = mcpToPluginTool(server, tool)
  expect(result.parameters[0]).toEqual({
    name: 'config',
    type: 'object',
    description: 'Configuration object',
    required: true,
    items: {
      type: 'object',
      properties: [
        { name: 'host', type: 'string', description: 'Hostname', required: true },
        { name: 'port', type: 'number', description: 'Port number', required: false }
      ]
    }
  })
})

test('mcpToPluginTool handles array of objects', () => {
  const mcp = new Mcp(app)
  const mcpToPluginTool = (mcp as any).mcpToPluginTool.bind(mcp)

  const server: McpServer = {
    uuid: 'test-server',
    registryId: 'test',
    state: 'enabled',
    type: 'stdio',
    command: 'node',
    url: 'test.js',
    toolSelection: null
  }

  const tool = {
    name: 'arrayObjTool',
    description: 'Tool with array of objects',
    inputSchema: {
      type: 'object',
      properties: {
        entries: {
          type: 'array',
          description: 'List of entries',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Entry key' },
              value: { type: 'string', description: 'Entry value' }
            },
            required: ['key']
          }
        }
      },
      required: [] as string[]
    }
  }

  const result = mcpToPluginTool(server, tool)
  expect(result.parameters[0]).toEqual({
    name: 'entries',
    type: 'array',
    description: 'List of entries',
    required: false,
    items: {
      type: 'object',
      properties: [
        { name: 'key', type: 'string', description: 'Entry key', required: true },
        { name: 'value', type: 'string', description: 'Entry value', required: false }
      ]
    }
  })
})

test('getLlmTools skips tools not in toolSelection', async () => {
  const mcp = new Mcp(app)
  await mcp.connect()

  // Server at index 2 has toolSelection: ['tool2'], so tool1 and tool3 should be skipped
  const tools = await mcp.getLlmTools()

  // Check that only tool2 from server 4567-890a-bcde is included
  // comes 3rd so gets _2 suffix due to collisions with previous servers
  const serverBcdeTools = tools.filter(t => t.name.endsWith('_2'))
  expect(serverBcdeTools).toHaveLength(1)
  expect(serverBcdeTools[0].name).toBe('tool2_2')
})

test('updateTokens for mcp server with extra config', async () => {
  const mcp = new Mcp(app)

  // Setup mcp server with oauth config in extras
  config.mcp.mcpServersExtra['s1'] = {
    state: 'enabled',
    oauth: { tokens: { access_token: 'old-token', token_type: 'bearer' } }
  }

  const server: McpServer = {
    uuid: 's1',
    registryId: 's1',
    state: 'enabled',
    type: 'stdio',
    command: 'npx',
    url: '-y run s1.js',
    toolSelection: null
  }

  const result = await mcp.updateTokens(
    server,
    { access_token: 'new-mcp-token', token_type: 'bearer' },
    'read'
  )

  expect(result).toBe(true)
  expect(config.mcp.mcpServersExtra['s1'].oauth.tokens.access_token).toBe('new-mcp-token')
  expect(config.mcp.mcpServersExtra['s1'].oauth.scope).toBe('read')
})

test('updateTokens does not save if tokens unchanged', async () => {
  const mcp = new Mcp(app)

  // Create server with tokens
  await mcp.editServer({
    uuid: null,
    registryId: null,
    state: 'enabled',
    type: 'http',
    url: 'http://localhost:5000',
    oauth: { tokens: { access_token: 'same', token_type: 'bearer' } },
    toolSelection: null
  })

  const server = mcp.getServers().find(s => s.url === 'http://localhost:5000')
  expect(server).toBeDefined()

  // Clear mocks to check if saveSettings is called
  vi.clearAllMocks()

  // Update with same tokens - should not trigger save
  const { saveSettings } = await import('@main/config')
  const result = await mcp.updateTokens(
    server!,
    { access_token: 'same', token_type: 'bearer' },
    'read'
  )

  expect(result).toBe(true)
  // saveSettings should not have been called since tokens are the same
  expect(saveSettings).not.toHaveBeenCalled()
})
