
import { SourceType } from '../types/rag'
import path from 'path'
import fs from 'fs'

export default class DocumentSourceImpl {

  uuid: string
  type: SourceType
  title: string
  origin: string
  filename: string
  url: string
  items: DocumentSourceImpl[]
  lastModified: number
  fileSize: number

  constructor(id: string, type: SourceType, origin: string, title?: string) {
    this.uuid = id
    this.type = type
    this.origin = origin
    if (this.type === 'file' || this.type === 'folder') {
      this.filename = path.basename(origin)
      this.url = `file://${encodeURI(origin)}`
    } else {
      this.url = title
    }
    this.title = title || this.getDefaultTitle()
    this.items = []
  }

  static fromJSON(json: any): DocumentSourceImpl {
    const source = new DocumentSourceImpl(json.uuid, json.type, json.origin, json.title)
    source.origin = json.origin
    source.filename = json.filename
    source.url = json.url
    source.lastModified = json.lastModified || 0
    source.fileSize = json.fileSize || 0
    if (json.items) {
      source.items = json.items.map((item: any) => DocumentSourceImpl.fromJSON(item))
    }
    return source
  }

  private getDefaultTitle(): string {
    if (this.type === 'file') {
      return path.basename(decodeURI(this.url))
    } else if (this.type === 'text') {
      return 'Text'
    } else {
      return this.url
    }
  }

  hasChanged(): boolean {
    
    // only files
    if (this.type !== 'file') {
      return false
    }

    // check for deletion
    if (!fs.existsSync(this.origin)) {
      return true
    }

    // else compare stats
    try {
      const stats = fs.statSync(this.origin)
      const currentModified = stats.mtime.getTime()
      const currentSize = stats.size
      return this.lastModified !== currentModified || this.fileSize !== currentSize
    } catch {
      return false
    }
  }

  exists(): boolean {
    
    if (this.type !== 'file' && this.type !== 'folder') {
      return true
    }

    try {
      return fs.existsSync(this.origin)
    } catch {
      return false
    }
  }

}
