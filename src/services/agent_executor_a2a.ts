
import { LlmChunkContent } from 'multi-llm-ts'
import Agent from '../models/agent'
import Message from '../models/message'
import { Configuration } from '../types/config'
import { A2APromptOpts, AgentRun, AgentRunTrigger } from '../types/index'
import A2AClient from './a2a-client'
import AgentExecutorBase from './agent_executor_base'
import { GenerationCallback, GenerationResult, LlmChunkCallback } from './generator'
import { t } from './i18n'

export interface AgentA2AExecutorOpts {
  runId?: string
  ephemeral?: boolean
  chat?: any // Chat type
  a2aContext?: A2APromptOpts
  callback?: LlmChunkCallback
  abortSignal?: AbortSignal
}

export default class AgentA2AExecutor extends AgentExecutorBase {

  constructor(config: Configuration, workspaceId: string, agent: Agent) {
    super(config, workspaceId, agent)
  }

  async run(trigger: AgentRunTrigger, prompt?: string, opts?: AgentA2AExecutorOpts, generationCallback?: GenerationCallback): Promise<AgentRun> {

    // create a run
    const run: AgentRun = {
      uuid: opts.runId || crypto.randomUUID(),
      agentId: this.agent.uuid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trigger: trigger,
      status: 'running',
      prompt: prompt,
      messages: [],
      toolCalls: [],
    }

    try {

      // create system message
      run.messages.push(new Message('system', ''))

      // save it
      if (!opts?.ephemeral) {
        this.saveRun(run)
      }

      // check abort before starting
      if (this.checkAbort(run, opts)) {
        return run
      }

      // add user message
      const userMessage = new Message('user', prompt || '')
      run.messages.push(userMessage)

      // add messages to chat
      if (opts?.chat) {

        // user
        opts.chat.addMessage(userMessage)

        // we need the assistant one for the ui to update properly
        const responseMessage = new Message('assistant')
        responseMessage.agentId = this.agent.uuid
        responseMessage.agentRunId = run.uuid
        opts.chat.addMessage(responseMessage)

      }

      // add assistant message
      const assistantMessage = opts?.chat ? opts.chat.lastMessage() : new Message('assistant')
      run.messages.push(assistantMessage)

      // callback
      generationCallback?.('before_generation')

      // save again
      if (!opts?.ephemeral) {
        this.saveRun(run)
      }

      // execute A2A
      const rc = await this.executeA2A(run, opts)

      // save
      run.status = rc === 'success' ? 'success' : 'error'
      run.updatedAt = Date.now()
      if (!opts?.ephemeral) {
        this.saveRun(run)
      }

    } catch (error) {

      // get the current assistant message (last in the array) to ensure reactivity
      const assistantMessage = run.messages[run.messages.length - 1]
      assistantMessage.appendText({ type: 'content', text: t('generator.errors.cannotContinue'), done: true })

      // record the error
      run.status = 'error'
      run.error = error.message
      run.updatedAt = Date.now()
      if (!opts?.ephemeral) {
        this.saveRun(run)
      }

    }

    // done
    generationCallback?.('generation_done')
    return run

  }

  private async executeA2A(run: AgentRun, opts: AgentA2AExecutorOpts): Promise<GenerationResult> {

    try {

      // init A2A client
      const client = new A2AClient(this.agent.instructions)

      // now process chunks
      const prompt = run.messages.find(m => m.role === 'user')?.content || ''
      for await (const chunk of client.execute(prompt, opts?.a2aContext)) {

        // check abort signal during streaming
        if (opts?.abortSignal?.aborted) {
          return 'stopped'
        }

        // get the current assistant message (last in the array) to ensure reactivity
        const assistantMessage = run.messages[run.messages.length - 1]

        if (chunk.type === 'content') {

          assistantMessage.appendText(chunk)
          opts?.callback?.(chunk)

        } else if (chunk.type === 'status') {

          // update chat
          if (chunk.taskId) {
            assistantMessage.a2aContext = {
              currentTaskId: chunk.taskId,
              currentContextId: chunk.contextId,
            }
          } else {
            delete assistantMessage.a2aContext
          }

          // update status
          if (chunk.status) {
            assistantMessage.setStatus(chunk.status)
          }


        } else if (chunk.type === 'artifact') {

          // we build a witsy artifact
          const artifact = `<artifact title="${chunk.name}">
\`\`\`
${chunk.content}
\`\`\`
</artifact>`

          // debug: emit artifact as content
          const textChunk: LlmChunkContent = {
            type: 'content',
            text: `\n\n${artifact}\n\n`,
            done: false,
          }
          assistantMessage.appendText(textChunk)
          opts?.callback?.(textChunk)

        }

      }

      // done
      return 'success'

    } catch (error) {
      console.error('Error while running A2A client', error)
      throw error
    }

  }

}
