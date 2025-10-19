
import { LlmChunk, LlmEngine } from 'multi-llm-ts'
import Chat from '../models/chat'
import Message from '../models/message'
import AgentPlugin, { AgentStorage } from '../plugins/agent'
import { kSearchPluginName } from '../plugins/search'
import { Configuration } from '../types/config'
import * as dr from './deepresearch'
import Generator, { GenerationResult } from './generator'

export default class DeepResearchMultiAgent implements dr.DeepResearch, AgentStorage {

  config: Configuration
  workspaceId: string
  storage: Record<string, any> = {}

  constructor(config: Configuration, workspaceId: string) {
    this.config = config
    this.workspaceId = workspaceId
  }

  run = async (engine: LlmEngine, chat: Chat, opts: dr.DeepResearchOpts): Promise<GenerationResult> => {

    // remove all previous plugins
    engine.clearPlugins()

    // to surface all agents work back to message
    const callback = (chunk: LlmChunk): void => {
      const lastMessage = chat.messages[chat.messages.length - 1]
      if (chunk.type === 'tool' && chunk.name === kSearchPluginName) {
        lastMessage.addToolCall(chunk)
      }
    }

    // add all deep research agents as plugins
    for (const agent of dr.deepResearchAgents) {
      const agentPlugin = new AgentPlugin(this.config, this.workspaceId, agent, agent.engine || engine.getId(), agent.model || opts.model, {
        storeData: !['writer', 'synthesis'].includes(agent.name),
        workflowOpts: {
          model: opts.model || agent.model,
          noToolsInContent: true,
          callback: callback,
        },
      }, ['planning'].includes(agent.name) ? null : this as AgentStorage)
      engine.addPlugin(agentPlugin)
    }

    // now update instructions
    const instructions = this.deepResearchInstructions
      .replace('{{numSections}}', String(opts.breadth || 3))
      .replace('{{numQueriesPerSection}}', String(opts.depth || 1))
      .replace('{{numSearchResults}}', String(opts.searchResults || 8))
    if (chat.messages.length === 0) {
      chat.messages.push(new Message('system', instructions))
    } else {
      chat.messages[0].content = instructions
    }

    // now we can generate
    const generator = new Generator(this.config)
    return await generator.generate(engine, chat.messages, {
      ...opts,
      ...chat.modelOpts,
      toolChoice: { type: 'tool', name: 'agent_planning'}
    })

  }

  store = async (value: any): Promise<string> => {
    const id = crypto.randomUUID()
    this.storage[id] = value
    return id
  }

  retrieve = async (key: string): Promise<any> => {
    return this.storage[key]
  }

  deepResearchInstructions = `You are a research coordinator, the master orchestrator of deep research investigations.

  Consider the user highly experienced so don't simplify your answer and be as detailed as possible and make sure your response is correct.
  Do not hesitate to provide detailed explanations. If you speculate or predict, clearly flag it as such.

  Your role is to coordinate work across a team of specialized agents to produce comprehensive, high-quality research reports. You never do work yourself, but instead always delegate tasks to the appropriate agents based on their expertise. You must not change the output of an agent before forwarding it to the next agent: just forward the output verbatim, as-is. When an agent returns a storeId, use the storeId as the value for the parameter value: agents will know how to retrieve the value from the storeId. If you use text returned by an agent, make sure you preseverve all markdown formatting and do not change the text in any way.

  The agents at your disposal are:
  - planning: use this agent to create a comprehensive research plan, decompose complex queries, and build the structure of the final report.
  - search: use this agent to execute targeted searches, extract relevant content, and evaluate source credibility
  - analysis: use this agent to extract key learning from the search results, identify patterns, and synthesize knowledge from multiple sources
  - section: use this agent to generate detailed sections of the report based on the analysis, ensuring each section is coherent and well-structured
  - synthesis: use this agent to generate executive summaries and conclusions based on the analysis

  An example of how to use these agents:
  - The user asks about a complex topic, e.g. "What are the latest advancements in quantum computing?"
  - You call the planning agent. It should return a list of sections with a title and correspond web search queries.
  - You will execute the following steps for each section:
    - You call the search agent with the query for that section and numSearchResults as maxResults: it will return a list of relevant sources with their contents.
    - You call the analysis agent with the verbatim and exhaustive content returned by the search agent: it will extract key learnings.
    - The section agent generates a section of the report based on the section objective and the key learnings.
  You will then call the synthesis agent to generate an executive summary and a conclusion based on the sections generated by the section agent.

  The final report will be structured as follows:
  - Executive Summary: high-level overview of the research findings written using the synthesis agent.
  - Detailed Sections: detailed reports of each section, generated by the section agent.
  - Conclusion: summary of the key findings and implications, generated by the synthesis agent.

  During the research process, you will regularly provide updates to the user of the progress.The status updates should be concise, informative, and provide a clear overview of the current state of the research.
    
    Examples of status updates:
    - "Let me analyze your request about quantum mechanics and create a research plan."
    - "I am done with the planning phase, I will now start gathering information for the following sections: Quantum Entanglement, Quantum Computing, and Quantum Cryptography."
    - "I have gathered information for the Quantum Entanglement section, I will now analyze it and extract key learnings."

    Notice none of those examples exceed 2 sentences and include "Status Update:" or any dumb text like that.

    numSections: {{numSections}}
    numQueriesPerSection: {{numQueriesPerSection}}
    numSearchResults: {{numSearchResults}}
  
  `

}
