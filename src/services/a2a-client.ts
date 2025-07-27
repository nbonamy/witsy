
import { MessageSendParams, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk'
import { A2AClient as Client } from '@a2a-js/sdk/client'
import { LlmChunk } from 'multi-llm-ts'

export type A2AChunkStatus = {
  type: 'status'
  taskId: string
  status: string
}

export type A2AChunkArtifact = {
  type: 'artifact'
  name: string
  content: string
}

export type A2AChunk = LlmChunk | A2AChunkStatus | A2AChunkArtifact

export default class A2AClient {

  client: Client

  constructor(baseUrl: string) {
    this.client = new Client(baseUrl)
  }

  async *execute(prompt: string): AsyncGenerator<A2AChunk> {

    const messageId = crypto.randomUUID()
    
    try {

      const artifacts: Record<string, {
        name: string
        content: string
      }> = {}
      
      console.log(`\n--- Starting streaming task for message ${messageId} ---`)

      yield {
        type: 'content',
        text: `Starting A2A client with prompt: ${prompt}\n\n`,
        done: false,
      }

      // Construct the `MessageSendParams` object.
      const streamParams: MessageSendParams = {
        message: {
          messageId: messageId,
          role: "user",
          parts: [{ kind: "text", text: prompt }],
          kind: "message",
        },
      };

      // Use the `sendMessageStream` method.
      const stream = this.client.sendMessageStream(streamParams);
      let currentTaskId: string | undefined;

      for await (const event of stream) {
        
        // The first event is often the Task object itself, establishing the ID.
        if ((event as Task).kind === "task") {
          
          currentTaskId = (event as Task).id;
          
          yield {
            type: 'status',
            taskId: currentTaskId,
            status: `Task created. Status: ${(event as Task).status.state}`
          }
          continue
        }

        // Differentiate subsequent stream events.
        if ((event as TaskStatusUpdateEvent).kind === "status-update") {

          const statusEvent = event as TaskStatusUpdateEvent;
          
          if (statusEvent.status.message?.parts[0]?.kind === "text") {
            yield {
              type: 'status',
              taskId: currentTaskId,
              status: `${statusEvent.status.state} - ${statusEvent.status.message.parts[0].text}`
            }
          }

          if (statusEvent.final) {
            yield {
              type: 'status',
              taskId: currentTaskId,
              status: `Stream marked as final.`
            }
            break
          }

        } else if ((event as TaskArtifactUpdateEvent).kind === "artifact-update") {

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

          if (artifactEvent.lastChunk && artifacts[artifactId]) {
            yield {
              type: 'artifact',
              ...artifacts[artifactId],
            };
          }

        } else {

          // This could be a direct Message response if the agent doesn't create a task.
          console.log("Received direct message response in stream:", event);

          yield {
            type: 'content',
            text: `Received message response: ${JSON.stringify(event)}`,
            done: false,
          }
        
        }

      }

      console.log(`--- Streaming for message ${messageId} finished ---`);

    } catch (error) {

      console.error(`Error during streaming for message ${messageId}:`, error);
    
    } finally {

      yield {
        type: 'content',
        text: '',
        done: true,
      }
    
    }

  }

}
