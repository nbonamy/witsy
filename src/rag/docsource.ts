
import { SourceType } from '../types/rag.d'
import path from 'path'

export default class DocumentSourceImpl {

  uuid: string
  title: string
  type: SourceType
  origin: string
  url: string
  items: DocumentSourceImpl[]

  constructor(id: string, type: SourceType, origin: string) {
    this.uuid = id
    this.type = type
    this.origin = origin
    if (this.type === 'file' || this.type === 'folder') {
      this.url = `file://${encodeURI(origin)}`
    } else {
      this.url = origin
    }
    this.title = this.getTitle()
    this.items = []
  }

  getTitle(): string {
    if (this.type === 'file') {
      return path.basename(decodeURI(this.url))
    } else if (this.title) {
      return this.title
    } else if (this.type === 'text') {
      return 'Text'
    } else {
      return this.url
    }
  }
}
