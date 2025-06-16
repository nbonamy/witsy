
import { Agent, AgentRun } from '../types/index'
import { App } from 'electron'
import { CronExpressionParser } from 'cron-parser'
import { loadSettings } from './config'
import { loadAgents } from './agents'
import { runPython } from './interpreter'
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
  }

  stop() {
    clearInterval(this.timeout)
    this.timeout = null
  }

  start() {

    // clear previous
    this.stop()

    // we want to on next minute
    const now = new Date()
    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    setTimeout(() => this.check(), delay)

  }

  check() {

    return

    if (this.mcp.getStatus().servers.length === 0) {
      this.start()
      return
    }

    // we need to check is we where 30 seconds before to make sure we don't miss
    const tolerance = 30 * 1000
    const now: number = Date.now()

    // we need a config
    const config = loadSettings(this.app)

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
            const runner = new Runner(config, agent)
            runner.run('schedule')
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
        agents: {
          saveRun: (run: AgentRun): boolean =>  {
            return window.api.agents.saveRun(run);
          },
        },
        interpreter: {
          python: async (script: string) => {
            try {
              const result = await runPython(script);
              return {
                result: result
              }
            } catch (error) {
              console.log('Error while running python', error);
              return {
                error: error || 'Unknown error'
              }
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
          getTools: this.mcp.getTools,
          callTool: this.mcp.callTool,
        },
      }
    }

  }

}
