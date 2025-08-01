
import { Agent, AgentRun } from '../types/index'
import { App } from 'electron'
import { CronExpressionParser } from 'cron-parser'
import { loadSettings } from './config'
import { loadAgents } from './agents'
import { runPython } from './interpreter'
import { wait } from './utils'
import { initI18n } from '../services/i18n'
import { getLocaleMessages } from './i18n'
import * as agents from './agents'
import Runner from '../services/runner'
import Mcp from './mcp'
import LocalSearch from './search'

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
    await wait(delay)
    return this.check()

  }

  async check(): Promise<void> {

    // we need to check is we where 30 seconds before to make sure we don't miss
    const tolerance = 30 * 1000
    const now: number = Date.now()

    // we need a config
    const config = loadSettings(this.app)
    if (!(config.features?.agents)) {
      setTimeout(() => this.start(), 5000)
      return
    }

    // load agents
    const agents: Agent[] = loadAgents(this.app)

    // iterate over all agents
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
            const runner = new Runner(config, agent)
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

    // schedule next
    this.start()

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
          load: (): Agent[] => {
            return agents.loadAgents(this.app)
          },
          saveRun: (run: AgentRun): boolean =>  {
            return agents.saveAgentRun(this.app, run)
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
        },
        
        // @ts-expect-error partial mock
        mcp: {
          isAvailable: () => true,
          getTools: this.mcp?.getTools,
          callTool: this.mcp?.callTool,
        },
      }
    }

  }

}
