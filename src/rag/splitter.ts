
import { Configuration } from 'types/config.d'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import defaultSettings from '../../defaults/settings.json'

export default class {

  config: Configuration
  chunkSize: number
  chunkOverlap: number
  splitter: RecursiveCharacterTextSplitter

  constructor(config: Configuration) {
    this.config = config
    this.chunkSize = this.config.rag?.chunkSize ?? defaultSettings.rag.chunkSize
    this.chunkOverlap = this.config.rag?.chunkOverlap ?? defaultSettings.rag.chunkOverlap
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap
    })
  }

  split(text: string): Promise<string[]> {
    return this.splitter.splitText(text)
  }

}
