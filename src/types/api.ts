
import { Size } from 'electron'
import { anyDict, History, Command, ComputerAction, Expert, ExternalApp, FileContents, FileDownloadParams, FileSaveParams } from './index'
import { DocRepoQueryResponseItem, DocumentBase } from './rag'
import { RunCommandParams } from './automation'
import { Configuration } from './config'

declare global {
  interface Window {
    api: {
      licensed: boolean
      platform: string
      isMasBuild: boolean
      userDataPath: string
      on: (signal: string, callback: (value: any) => void) => void
      off: (signal: string, callback: (value: any) => void) => void
      setAppearanceTheme(theme: string): void
      showDialog(opts: any): Promise<Electron.MessageBoxReturnValue>
      listFonts(): string[]
      fullscreen(state: boolean): void
      runAtLogin: {
        get(): boolean
        set(state: boolean): void
      }
      store: {
        get(key: string, fallback: any): any
        set(key: string, value: any): void
      }
      base64: {
        encode(data: string): string
        decode(data: string): string
      }
      file: {
        read(filepath: string): FileContents
        readIcon(filepath: string): FileContents
        save(opts: FileSaveParams): string
        download(opts: FileDownloadParams): string
        pick(opts: anyDict): string|string[]|FileContents
        pickDir(): string
        delete(filepath: string): void
        find(name: string): string
        extractText(contents: string, format: string): string
        getAppInfo(filepath: string): ExternalApp
      }
      shortcuts: {
        register(): void
        unregister(): void
      }
      update: {
        isAvailable(): boolean
        apply(): void
      }
      config: {
        load(): Configuration
        save(config: Configuration): void
      }
      history: {
        load(): History
        save(history: History): void
      }
      automation: {
        getText(id: string): string
        insert(text: string): void
        replace(text: string): void
      }
      chat: {
        open(chatId: string): void
      }
      commands: {
        load(): Command[]
        save(commands: Command[]): void
        cancel(): void
        closePicker(): void
        closeResult(): void
        resizeResult(deltaX: number, deltaY: number): void
        run(params: RunCommandParams): void
        isPromptEditable(id: string): boolean
        import(): boolean
        export(): boolean
      }
      anywhere: {
        prompt(): void
        insert(prompt: string): void
        close(): void
        resize(deltaX: number, deltaY: number): void
      }
      experts: {
        load(): Expert[]
        save(experts: Expert[]): void
        import(): boolean
        export(): boolean
      }
      docrepo: {
        list(): DocumentBase[]
        connect(baseId: string): void
        disconnect(): void
        isEmbeddingAvailable(engine: string, model: string): boolean
        create(title: string, embeddingEngine: string, embeddingModel: string): string
        rename(id: string, title: string): void
        delete(id: string): void
        addDocument(id: string, type: string, url: string): void
        removeDocument(id: string, docId: string): void
        query(id: string, text: string): Promise<DocRepoQueryResponseItem[]>
      },
      readaloud: {
        closePalette(): void
      },
      whisper: {
        initialize(): void
        transcribe(audioBlob: Blob): Promise<{ text: string }>
      },
      transcribe: {
        insert(text: string): void
        cancel(): void
      },
      clipboard: {
        writeText(text: string): void
        writeImage(path: string): void
      },
      markdown: {
        render(markdown: string): string
      }
      interpreter: {
        python(code: string): any
      }
      nestor: {
        isAvailable(): boolean
        getStatus(): any
        getTools(): any
        callTool(name: string, parameters: anyDict): any
      }
      scratchpad: {
        open(textId?: string): void
      }
      computer: {
        isAvailable(): boolean
        getScaledScreenSize(): Size
        getScreenNumber(): number
        takeScreenshot(): string
        executeAction(action: ComputerAction): any
      }
      memory: {
        hasFacts(): boolean
        reset(): void
        store(content: string): boolean
        retrieve(query: string): string[]
      }      
    }
  }
}
