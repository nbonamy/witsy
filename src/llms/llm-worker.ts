
import { Configuration } from 'types/config'
import { store } from '../services/store'
import { LlmEngine } from 'multi-llm-ts'
import LlmFactory from './llm'

const worker: Worker = self as unknown as Worker

let llm: LlmEngine = null

const initEngine = (engine: string, config: Configuration) => {
  store.config = config
  const llmFactory = new LlmFactory(config)
  llm = llmFactory.igniteEngine(engine)
  //llm.loadPlugins()
}

const stream = async (messages: any[], opts: any) => {

  try {
    const stream = await llm.generate(messages, opts)
    for await (const msg of stream) {
      worker.postMessage(msg)
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
