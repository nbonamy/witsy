
import { Configuration } from 'types/config'
import { store } from '../services/store'
import { igniteEngine } from './llm'
import { LlmEngine, LlmChunk, LlmEvent } from 'multi-llm-ts'

const worker: Worker = self as unknown as Worker

let llm: LlmEngine = null

const initEngine = (engine: string, config: Configuration) => {
  store.config = config
  llm = igniteEngine(engine)
  //llm.loadPlugins()
}

const stream = async (messages: any[], opts: any) => {

  try {
    let stream = await llm.stream(messages, opts)
    while (stream) {
      let newStream = null
      for await (const streamChunk of stream) {
        const chunk: LlmChunk = await llm.streamChunkToLlmChunk(streamChunk, (event: LlmEvent) => {
          if (event.type === 'stream') {
            newStream = event.content
          } else  if (event.type === 'tool') {
            worker.postMessage({ type: 'tool', content: event.content })
          }
        })
        worker.postMessage({ type: 'chunk', chunk: chunk })
      }
      stream = newStream
    }
  } catch (error) {
    console.error('Error while generating text', error)
    worker.postMessage({ type: 'error', error: error })
  }    

}

worker.addEventListener('message', (event: MessageEvent<any>) => {

  // log
  console.log('Worker received message', JSON.stringify(event.data).substr(0, 100))

  // init
  if (event.data.type === 'init') {
    initEngine(event.data.engine, event.data.config)
    return
  }

  // stream
  if (event.data.type === 'stream') {
    stream(event.data.messages, event.data.opts)
    return
  }

  // too bad
  console.log('Unknown message type', event.data.type)

})

export default worker
