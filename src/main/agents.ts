
import { anyDict } from 'types/index'
import { AgentRun } from 'types/agents'
import { App } from 'electron'
import { notifyBrowserWindows } from './windows'
import { workspaceFolderPath } from './workspace'
import Agent from '@models/agent'
import path from 'path'
import fs from 'fs'

export const agentsDirPath = (app: App, workspaceId: string): string => {
  const workspacePath = workspaceFolderPath(app, workspaceId)
  return path.join(workspacePath, 'agents')
}

export const listAgents = (source: App|string, workspaceId: string): Agent[] => {

  // init
  const agents: Agent[] = []
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)

  // iterate over all files
  try {
    const files = fs.readdirSync(agentsDir)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const filePath = path.join(agentsDir, file)
      if (fs.statSync(filePath).isFile()) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          agents.push(Agent.fromJson(JSON.parse(content)))
        }
        catch (error) {
          console.log('Error reading agent file', filePath, error)
          continue
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving agents', error)
    }
  }

  // done
  return agents

}

export const loadAgent = (source: App|string, workspaceId: string, agentId: string): Agent|null => {

  try {

    // init
    const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
    const filePath = path.join(agentsDir, agentId + '.json')

    const content = fs.readFileSync(filePath, 'utf-8')
    return Agent.fromJson(JSON.parse(content))

  } catch (error) {
    console.log('Error reading agent file', workspaceId, agentId, error)
    return null
  }
}

export const saveAgent = (source: App|string, workspaceId: string, json: anyDict): boolean => {

  // the agent
  const agent = Agent.fromJson(json);
  agent.steps.forEach(step => {
    delete step.structuredOutput
  })

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
  const filePath = path.join(agentsDir, agent.uuid + '.json')

  // create directory if it does not exist
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true })
  }

  // write file
  try {
    fs.writeFileSync(filePath, JSON.stringify(agent, null, 2))
    notifyBrowserWindows('agents-updated', { workspaceId })
    return true
  } catch (error) {
    console.log('Error saving agent', filePath, error)
    return false
  }

}

export const deleteAgent = (source: App|string, workspaceId: string, agentId: string): boolean => {

  try {

    // init
    const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
    const filePath = path.join(agentsDir, agentId + '.json')

    // delete file
    fs.unlinkSync(filePath)

    // delete run directory
    const runPath = path.join(agentsDir, agentId)
    if (fs.existsSync(runPath)) {
      fs.rmSync(runPath, { recursive: true, force: true })
    }

    // done
    notifyBrowserWindows('agents-updated', { workspaceId })
    return true

  } catch (error) {
    console.log('Error deleting agent', workspaceId, agentId, error)
    return false
  }

}

export const getAgentRun = (source: App|string, workspaceId: string, agentId: string, runId: string): AgentRun|null => {

  try {

    // init
    const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
    const runPath = path.join(agentsDir, agentId, runId + '.json')

    const content = fs.readFileSync(runPath, 'utf-8')
    return JSON.parse(content)

  } catch (error) {
    console.log('Error reading agent run file', workspaceId, agentId, runId, error)
    return null
  }
}

export const getAgentRuns = (source: App|string, workspaceId: string, agentId: string): AgentRun[] => {

  try {

    // init
    const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
    const runPath = path.join(agentsDir, agentId)

    // iterate over all files
    const runs: AgentRun[] = []
    const files = fs.readdirSync(runPath)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const filePath = path.join(runPath, file)
      if (fs.statSync(filePath).isFile()) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          runs.push(JSON.parse(content))
        }
        catch (error) {
          console.log('Error reading agent run file', filePath, error)
          continue
        }
      }
    }

    // done
    return runs.sort((a, b) => a.createdAt - b.createdAt)

  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving agent runs', workspaceId, agentId, error)
    }
    return []
  }

}

export const saveAgentRun = (source: App|string, workspaceId: string, run: AgentRun): boolean => {

  try {

    // init
    const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
    const runPath = path.join(agentsDir, run.agentId)
    if (!fs.existsSync(runPath)) {
      fs.mkdirSync(runPath, { recursive: true })
    }

    const filePath = path.join(runPath, run.uuid + '.json')

    // write file
    fs.writeFileSync(filePath, JSON.stringify(run, null, 2))
    notifyBrowserWindows('agent-run-update', { agentId: run.agentId, runId: run.uuid })
    return true

  } catch (error) {
    console.log('Error saving agent run', workspaceId, run?.agentId, run?.uuid, error)
    return false
  }

}

export const deleteAgentRuns = (source: App|string, workspaceId: string, agentId: string): boolean => {

  try {

    // init
    const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
    const runPath = path.join(agentsDir, agentId)

    // delete directory
    if (fs.existsSync(runPath)) {
      fs.rmSync(runPath, { recursive: true, force: true })
    }

    // done
    return true

  } catch (error) {
    console.log('Error deleting agent run directory', workspaceId, agentId, error)
    return false
  }

}

export const deleteAgentRun = (source: App|string, workspaceId: string, agentId: string, runId: string): boolean => {

  try {

    // init
    const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
    const runPath = path.join(agentsDir, agentId, runId + '.json')

    // delete file
    fs.unlinkSync(runPath)

    // done
    return true

  } catch (error) {
    console.log('Error deleting agent run', workspaceId, agentId, runId, error)
    return false
  }

}