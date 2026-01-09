
import path from 'path'
import { kHistoryVersion } from '@/consts'
import { AgentRun, AgentRunStatus, AgentRunTrigger } from '@/types/agents'
import { FilePickParams } from '@/types/file'
import { ListDirectoryResponse } from '@/types/filesystem'
import { Command, Expert, ExpertCategory } from '@/types/index'
import { McpInstallStatus, McpServerWithTools } from '@/types/mcp'
import { DocRepoQueryResponseItem, DocumentBase } from '@/types/rag'
import { renderMarkdown } from '@main/markdown'
import Agent from '@models/agent'
import defaultSettings from '@root/defaults/settings.json'
import { vi } from 'vitest'

const listeners: ((signal: string) => void)[] = []

interface WindowMockOpts {
  dialogResponse?: number
  modelDefaults?: boolean
  favoriteModels?: boolean
  customEngine?: boolean
  noAdditionalInstructions?: boolean
}

let clipboard = ''

const useWindowMock = (opts?: WindowMockOpts) => {

  // merge with deafults
  opts = {
    ...{
      dialogResponse: 0,
      modelDefaults: false,
      favoriteModels: false,
      customEngine: false
    },
    ...opts
  }

  let runAtLogin = false
  window.api = {
    licensed: false,
    platform: 'darwin',
    isMasBuild: false,
    userDataPath: '/tmp',
    on: vi.fn((signal, listener) => listeners.push(listener)),
    off: vi.fn(),
    app: {
      getVersion: vi.fn(() => '0.1.0'),
      setAppearanceTheme: vi.fn(),
      showAbout: vi.fn(),
      // showDialog: vi.fn(async () => { return { response: opts.dialogResponse || 0, checkboxChecked: false }}),
      getAssetPath: vi.fn(() => ''),
      listFonts: vi.fn(() => []),
      fullscreen: vi.fn(),
      getHttpPort: vi.fn(() => 8090),
    },
    main: {
      updateMode: vi.fn(),
      setContextMenuContext: vi.fn(),
      close: vi.fn(),
      showWindowButtons: vi.fn(),
      hideWindowButtons: vi.fn(),
      moveWindow: vi.fn(),
    },
    debug: {
      showConsole: vi.fn(),
      getNetworkHistory: vi.fn(() => []),
      clearNetworkHistory: vi.fn(),
      openFolder: vi.fn(),
    },
    runAtLogin: {
      get: () => runAtLogin,
      set: vi.fn((state) => {
        runAtLogin = state
      })
    },
    update: {
      check: vi.fn(),
      isAvailable: vi.fn(() => false),
      apply: vi.fn(),
    },
    shortcuts: {
      register: vi.fn(),
      unregister: vi.fn(),
    },
    config: {
      localeUI: vi.fn(() => 'en-US'),
      localeLLM: vi.fn(() => 'en-US'),
      getI18nMessages: vi.fn(() => ({ en: {}, fr: {} })),
      load: vi.fn(() => {
        const config = JSON.parse(JSON.stringify(defaultSettings))
        if (opts.favoriteModels) {
          config.llm.favorites = [
            { id: 'mock-chat', engine: 'mock', model: 'chat' },
            { id: 'mock-vision', engine: 'mock', model: 'vision' },
          ]
        }
        if (opts.noAdditionalInstructions) {
          for (const key of Object.keys(config.llm.additionalInstructions)) {
            config.llm.additionalInstructions[key] = false
          }
        }
        if (opts.modelDefaults) {
          config.llm.defaults = [
            {
              engine: 'mock',
              model: 'chat',
              disableStreaming: false,
              instructions: 'Test instructions',
              tools: [],
              expert: 'expert1',
              docrepo: 'repo1',
              modelOpts: {
                contextWindowSize: 512,
                maxTokens: 150,
                temperature: 0.7,
                top_k: 10,
                top_p: 0.5,
                reasoning: true,
              }
            },
          ]
        }
        if (opts.customEngine) {
          config.engines.custom1 = { 
            label: 'custom_openai',
            api: 'openai',
            apiKey: '456',
            baseURL: 'http://localhost/api/v1',
            models: { image: [], chat: [] },
            model: { chat: '', image: '' }
          }
          config.engines.custom2 = { 
            label: 'custom_azure',
            api: 'azure',
            apiKey: '789',
            baseURL: 'http://witsy.azure.com/',
            deployment: 'witsy_deployment',
            apiVersion: '2024-04-03',
            models: { image: [], chat: [] },
            model: { chat: '', image: '' }
          }
        }
        return config
      }),
      save: vi.fn(),
    },
    store: {
      set: vi.fn(),
      get: vi.fn(() => null),
    },
    automation: {
      getText: vi.fn(() => 'text'),
      insert: vi.fn(() => true),
      replace: vi.fn(() => true),
    },
    permissions: {
      checkAccessibility: vi.fn(() => Promise.resolve(true)),
      checkAutomation: vi.fn(() => Promise.resolve(true)),
      openAccessibilitySettings: vi.fn(() => Promise.resolve()),
      openAutomationSettings: vi.fn(() => Promise.resolve()),
    },
    settings: {
      open: vi.fn(),
    },
    chat: {
      open: vi.fn(),
    },
    commands: {
      load: vi.fn(() => [
        { id: 'uuid1', icon: '1', shortcut: '1', action: 'chat_window', state: 'enabled' },
        { id: 'uuid2', icon: '2', label: 'Command 2', shortcut: '2', action: 'paste_below', state: 'enabled' },
        { id: 'uuid3', icon: '3', label: 'Command 3', shortcut: '3', action: 'paste_in_place', state: 'enabled' },
        { id: 'uuid4', icon: '4', label: 'Command 4', shortcut: '4', action: 'clipboard_copy', state: 'enabled' },
        { id: 'uuid5', icon: '5', label: 'Command 5', shortcut: '5', action: 'chat_window', state: 'disabled' },
      ] as unknown[] as Command[]),
      save: vi.fn(),
      cancel: vi.fn(),
      closePicker: vi.fn(),
      run: vi.fn(),
      askMeAnythingId: vi.fn(() => '00000000-0000-0000-0000-000000000000'),
      isPromptEditable: vi.fn((id) => id != '00000000-0000-0000-0000-000000000000'),
      import: vi.fn(),
      export: vi.fn(),
    },
    experts: {
      load: vi.fn(() => [
        { id: 'uuid1', type: 'system', state: 'enabled' },
        { id: 'uuid2', type: 'system', categoryId: 'cat-1', name: 'actor2', prompt: 'prompt2', state: 'disabled' },
        { id: 'uuid3', type: 'user', categoryId: 'cat-1', name: 'actor3', prompt: 'prompt3', state: 'enabled', triggerApps: [ { identifier: 'app' }] },
        { id: 'uuid4', type: 'user', categoryId: 'cat-2', name: 'actor4', prompt: 'prompt4', state: 'enabled', engine: 'anthropic', model: 'claude-3-sonnet', triggerApps: [] }
      ] as Expert[]),
      save: vi.fn(),
      loadCategories: vi.fn(() => [
        { id: 'cat-1', type: 'system', state: 'enabled', icon: 'Code2' },
        { id: 'cat-2', type: 'system', state: 'enabled', icon: 'Briefcase' },
        { id: 'cat-3', type: 'user', state: 'enabled', icon: 'Briefcase' }
      ] as ExpertCategory[]),
      saveCategories: vi.fn(),
      import: vi.fn(),
      export: vi.fn(),
    },
    agents: {
      forge: vi.fn(),
      list: vi.fn(() => [
        Agent.fromJson({
          uuid: 'agent1',
          source: 'witsy',
          name: 'Test Agent 1',
          description: 'A test runnable agent',
          type: 'runnable',
          createdAt: 86400000,
          updatedAt: 3600000,
          lastRunId: 'run3',
          engine: 'mock',
          model: 'chat',
          modelOpts: {},
          disableStreaming: false,
          locale: null,
          instructions: 'Test instructions for agent 1',
          parameters: [],
          steps: [
            {
              prompt: 'Hello {{name}}, how can I help you?',
              tools: null,
              agents: [],
              docrepo: null
            },
            {
              prompt: 'Based on the previous response {{output.1}}, here is more help',
              tools: null,
              agents: [],
              docrepo: null
            }
          ],
          schedule: null,
          invocationValues: { name: 'World' }
        }),
        Agent.fromJson({
          uuid: 'agent2',
          source: 'witsy',
          name: 'Test Agent 2',
          description: 'A test support agent',
          type: 'support',
          createdAt: 172800000,
          updatedAt: 7200000,
          lastRunId: 'workflow-run1',
          engine: 'mock',
          model: 'chat',
          modelOpts: {},
          disableStreaming: false,
          locale: null,
          instructions: 'Test support instructions',
          parameters: [],
          steps: [{
            prompt: 'I am a support agent ready to help',
            tools: null,
            agents: [],
            docrepo: null
          }],
          schedule: '0 9 * * *',
          invocationValues: {}
        }),
        Agent.fromJson({
          uuid: 'agent3',
          source: 'a2a',
          name: 'Test Agent 3',
          description: 'Another test runnable agent',
          type: 'runnable',
          createdAt: 259200000,
          updatedAt: 10800000,
          engine: 'mock',
          model: 'chat',
          modelOpts: {},
          disableStreaming: false,
          locale: null,
          instructions: 'Test a2a instructions',
          parameters: [],
          steps: [{
            prompt: 'A2A agent {{input}}',
            tools: null,
            agents: [],
            docrepo: null
          }],
          schedule: null,
          invocationValues: { input: 'test' }
        })
      ]),
      load: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      getRuns: vi.fn((workspaceId: string, agentId: string) => {
        if (agentId === 'agent1') {
          return [
            {
              uuid: 'run1',
              agentId: 'agent1',
              createdAt: Date.now() - 86400000, // 1 day ago
              updatedAt: Date.now() - 86400000,
              trigger: 'manual' as AgentRunTrigger,
              status: 'success' as AgentRunStatus,
              prompt: 'Test prompt 1',
              messages: [],
              toolCalls: []
            },
            {
              uuid: 'run2',
              agentId: 'agent1',
              createdAt: Date.now() - 43200000, // 12 hours ago
              updatedAt: Date.now() - 43200000,
              trigger: 'workflow' as AgentRunTrigger,
              status: 'success' as AgentRunStatus,
              prompt: 'Test prompt 2',
              messages: [],
              toolCalls: []
            },
            {
              uuid: 'run3',
              agentId: 'agent1',
              createdAt: Date.now() - 3600000, // 1 hour ago
              updatedAt: Date.now() - 3600000,
              trigger: 'schedule' as AgentRunTrigger,
              status: 'error' as AgentRunStatus,
              prompt: 'Test prompt 3',
              error: 'Test error message',
              messages: [],
              toolCalls: []
            }
          ]
        } else if (agentId === 'agent2') {
          return [{
            uuid: 'workflow-run1',
            agentId: 'agent2',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            trigger: 'workflow' as AgentRunTrigger,
            status: 'success' as AgentRunStatus,
            prompt: 'Workflow prompt',
            messages: [],
            toolCalls: []
          }]
        }
        return []
      }),
      getRun: vi.fn((workspaceId: string, agentId: string, runId: string) => {
        const runs = window.api?.agents?.getRuns(workspaceId, agentId) || []
        return runs.find((run: AgentRun) => run.uuid === runId) || null
      }),
      saveRun: vi.fn(),
      deleteRuns: vi.fn(),
      deleteRun: vi.fn(),
      getApiBasePath: vi.fn(() => '/api/agent'),
      generateWebhookToken: vi.fn(async () => 'webhook-token'),
    },
    history: {
      load: vi.fn(() => ({ version: kHistoryVersion, folders: [ ], chats: [ ], quickPrompts: [ ] })),
      save: vi.fn(),
    },
    base64:{
      decode: (s) => `${s}_decoded`,
      encode: (s) => `${s}_encoded`,
    },
    clipboard: {
      readText: vi.fn(() => clipboard),
      writeText: vi.fn((text) => clipboard = text),
      writeImage: vi.fn(() => true),
    },
    file: {
      normalize: vi.fn((filePath: string) => {
        // Handle tilde expansion
        if (filePath.startsWith('~/')) {
          filePath = filePath.replace('~', '/home/user')
        }
        // Handle relative paths - prepend home directory
        if (!filePath.startsWith('/')) {
          filePath = `/home/user/${filePath}`
        }
        // Use real path.normalize to properly resolve .. sequences
        return path.normalize(filePath)
      }),
      exists: vi.fn((filePath: string) => filePath.includes('existing')),
      stats: vi.fn(() => ({
        size: 1024,
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        modifiedAt: Date.now(),
        createdAt: Date.now(),
      })),
      read: vi.fn((filepath: string) => { return { url: filepath, contents: `${filepath}_encoded`, mimeType: 'whatever' } }),
      readIcon: vi.fn(),
      extractText: vi.fn(async (s) => Promise.resolve(`${s}_extracted`)),
      getAppInfo: vi.fn(),
      save: vi.fn(() => 'file://file_saved'),
      download: vi.fn(),
      write: vi.fn(() => true),
      delete: vi.fn(() => true),
      find: vi.fn(() => 'file.ext'),
      findFiles: vi.fn(async (basePath: string, pattern: string, maxResults?: number): Promise<string[]> => {
        const limit = maxResults || 10
        return [
          '/home/user/file1.txt',
          '/home/user/subdir/file2.txt',
        ].slice(0, limit)
      }),
      listDirectory: vi.fn((dirPath: string, includeHidden?: boolean): ListDirectoryResponse => ({
        success: true,
        items: [
          { name: 'file1.txt', fullPath: '/home/user/file1.txt', isDirectory: false, size: 100 },
          { name: 'subdir', fullPath: '/home/user/subdir', isDirectory: true },
          ...(includeHidden ? [{ name: '.hidden', fullPath: '/home/user/.hidden', isDirectory: false, size: 50 }] : [])
        ]
      })),
      pickFile: vi.fn((opts: FilePickParams) => {
        if (opts.location) {
          return 'image.png'
        } else if (opts.multiselection) {
          return ['image1.png', 'image2.png']
        } else {
          return {
            url: 'file://image.png',
            mimeType: 'image/png',
            contents: 'image64'
          }
        }
      }),
      pickDirectory: vi.fn(() => 'picked_folder'),
      openInExplorer: vi.fn(() => ({ success: true }))
    },
    docrepo: {
      open: vi.fn(),
      list: vi.fn((workspaceId: string): DocumentBase[] => {
        return [
          { uuid: 'uuid1', name: 'docrepo1', embeddingEngine: 'ollama', embeddingModel: 'all-minilm', workspaceId: workspaceId, documents: [] },
          { uuid: 'uuid2', name: 'docrepo2', embeddingEngine: 'openai', embeddingModel: 'text-embedding-ada-002', workspaceId: workspaceId, documents: [
            { uuid: 'uuid3', type: 'file', title: 'file1', origin: '/tmp/file1', filename: 'file1', url: 'file:///tmp/file1', lastModified: 0, fileSize: 1 },
            { uuid: 'uuid4', type: 'folder', title: 'folder1', origin: '/tmp/folder1', filename: 'folder1', url: 'file:///tmp/folder1', lastModified: 0, fileSize: 0, items: [
              { uuid: 'uuid5', type: 'file', title: 'file2', origin: '/tmp/file2', filename: 'file2', url: 'file:///tmp/file2', lastModified: 0, fileSize: 2 },
              { uuid: 'uuid6', type: 'file', title: 'file3', origin: '/tmp/file3', filename: 'file3', url: 'file:///tmp/file3', lastModified: 0, fileSize: 3 },
            ]},
          ]},
        ]
      }),
      isEmbeddingAvailable: vi.fn(() => true),
      connect: vi.fn(() => true),
      disconnect: vi.fn(() => true),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addDocument: vi.fn(async () => 'uuid'),
      removeDocument: vi.fn(async () => true),
      query: vi.fn(async () => [
        {
          content: 'content',
          score: 1,
          metadata: {
            uuid: '1',
            type: 'file',
            title: 'title',
            url: 'url',
            origin: 'origin',
            filename: 'filename',
          }
        } as DocRepoQueryResponseItem
      ]),
      getCurrentQueueItem: vi.fn(async () => null),
      isSourceSupported: vi.fn((type: string, origin: string) => origin.startsWith('file')),
      cancelTask: vi.fn(),
    },
    scratchpad: {
      open: vi.fn(),
      create: vi.fn(() => 'test-uuid'),
      list: vi.fn(() => [
        { uuid: 'scratchpad1', title: 'Test Scratchpad 1', lastModified: Date.now() - 3600000 },
        { uuid: 'scratchpad2', title: 'Test Scratchpad 2', lastModified: Date.now() - 7200000 },
      ]),
      load: vi.fn((workspaceId: string, uuid: string) => ({
        uuid,
        title: 'Test Scratchpad',
        contents: { content: 'Test content' },
        chat: null,
        undoStack: [],
        redoStack: [],
        createdAt: Date.now() - 86400000,
        lastModified: Date.now() - 3600000
      })),
      save: vi.fn(() => true),
      rename: vi.fn(() => true),
      delete: vi.fn(() => true),
      import: vi.fn(() => 'new-uuid'),
    },
    mcp: {
      isAvailable: vi.fn(() => true),
      //@ts-expect-error not sure about the state: 'enabled' complain
      getServers: vi.fn(() => [
        { uuid: '1', registryId: '1', state: 'enabled', type: 'stdio', command: 'node', url: 'script.js', cwd: 'cwd1' },
        { uuid: '2', registryId: '2', state: 'enabled', type: 'sse', url: 'http://localhost:3000' },
        { uuid: '3', registryId: '3', state: 'disabled', type: 'stdio', command: 'python3', url: 'script.py' },
        { uuid: 'mcp1', registryId: '@mcp1', state: 'enabled', type: 'stdio', command: 'npx', url: '-y run mcp1.js', cwd: 'cwd2' },
        { uuid: 'mcp2', registryId: 'mcp2', state: 'disabled', type: 'stdio', command: 'npx', url: '-y run mcp2.js'}
      ]),
      editServer: vi.fn(async () => true),
      deleteServer: vi.fn(async () => true),
      installServer: vi.fn(async () => 'success' as McpInstallStatus),
      reload: vi.fn(async () => {}),
      //@ts-expect-error not sure about the state: 'enabled' complain
      getStatus: vi.fn(() => ({ servers: [
        { uuid: '1', registryId: '1', state: 'enabled', type: 'stdio', command: 'node', url: 'script.js', tools: [ 'tool1', 'tool2' ] },
        { uuid: '2', registryId: '2', state: 'enabled', type: 'sse', url: 'http://localhost:3000', tools: [ 'tool3', 'tool4' ] },
        { uuid: '3', registryId: '3', state: 'enabled', type: 'stdio', command: 'python3', url: 'script.py', tools: null },
      ], logs: {} })),
      getAllServersWithTools: vi.fn(async () => [
        {
          uuid: '1', registryId: '1', state: 'enabled' as const, type: 'stdio' as const, command: 'node', url: 'script.js', toolSelection: null,
          tools: [
            { uuid: 'tool1_1', name: 'tool1', description: 'description1' },
            { uuid: 'tool2_1', name: 'tool2', description: 'description2' }
          ]
        },
        {
          uuid: '2', registryId: '2', state: 'enabled' as const, type: 'sse' as const, url: 'http://localhost:3000', toolSelection: null,
          tools: [
            { uuid: 'tool3_2', name: 'tool3', description: 'description3' },
            { uuid: 'tool4_2', name: 'tool4', description: 'description4' }
          ]
        }
      ] as unknown as McpServerWithTools[]),
      //@ts-expect-error not sure about the type: 'function' complain
      getLlmTools: vi.fn(async () => [
        { type: 'function', function: { name: 'tool1' , description: 'description1', parameters: { type: 'object', properties: {}, required: [] } } },
        { type: 'function', function: { name: 'tool2' , description: 'description2', parameters: { type: 'object', properties: {}, required: [] } } },
      ]),
      callTool: vi.fn(async (tool: string) => (tool === 'tool2' ? {
        content: [ { text: 'result2' } ],
      } : { result: 'result' })),
      isMcpToolName: vi.fn((name: string) => /___....$/.test(name)),
      originalToolName: vi.fn((name: string) => name.replace(/___....$/, '')),
      detectOAuth: vi.fn(async () => ({ requiresOAuth: false })),
      startOAuthFlow: vi.fn(async () => JSON.stringify({ tokens: {}, clientInformation: {}, clientMetadata: {} })),
    },
    anywhere: {
      prompt: vi.fn(),
      insert: vi.fn(),
      close: vi.fn(),
      resize: vi.fn(),
    },
    interpreter: {
      python: vi.fn(async () => ({ result: ['bonjour'] })),
      pyodide: vi.fn(async () => ({ result: 'bonjour' })),
      downloadPyodide: vi.fn(async () => ({ success: true })),
      isPyodideCached: vi.fn(async () => false),
      clearPyodideCache: vi.fn(async () => {}),
    },
    markdown: {
      render: vi.fn(renderMarkdown),
    },
    computer: {
      isAvailable: vi.fn(() => true),
      getScaledScreenSize: vi.fn(() => ({ width: 1920, height: 1080 })),
      getScreenNumber: vi.fn(() => 1),
      takeScreenshot: vi.fn(() => 'screenshot_url'),
      executeAction: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      close: vi.fn(),
      updateStatus: vi.fn(),
    },
    readaloud: {
      closePalette: vi.fn(),
    },
    whisper: {
      initialize: vi.fn(),
      transcribe: vi.fn(async () => ({ text: 'transcribed' })),
    },
    transcribe: {
      insert: vi.fn(),
    },
    memory: {
      reset: vi.fn(),
      isNotEmpty: vi.fn(() => false),
      store: vi.fn(() => true),
      facts: vi.fn(() => [ { uuid: 'uuid1', content: 'fact1' }, { uuid: 'uuid2', content: 'fact2' } ]),
      retrieve: vi.fn((query: string) => query === 'fact' ? [ 'fact1' ] : []),
      delete: vi.fn(),
    },
    codeExecution: {
      load: vi.fn(() => ({ schemas: {} })),
      save: vi.fn(),
    },
    search: {
      query: vi.fn(async () => ({ results: [
        { title: 'title1', url: 'url1', content: 'page1_content' },
        { title: 'title2', url: 'url2', html: '<html>header<main id="main">page2_content</main></html>' },
      ]})),
      cancel: vi.fn(),
      test: vi.fn(),
    },
    backup: {
      export: vi.fn(() => true),
      import: vi.fn(() => true),
    },
    workspace: {
      list: vi.fn(() => []),
      load: vi.fn(() => null),
      save: vi.fn(() => true),
      delete: vi.fn(() => true),
    },
    webview: {
      setLinkBehavior: vi.fn(async () => {}),
      setSpellCheckEnabled: vi.fn(async () => {}),
    }
  }

  // @ts-expect-error mock
  window.getSelection = () => {
    return {
      isCollapsed: true,
    }
  }
}

const useBrowserMock = () => {

  // eslint-disable-next-line no-global-assign
  navigator = {
    // @ts-expect-error mock
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({
        getTracks: vi.fn(() => []),
      } as unknown as MediaStream)),
      getSupportedConstraints: vi.fn(() => ({
        echoCancellation: true,
        autoGainControl: true,
      })),
    },
  }

  // eslint-disable-next-line no-global-assign
  MutationObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  }))

  // @ts-expect-error mock 
  window.MediaRecorder = vi.fn()
  // @ts-expect-error mock 
  window.MediaRecorder.prototype = {
  start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    requestData: vi.fn(),
  }

  window.AudioContext = vi.fn().mockImplementation(() => ({
    createAnalyser: vi.fn(() => ({
      fftSize: 2048,
      frequencyBinCount: 1024,
      getFloatFrequencyData: vi.fn(),
      getByteFrequencyData: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createMediaStreamSource: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    close: vi.fn(),
  }))

  window.caches = {
    open: vi.fn(() => Promise.resolve({
      keys: vi.fn(() => Promise.resolve([])),
      delete: vi.fn(() => Promise.resolve(true)),
    } as unknown as Cache)),
    keys: vi.fn(() => Promise.resolve([])),
    has: vi.fn(() => Promise.resolve(true)),
    delete: vi.fn(() => Promise.resolve(true)),
  } as unknown as CacheStorage

}

export { listeners, useBrowserMock, useWindowMock }

