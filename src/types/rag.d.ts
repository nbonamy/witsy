
export type SourceType = 'file'|'folder'|'url'

export interface DocumentSource {
  uuid: string
  type: SourceType
  title: string
  origin: string
  filename: string
  url: string
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
