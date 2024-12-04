
import { vi } from 'vitest'
import { renderMarkdown } from '../../src/main/markdown'
import { Command, Expert } from '../../src/types/index.d'
import { DocumentBase } from '../../src/types/rag.d'
import defaultSettings from '../../defaults/settings.json'

const listeners: ((signal: string) => void)[] = []

interface WindowMockOpts {
  dialogResponse: number
}

const useWindowMock = (opts?: WindowMockOpts) => {

  // merge with deafults
  opts = {
    ...{ dialogResponse: 0 },
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
    setAppearanceTheme: vi.fn(),
    showDialog: vi.fn(async () => { return { response: opts.dialogResponse, checkboxChecked: false }}),
    listFonts: vi.fn(() => []),
    fullscreen: vi.fn(),
    runAtLogin: {
      get: () => runAtLogin,
      set: vi.fn((state) => {
        runAtLogin = state
      })
    },
    update: {
      isAvailable: vi.fn(() => false),
      apply: vi.fn(),
    },
    shortcuts: {
      register: vi.fn(),
      unregister: vi.fn(),
    },
    config: {
      load: vi.fn(() => JSON.parse(JSON.stringify(defaultSettings))),
      save: vi.fn(),
    },
    store: {
      set: vi.fn(),
      get: vi.fn(() => null),
    },
    automation: {
      getText: vi.fn(() => 'text'),
      insert: vi.fn(),
      replace: vi.fn(),
    },
    chat: {
      open: vi.fn(),
    },
    commands: {
      load: vi.fn(() => [
        { id: 1, icon: '1', label: 'Command 1', shortcut: '1', action: 'chat_window', state: 'enabled' },
        { id: 2, icon: '2', label: 'Command 2', shortcut: '2', action: 'paste_below', state: 'enabled' },
        { id: 3, icon: '3', label: 'Command 3', shortcut: '3', action: 'paste_in_place', state: 'enabled' },
        { id: 4, icon: '4', label: 'Command 4', shortcut: '4', action: 'clipboard_copy', state: 'enabled' },
        { id: 5, icon: '5', label: 'Command 5', shortcut: '5', action: 'chat_window', state: 'disabled' },
      ] as unknown[] as Command[]),
      save: vi.fn(),
      cancel: vi.fn(),
      closePicker: vi.fn(),
      closeResult: vi.fn(),
      resizeResult: vi.fn(),
      run: vi.fn(),
      isPromptEditable: vi.fn(() => true),
      import: vi.fn(),
      export: vi.fn(),
    },
    experts: {
      load: vi.fn(() => [
        { id: 'uuid1', type: 'system', name: 'actor1', prompt: 'prompt1', state: 'enabled' },
        { id: 'uuid2', type: 'system', name: 'actor2', prompt: 'prompt2', state: 'disabled' },
        { id: 'uuid3', type: 'user', name: 'actor3', prompt: 'prompt3', state: 'enabled', triggerApps: [ { identifier: 'app' }] }
      ] as Expert[]),
      save: vi.fn(),
      import: vi.fn(),
      export: vi.fn(),
    },
    history: {
      load: vi.fn(() => []),
      save: vi.fn(),
    },
    base64:{
      decode: (s) => `${s}_decoded`,
      encode: (s) => `${s}_encoded`,
    },
    clipboard: {
      writeText: vi.fn(),
      writeImage: vi.fn(),
    },
    file: {
      read: vi.fn((filepath: string) => { return { url: filepath, contents: `${filepath}_encoded`, mimeType: 'whatever' } }),
      readIcon: vi.fn(),
      save: vi.fn(() => 'file_url'),
      download: vi.fn(),
      pick: vi.fn(() => {
        return {
          url: 'file://image.png',
          mimeType: 'image/png',
          contents: 'image64'
         }
      }),
      pickDir: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      extractText: vi.fn((s) => `${s}_extracted`),
      getAppInfo: vi.fn(),
    },
    docrepo: {
      list: vi.fn((): DocumentBase[] => {
        return [
          { uuid: 'uuid1', name: 'docrepo1', embeddingEngine: 'ollama', embeddingModel: 'all-minilm', documents: [] },
          { uuid: 'uuid2', name: 'docrepo2', embeddingEngine: 'openai', embeddingModel: 'text-embedding-ada-002', documents: [
            { uuid: 'uuid3', type: 'file', title: 'file1', origin: '/tmp/file1', filename: 'file1', url: 'file:///tmp/file1' },
            { uuid: 'uuid4', type: 'folder', title: 'folder1', origin: '/tmp/folder1', filename: 'folder1', url: 'file:///tmp/folder1', items: [
              { uuid: 'uuid5', type: 'file', title: 'file2', origin: '/tmp/file2', filename: 'file2', url: 'file:///tmp/file2' },
              { uuid: 'uuid6', type: 'file', title: 'file3', origin: '/tmp/file3', filename: 'file3', url: 'file:///tmp/file3' },
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
      addDocument: vi.fn(),
      removeDocument: vi.fn(),
      query: vi.fn(async () => [
        {
          content: 'content',
          score: 1,
          metadata: {
            uuid: 1,
            type: 'type',
            title: 'title',
            url: 'url'
          }
        }
      ])
    },
    scratchpad: {
      open: vi.fn(),
    },
    nestor: {
      isAvailable: vi.fn(() => false),
      getStatus: vi.fn(),
      getTools: vi.fn(),
      callTool: vi.fn(),
    },
    anywhere: {
      prompt: vi.fn(),
      insert: vi.fn(),
      close: vi.fn(),
      resize: vi.fn(),
    },
    interpreter: {
      python: vi.fn(() => ({ result: ['bonjour'] }))
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
    },
    readaloud: {
      closePicker: vi.fn(),
    },
    whisper: {
      initialize: vi.fn(),
      transcribe: vi.fn(async () => ({ text: 'transcribed' })),
    },
    transcribe: {
      insert: vi.fn(),
      cancel: vi.fn(),
    },
  }

  // @ts-expect-error mock
  window.getSelection = () => {
    return {
      isCollapsed: true,
    }
  }
}

const useNavigatorMock = () => {

  // eslint-disable-next-line no-global-assign
  navigator = {
    // @ts-expect-error mock
    mediaDevices: {
      getUserMedia: vi.fn()
    }
  }

}

export { useWindowMock, useNavigatorMock, listeners }
