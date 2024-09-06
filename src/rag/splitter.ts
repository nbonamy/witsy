
import { Configuration } from '../types/config.d'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

export default class {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  split(text: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.rag?.chunkSize ?? 1000,
      chunkOverlap: this.config.rag?.chunkOverlap ?? 100,
  })
    return splitter.splitText(text)
  }

}
