import { App } from 'electron'
import { Agent, AgentRun } from 'types/agents'
import { Configuration } from 'types/config'
import { anyDict, Expert } from 'types/index'
import { DocumentBase } from 'types/rag'
import { initI18n } from '../renderer/services/i18n'
import * as agents from './agents'
import { loadSettings } from './config'
import * as experts from './experts'
import * as file from './file'
import { getLocaleMessages } from './i18n'
import { runPython } from './interpreter'
import Mcp from './mcp'
import * as pyodide from './pyodide'
import DocumentRepository from './rag/docrepo'
import LocalSearch from './search'
import * as text from './text'

/**
 * Base class for LLM operations that need global mocks and i18n
 */
export class LlmContext {

  protected app: App
  protected mcp: Mcp
  protected docRepo: DocumentRepository

  constructor(app: App, mcp: Mcp, docRepo: DocumentRepository) {
    this.app = app
    this.mcp = mcp
    this.docRepo = docRepo
  }

  /**
   * Initialize global context needed for LLM operations
   * - Loads configuration
   * - Installs global window mock
   * - Initializes i18n
   */
  public initializeContext(): Configuration {
    const config = loadSettings(this.app)
    this.installGlobalMock(config)
    initI18n()
    return config
  }

  /**
   * Install global window mock for Node.js environment
   * This allows code that expects browser globals to work
   */
  private installGlobalMock(config: Configuration) {

    global.window = {
      api: {

        platform: process.platform,

        // @ts-expect-error partial mock
        config: {
          localeUI: () => {
            return config.general.locale || 'en-US'
          },
          localeLLM: () => {
            return config.llm.locale || 'en-US'
          },
          getI18nMessages: () => {
            return getLocaleMessages(this.app)
          }
        },

        // @ts-expect-error partial mock
        agents: {
          list: (wsId: string): Agent[] => {
            return agents.listAgents(this.app, wsId)
          },
          load: (wsId: string, agentId: string): Agent|null => {
            return agents.loadAgent(this.app, wsId, agentId)
          },
          save: (wsId: string, agent: anyDict): boolean => {
            return agents.saveAgent(this.app, wsId, agent)
          },
          saveRun: (wsId: string, run: AgentRun): boolean =>  {
            return agents.saveAgentRun(this.app, wsId, run)
          },
        },

        // @ts-expect-error partial mock
        experts: {
          load: (wsId: string): Expert[] => {
            return experts.loadExperts(this.app, wsId)
          }
        },

        // @ts-expect-error partial mock
        docrepo: {
          list: (workspaceId: string): DocumentBase[] => {
            return this.docRepo.list(workspaceId)
          },
          query: async (baseId: string, query: string): Promise<any> => {
            return this.docRepo.query(baseId, query)
          }
        },

        // @ts-expect-error partial mock
        interpreter: {
          python: async (script: string): Promise<any> => {
            try {
              const result = await runPython(script);
              return { result: result }
            } catch (error) {
              console.log('Error while running python', error);
              return { error: error || 'Unknown error' }
            }
          },
          pyodide: async (script: string): Promise<any> => {
            return await pyodide.runPythonCode(script)
          },
        },

        search: {
          query: (query: string, num: number = 5) => {
            const localSearch = new LocalSearch()
            const results = localSearch.search(query, num)
            return results
          },
          cancel: () => {},
          test: async () => true,
        },

        // @ts-expect-error partial mock
        mcp: {
          isAvailable: () => true,
          getLlmTools: this.mcp?.getLlmTools,
          originalToolName: Mcp.originalToolName,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          callTool: (name: string, parameters: anyDict, signalId?: string) => {
            return this.mcp?.callTool(name, parameters)
          },
        },

        // @ts-expect-error partial mock
        file: {
          normalize: (filePath: string) => file.normalizePath(this.app, filePath),
          exists: (filePath: string) => file.fileExists(this.app, filePath),
          listDirectory: (dirPath: string, includeHidden?: boolean) => {
            try {
              return {
                success: true,
                items: file.listDirectory(this.app, dirPath, includeHidden)
              }
            } catch (error) {
              console.error('Error while listing directory', error);
              return {
                success: false,
                error: error.message
              }
            }
          },
          findFiles: async (basePath: string, pattern: string, maxResults?: number) => {
            try {
              return await file.findFiles(this.app, basePath, pattern, maxResults)
            } catch (error) {
              console.error('Error while finding files', error);
              return []
            }
          },
          read: (filePath: string) => file.getFileContents(this.app, filePath),
          write: (filePath: string, contents: string) => file.writeFile(this.app, filePath, contents),
          delete: (filePath: string) => file.deleteFile(filePath),
          extractText: (contents: string, format: string) => {
            return text.getTextContent(contents, format)
          }
        },

        // @ts-expect-error partial mock
        computer: {
          isAvailable: () => false,
        }
      }
    }

  }

}
