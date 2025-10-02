
import { Agent, AgentRun } from '../types/index'
import { App } from 'electron'
import { CronExpressionParser } from 'cron-parser'
import { loadSettings } from './config'
import { loadAgents } from './agents'
import { runPython } from './interpreter'
import { initI18n } from '../services/i18n'
import { getLocaleMessages } from './i18n'
import * as agents from './agents'
import Runner from '../services/runner'
import Mcp from './mcp'
import LocalSearch from './search'
import { listWorkspaces } from './workspace'

export default class Scheduler {

  app: App
  mcp: Mcp
  timeout: NodeJS.Timeout|null = null

  constructor(app: App, mcp: Mcp) {
    this.app = app
    this.mcp = mcp
    this.mock()
    initI18n()
  }

  stop() {
    clearInterval(this.timeout)
    this.timeout = null
  }

  async start(): Promise<void> {

    // clear previous
    this.stop()

    // we want to run on next minute
    const now = new Date()
    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    setTimeout(() => {
      this.check()
    }, delay)

  }

  async check(): Promise<void> {

    try {

      // we need to check is we where 30 seconds before to make sure we don't miss
      const tolerance = 30 * 1000
      const now: number = Date.now()

      // we need a config
      const config = loadSettings(this.app)

      // load agents
      const workspaces = listWorkspaces(this.app)
      for (const workspace of workspaces) {

        // iterate over all agents
        const agents = loadAgents(this.app, workspace.uuid)
        for (const agent of agents) {

          try {

            // check if agent has a schedule
            if (!agent.schedule) {
              continue
            }

            // check if schedule is due
            const interval = CronExpressionParser.parse(agent.schedule, { currentDate: now - tolerance })
            const next = interval.next().getTime()
            if (Math.abs(next - now) < tolerance) {

              console.log(`Agent ${agent.name} is due to run`)

              try {
                
                // build a prompt
                const prompt = agent.buildPrompt(0, agent.invocationValues)
                
                // now run it
                const runner = new Runner(config, workspace.uuid, agent)
                runner.run('schedule', prompt)
              
              } catch (error) {
                console.log(`Error running agent ${agent.name}`, error)
                continue
              }

            }

          } catch (error) {
            console.log(`Error checking schedule for ${agent.name}`, error)
            continue
          }

        }
      }

    } finally {

      // schedule next
      this.start()

    }

  }

  mock() {

    // plugins were designed to be run in renderer process
    // and therefore are accessing main process via ipc calls
    // we need to mock this

    global.window = {
      api: {

        // @ts-expect-error partial mock
        config: {
          localeUI: () => {
            const config = loadSettings(this.app)
            return config.general.locale || 'en-US'
          },
          localeLLM: () => {
            const config = loadSettings(this.app)
            return config.llm.locale || 'en-US'
          },
          getI18nMessages: () => {
            return getLocaleMessages(this.app)
          }
        },

        // @ts-expect-error partial mock
        agents: {
          load: (workspaceId: string): Agent[] => {
            return agents.loadAgents(this.app, workspaceId)
          },
          saveRun: (workspaceId: string, run: AgentRun): boolean =>  {
            return agents.saveAgentRun(this.app, workspaceId, run)
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
