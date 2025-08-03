
import { A2APromptOpts } from '../types/index'
import { Message, MessageSendParams, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk'
import Agent from '../models/agent'
// @ts-expect-error unknown why this is a linting error
import { A2AClient as Client } from '@a2a-js/sdk/client'
import { LlmChunk } from 'multi-llm-ts'

export type A2AChunkStatus = {
  type: 'status'
  taskId?: string
  contextId?: string
  status?: string
}

export type A2AChunkArtifact = {
  type: 'artifact'
  name: string
  content: string
}

export type A2AChunk = LlmChunk | A2AChunkStatus | A2AChunkArtifact

export default class A2AClient {

  baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async getAgent(): Promise<Agent|null> {

    try {
    
      const response = await fetch(`${this.baseUrl}/.well-known/agent.json`)
      const agent = await response.json()

      return Agent.fromJson({
        source: 'a2a',
        name: agent.name,
        description: agent.description,
        instructions: this.baseUrl,
        steps: [{
          description: '',
          prompt: '',
          tools: [],
          agents: [],
          docrepo: null,
        }],
      })

    } catch (error) {
      console.error(`Error fetching agent definition from A2A client:`, error)
      return null
    }

  }

  async *execute(prompt: string, opts?: A2APromptOpts): AsyncGenerator<A2AChunk> {

    const messageId = crypto.randomUUID()
    
    try {

      const artifacts: Record<string, {
        name: string
        content: string
      }> = {}
      
      console.log(`[a2a] Starting streaming task for message ${messageId}`)

      // init
      let currentTaskId = opts?.currentTaskId
      let currentContextId = opts?.currentContextId

      // Construct the `MessageSendParams` object.
      const streamParams: MessageSendParams = {
        message: {
          messageId: messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: prompt }],
          taskId: currentTaskId,
          contextId: currentContextId,
        },
      }

      // Use the `sendMessageStream` method.
      const client = new Client(this.baseUrl)
      const stream = client.sendMessageStream(streamParams)

      for await (const event of stream) {

        // log
        console.log(`[a2a] Received event: ${JSON.stringify(event)}`);
        
        // the first event is often the Task object itself, establishing the ID.
        if (event.kind === 'task') {

          const taskEvent = event as Task
          currentTaskId = taskEvent.id
          currentContextId = taskEvent.contextId

          yield {
            type: 'status',
            taskId: currentTaskId,
            contextId: currentContextId,
          }
        }
        
        // differentiate subsequent stream events.
        if (event.kind === 'status-update') {

          const statusEvent = event as TaskStatusUpdateEvent;

          if ((statusEvent.taskId && statusEvent.taskId !== currentTaskId) ||
              (statusEvent.contextId && statusEvent.contextId !== currentContextId)) {
            currentTaskId = statusEvent.taskId ?? currentTaskId
            currentContextId = statusEvent.contextId ?? currentContextId
            yield {
              type: 'status',
              taskId: currentTaskId,
              contextId: currentContextId,
            }
          }

          if (statusEvent.status.message?.parts[0]?.kind === 'text') {

            if (statusEvent.status.state === 'working') {

              yield {
                type: 'status',
                taskId: currentTaskId,
                contextId: currentContextId,
                status: statusEvent.status.message.parts[0].text
              }

            } else {
            
              yield {
                type: 'content',
                text: statusEvent.status.message.parts[0].text,
                done: false,
              }

            }

          }

          if (statusEvent.status.state !== 'input-required' && statusEvent.final) {
            currentTaskId = undefined
            currentContextId = undefined
            yield {
              type: 'status',
            }
          }

        } else if (event.kind === 'artifact-update') {

          const artifactEvent = event as TaskArtifactUpdateEvent;
          const artifactId = artifactEvent.artifact.artifactId;

          if (!artifacts[artifactId]) {
            artifacts[artifactId] = {
              name: artifactEvent.artifact.name || `Artifact ${artifactId}`,
              content: ''
            }
          }

          for (const part of artifactEvent.artifact.parts) {
            if (part.kind === 'text') {
              artifacts[artifactId].content += part.text;
            } else if (part.kind === 'file') {
              artifacts[artifactId].content += `File: ${part.file.name}`;
            }
          }

          if (artifactEvent.lastChunk && artifacts[artifactId] && artifacts[artifactId].content.length > 0) {
            yield {
              type: 'artifact',
              ...artifacts[artifactId],
            }
          }

        } else if (event.kind === 'message') {

          const messageEvent = event as Message

          if ((messageEvent.taskId && messageEvent.taskId !== currentTaskId) ||
              (messageEvent.contextId && messageEvent.contextId !== currentContextId)) {
            currentTaskId = messageEvent.taskId ?? currentTaskId
            currentContextId = messageEvent.contextId ?? currentContextId
            yield {
              type: 'status',
              taskId: currentTaskId,
              contextId: currentContextId,
            }
          }

          yield {
            type: 'content',
            text: `Received message response: ${JSON.stringify(event)}`,
            done: false,
          }
        
        }

      }

      console.log(`[a2a] streaming for message ${messageId} finished`);

    } catch (error) {

      console.error('[a2a] errror during streaming', error);
      throw error
    
    } finally {

      yield {
        type: 'content',
        text: '',
        done: true,
      }
    
    }

  }

}
