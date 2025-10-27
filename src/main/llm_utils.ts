import { App } from 'electron'
import { initI18n } from '../services/i18n'
import { Agent, AgentRun } from '../types/agents'
import { Configuration } from '../types/config'
import { anyDict } from '../types/index'
import { loadAgents, saveAgentRun } from './agents'
import { loadSettings } from './config'
import { getLocaleMessages } from './i18n'
import { runPython } from './interpreter'
import * as pyodide from './pyodide'
import Mcp from './mcp'
import LocalSearch from './search'
import DocumentRepository from '../rag/docrepo'
import { DocumentBase } from '../types/rag'

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
          load: (wsId: string): Agent[] => {
            return loadAgents(this.app, wsId)
          },
          saveRun: (wsId: string, run: AgentRun): boolean =>  {
            return saveAgentRun(this.app, wsId, run)
          },
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
          downloadPyodide: async (): Promise<any> => {
            try {
              await pyodide.downloadPyodideRuntime()
              return { success: true }
            } catch (error) {
              return { success: false, error: error.message }
            }
          },
          isPyodideCached: (): Promise<boolean> => {
            return Promise.resolve(pyodide.isPyodideCached())
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          callTool: (name: string, parameters: anyDict, signalId?: string) => {
            return this.mcp?.callTool(name, parameters)
          },
        },

        // @ts-expect-error partial mock
        computer: {
          isAvailable: () => false,
        }
      }
    }

  }

}
