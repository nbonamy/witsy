
import { AgentRun, anyDict } from '../types/index'
import { App } from 'electron'
import { notifyBrowserWindows } from './windows'
import Agent from '../models/agent'
import path from 'path'
import fs from 'fs'

export const agentsDirPath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const agentsDirPath = path.join(userDataPath, 'agents')
  return agentsDirPath
}

export const loadAgents = (source: App|string): Agent[] => {

  // init
  const agents: Agent[] = []
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source)

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

export const saveAgent = (source: App|string, json: anyDict): boolean => {

  // init
  const agent = Agent.fromJson(json);
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source)
  const filePath = path.join(agentsDir, agent.id + '.json')

  // create directory if it does not exist
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true })
  }

  // write file
  try {
    fs.writeFileSync(filePath, JSON.stringify(agent, null, 2))
    return true
  } catch (error) {
    console.log('Error saving agent', filePath, error)
    return false
  }

}

export const deleteAgent = (source: App|string, agentId: string): boolean => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source)
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
  return true

}

export const getAgentRun = (source: App|string, agentId: string, runId: string): AgentRun|null => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source)
  const runPath = path.join(agentsDir, agentId, runId + '.json')

  try {
    const content = fs.readFileSync(runPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.log('Error reading agent run file', runPath, error)
    return null
  }
}

export const getAgentRuns = (source: App|string, agentId: string): AgentRun[]|null => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source)
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

export const saveAgentRun = (source: App|string, run: AgentRun): boolean => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source)
  const runPath = path.join(agentsDir, run.agentId)
  if (!fs.existsSync(runPath)) {
    fs.mkdirSync(runPath, { recursive: true })
  }

  const filePath = path.join(runPath, run.id + '.json')

  // write file
  try {
    fs.writeFileSync(filePath, JSON.stringify(run, null, 2))
    notifyBrowserWindows('agent-run-update', { agentId: run.agentId, runId: run.id })
    return true
  } catch (error) {
    console.log('Error saving agent run', filePath, error)
    return false
  }

}

export const deleteAgentRuns = (source: App|string, agentId: string): boolean => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source)
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

export const deleteAgentRun = (source: App|string, agentId: string, runId: string): boolean => {

  // init
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source)
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