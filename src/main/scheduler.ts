
import { CronExpressionParser } from 'cron-parser'
import { App } from 'electron'
import DocumentRepository from '../rag/docrepo'
import { AgentExecutor } from './agent_utils'
import { loadAgents } from './agents'
import Mcp from './mcp'
import { listWorkspaces } from './workspace'

export default class Scheduler extends AgentExecutor {

  timeout: NodeJS.Timeout|null = null

  constructor(app: App, mcp: Mcp, docRepo: DocumentRepository) {
    super(app, mcp, docRepo)
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
                this.runAgent(workspace.uuid, agent, 'schedule', prompt)

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

}
