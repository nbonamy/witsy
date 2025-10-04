import { App } from 'electron'
import { Agent, AgentRun, AgentRunTrigger } from '../types/index'
import { Configuration } from '../types/config'
import { loadAgents, saveAgentRun } from './agents'
import { listWorkspaces } from './workspace'
import { runPython } from './interpreter'
import { getLocaleMessages } from './i18n'
import Runner from '../services/runner'
import Mcp from './mcp'
import LocalSearch from './search'
import { initI18n } from '../services/i18n'
import { loadSettings } from './config'

/**
 * Generate a unique 8-character alphanumeric webhook token for an agent
 * Ensures uniqueness across all agents in all workspaces
 */
export function generateWebhookToken(app: App, workspaceId: string, agentId: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const maxAttempts = 1000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate 8 random characters
    let token = ''
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    // Check if token is unique across all workspaces
    let isUnique = true
    const workspaces = listWorkspaces(app)

    for (const workspace of workspaces) {
      const agents = loadAgents(app, workspace.uuid)
      for (const agent of agents) {
        // Skip the agent we're generating for
        if (workspace.uuid === workspaceId && agent.uuid === agentId) {
          continue
        }
        if (agent.webhookToken === token) {
          isUnique = false
          break
        }
      }
      if (!isUnique) break
    }

    // If unique return
    if (isUnique) {
      return token
    }
  }

  throw new Error('Failed to generate unique webhook token after maximum attempts')
}

/**
 * Find an agent by its webhook token across all workspaces
 */
export function findAgentByWebhookToken(app: App, token: string): { agent: Agent, workspaceId: string } | null {
  const workspaces = listWorkspaces(app)

  for (const workspace of workspaces) {
    const agents = loadAgents(app, workspace.uuid)
    const agent = agents.find(a => a.webhookToken === token)

    if (agent) {
      return { agent, workspaceId: workspace.uuid }
    }
  }

  return null
}

export class AgentExecutor {

  protected app: App
  protected mcp: Mcp

  constructor(app: App, mcp: Mcp) {
    this.app = app
    this.mcp = mcp
    initI18n()
  }

  public async runAgent(
    workspaceId: string,
    agent: Agent,
    trigger: AgentRunTrigger,
    prompt: string,
    runId?: string
  ): Promise<AgentRun> {

    const config = loadSettings(this.app)
    this.installGlobalMock(config)

    // Create runner and execute
    const runner = new Runner(config, workspaceId, agent)
    return await runner.run(trigger, prompt, { runId, model: agent.model } )
  }

  protected installGlobalMock = (config: Configuration) => {

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
          query: (payload: any) => {
            const { query, num } = payload
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
      }
    }

  }
  
}

