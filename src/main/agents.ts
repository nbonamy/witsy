
import { anyDict } from 'types/index'
import { AgentRun } from 'types/agents'
import { App } from 'electron'
import { notifyBrowserWindows } from './windows'
import { workspaceFolderPath } from './workspace'
import Agent from '../models/agent'
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

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
  const filePath = path.join(agentsDir, agentId + '.json')

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return Agent.fromJson(JSON.parse(content))
  } catch (error) {
    console.log('Error reading agent file', filePath, error)
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

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
  const filePath = path.join(agentsDir, agentId + '.json')

  // delete file
  try {
    fs.unlinkSync(filePath)
  } catch (error) {
    console.log('Error deleting agent', filePath, error)
    return false
  }

  // delete run directory
  const runPath = path.join(agentsDir, agentId)
  try {
    if (fs.existsSync(runPath)) {
      fs.rmSync(runPath, { recursive: true, force: true })
    }
  }
  catch (error) {
    console.log('Error deleting agent run directory', runPath, error)
    return false
  }
  
  // done
  notifyBrowserWindows('agents-updated', { workspaceId })
  return true

}

export const getAgentRun = (source: App|string, workspaceId: string, agentId: string, runId: string): AgentRun|null => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
  const runPath = path.join(agentsDir, agentId, runId + '.json')

  try {
    const content = fs.readFileSync(runPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.log('Error reading agent run file', runPath, error)
    return null
  }
}

export const getAgentRuns = (source: App|string, workspaceId: string, agentId: string): AgentRun[]|null => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
  const runPath = path.join(agentsDir, agentId)

  // iterate over all files
  const runs: AgentRun[] = []
  try {
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
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving agent runs', error)
    }
  }

  // done
  return runs.sort((a, b) => a.createdAt - b.createdAt)

}

export const saveAgentRun = (source: App|string, workspaceId: string, run: AgentRun): boolean => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
  const runPath = path.join(agentsDir, run.agentId)
  if (!fs.existsSync(runPath)) {
    fs.mkdirSync(runPath, { recursive: true })
  }

  const filePath = path.join(runPath, run.uuid + '.json')

  // write file
  try {
    fs.writeFileSync(filePath, JSON.stringify(run, null, 2))
    notifyBrowserWindows('agent-run-update', { agentId: run.agentId, runId: run.uuid })
    return true
  } catch (error) {
    console.log('Error saving agent run', filePath, error)
    return false
  }

}

export const deleteAgentRuns = (source: App|string, workspaceId: string, agentId: string): boolean => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
  const runPath = path.join(agentsDir, agentId)

  // delete directory
  try {
    if (fs.existsSync(runPath)) {
      fs.rmSync(runPath, { recursive: true, force: true })
    }
  }
  catch (error) {
    console.log('Error deleting agent run directory', runPath, error)
    return false
  }

  // done
  return true

}

export const deleteAgentRun = (source: App|string, workspaceId: string, agentId: string, runId: string): boolean => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source, workspaceId)
  const runPath = path.join(agentsDir, agentId, runId + '.json')

  // delete file
  try {
    fs.unlinkSync(runPath)
  } catch (error) {
    console.log('Error deleting agent run', runPath, error)
    return false
  }

  // done
  return true

}