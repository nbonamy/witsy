import { App } from 'electron'
import { Agent, AgentRun } from '../types/index'
import { Configuration } from '../types/config'
import { loadAgents, saveAgentRun } from './agents'
import { getLocaleMessages } from './i18n'
import { runPython } from './interpreter'
import LocalSearch from './search'
import Mcp from './mcp'
import { initI18n } from '../services/i18n'
import { loadSettings } from './config'

/**
 * Base class for LLM operations that need global mocks and i18n
 */
export class LlmContext {

  protected app: App
  protected mcp: Mcp

  constructor(app: App, mcp: Mcp) {
    this.app = app
    this.mcp = mcp
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
        },

        search: {
          query: (query: string, num: number = 5) => {
            const localSearch = new LocalSearch()
            const results = localSearch.search(query, num)
            return results
          },
          test: async () => true,
        },

        // @ts-expect-error partial mock
        mcp: {
          isAvailable: () => true,
          getLlmTools: this.mcp?.getLlmTools,
          callTool: this.mcp?.callTool,
        },

        // @ts-expect-error partial mock
        computer: {
          isAvailable: () => false,
        }
      }
    }

  }

}
