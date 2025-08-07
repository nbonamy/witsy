
export type SourceType = 'file'|'folder'|'url'|'text'

export type DocumentSource = {
  uuid: string
  type: SourceType
  title: string
  origin: string
  filename: string
  url: string
  items?: DocumentSource[]
}

export type DocumentMetadata = {
  uuid: string,
  type: SourceType,
  title: string,
  url: string
}

export type DocumentBase = {
  uuid: string
  name: string
  embeddingEngine: string
  embeddingModel: string
  documents: DocumentSource[]
}

export type DocRepoQueryResponseItem = {
  content: string
  score: number
  metadata: DocumentSource
}

export type DocRepoQueryResponse = {
  items: DocRepoQueryResponseItem[]
}

export interface DocumentQueueItem {
  uuid: string
  baseId: string
  type: SourceType
  origin: string
  isChild?: boolean
}

export type DocRepoAddDocResponse = {
  queueItem: DocumentQueueItem
  queueLength: number
  error?: string
}

export interface DocRepoListener {
  onDocumentSourceAdded(baseId: string, sourceId: string, type: SourceType, origin: string): void
  onDocumentSourceRemoved(baseId: string, sourceId: string, origin: string): void
}
