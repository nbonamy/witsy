
export type SourceType = 'file'|'folder'|'url'|'text'

export interface DocumentSource {
  uuid: string
  type: SourceType
  title: string
  origin: string
  filename: string
  url: string
  items?: DocumentSource[]
}

export interface DocumentBase {
  uuid: string
  name: string
  embeddingEngine: string
  embeddingModel: string
  documents: DocumentSource[]
}

export interface DocRepoQueryResponseItem {
  content: string
  score: number
  metadata: DocumentSource
}

export interface DocRepoQueryResponse {
  items: DocRepoQueryResponseItem[]
}

export interface DocRepoAddDocResponse {
  queueItem: DocumentQueueItem
  queueLength: number
  error?: string
}
