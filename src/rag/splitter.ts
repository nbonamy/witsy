
import { Configuration } from '../types/config.d'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import defaultSettings from '../../defaults/settings.json'

export default class {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  split(text: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.rag?.chunkSize ?? defaultSettings.rag.chunkSize,
      chunkOverlap: this.config.rag?.chunkOverlap ?? defaultSettings.rag.chunkOverlap,
  })
    return splitter.splitText(text)
  }

}
