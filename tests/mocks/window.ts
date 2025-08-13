
import { vi } from 'vitest'
import { renderMarkdown } from '../../src/main/markdown'
import { AgentRun, AgentRunStatus, AgentRunTrigger, Command, Expert } from '../../src/types/index'
import { McpInstallStatus } from '../../src/types/mcp'
import { ListDirectoryResponse } from '../../src/types/filesystem'
import { FilePickParams } from '../../src/types/file'
import { DocRepoQueryResponseItem, DocumentBase } from '../../src/types/rag'
import defaultSettings from '../../defaults/settings.json'
import Agent from '../../src/models/agent'

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
      setAppearanceTheme: vi.fn(),
      showAbout: vi.fn(),
      // showDialog: vi.fn(async () => { return { response: opts.dialogResponse || 0, checkboxChecked: false }}),
      getAssetPath: vi.fn(() => ''),
      listFonts: vi.fn(() => []),
      fullscreen: vi.fn(),
    },
    main: {
      updateMode: vi.fn(),
      setContextMenuContext: vi.fn(),
      close: vi.fn(),
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
              tools: [],
              contextWindowSize: 512,
              maxTokens: 150,
              temperature: 0.7,
              top_k: 10,
              top_p: 0.5,
              reasoning: true,
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
        { id: 'uuid2', type: 'system', name: 'actor2', prompt: 'prompt2', state: 'disabled' },
        { id: 'uuid3', type: 'user', name: 'actor3', prompt: 'prompt3', state: 'enabled', triggerApps: [ { identifier: 'app' }] }
      ] as Expert[]),
      save: vi.fn(),
      import: vi.fn(),
      export: vi.fn(),
    },
    agents: {
      forge: vi.fn(),
      load: vi.fn(() => [
        Agent.fromJson({
          uuid: 'agent1',
          source: 'witsy',
          name: 'Test Agent 1',
          description: 'A test runnable agent',
          type: 'runnable',
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now() - 3600000,
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
          createdAt: Date.now() - 172800000,
          updatedAt: Date.now() - 7200000,
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
          createdAt: Date.now() - 259200000,
          updatedAt: Date.now() - 10800000,
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
    },
    history: {
      load: vi.fn(() => ({ folders: [ ], chats: [ ], quickPrompts: [ ] })),
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
        if (filePath.startsWith('~/')) {
          return filePath.replace('~', '/home/user')
        }
        if (!filePath.startsWith('/')) {
          return `/home/user/${filePath}`
        }
        return filePath
      }),
      exists: vi.fn((filePath: string) => filePath.includes('existing')),
      read: vi.fn((filepath: string) => { return { url: filepath, contents: `${filepath}_encoded`, mimeType: 'whatever' } }),
      readIcon: vi.fn(),
      extractText: vi.fn((s) => `${s}_extracted`),
      getAppInfo: vi.fn(),
      save: vi.fn(() => 'file://file_saved'),
      download: vi.fn(),
      write: vi.fn(() => true),
      delete: vi.fn(() => true),
      find: vi.fn(() => 'file.ext'),
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
      rename: vi.fn(),
      delete: vi.fn(),
      addDocument: vi.fn(async () => {}),
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
      getCurrentQueueItem: vi.fn(async () => null)
    },
    scratchpad: {
      open: vi.fn(),
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
      ], logs: {} })),
      //@ts-expect-error not sure about the type: 'function' complain
      getTools: vi.fn(async () => [
        { type: 'function', function: { name: 'tool1' , description: 'description1', parameters: { type: 'object', properties: {}, required: [] } } },
        { type: 'function', function: { name: 'tool2' , description: 'description2', parameters: { type: 'object', properties: {}, required: [] } } },
      ]),
      callTool: vi.fn(async (tool: string) => (tool === 'tool2' ? {
        content: [ { text: 'result2' } ],
      } : { result: 'result' })),
      originalToolName: vi.fn((name: string) => name),
    },
    anywhere: {
      prompt: vi.fn(),
      insert: vi.fn(),
      close: vi.fn(),
      resize: vi.fn(),
    },
    interpreter: {
      python: vi.fn(async () => ({ result: ['bonjour'] }))
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
    search: {
      query: vi.fn(async () => [
        { title: 'title1', url: 'url1', content: '<html>page_content1<img src="test" /></html>' },
        { title: 'title2', url: 'url2', content: '<html>header<main id="main">page_content2</main></html>' },
      ])
    },
    backup: {
      export: vi.fn(() => true),
      import: vi.fn(() => true),
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

export { useWindowMock, useBrowserMock, listeners }
