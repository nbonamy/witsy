
export type SourceType = 'file'|'folder'|'url'|'sitemap'|'text'

// export type DocumentSourceBase = {
//   uuid: string
//   title: string
//   origin: string
// }

// export type DocumentSourceFile = DocumentSourceBase & {
//   type: 'file'
//   lastModified: number
//   fileSize: number
// }

// export type DocumentSourceFolder = DocumentSourceBase & {
//   type: 'folder'
//   items: (DocumentSourceFile|DocumentSourceFolder)[]
// }

// export type DocumentSourceUrl = DocumentSourceBase & {
//   type: 'url'
//   url: string
// }

// export type DocumentSourceText = DocumentSourceBase & {
//   type: 'text'
//   text: string
// }

// export type DocumentSource =  DocumentSourceFile | DocumentSourceFolder | DocumentSourceUrl | DocumentSourceText

export type DocumentSource = {
  uuid: string
  type: SourceType
  title: string
  origin: string
  filename: string
  url: string
  lastModified: number
  fileSize: number
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
  workspaceId: string
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
  title?: string
  parentDocId?: string
  operation: 'add' | 'update' | 'delete'
  fromUserAction: boolean
}

export type DocRepoAddDocResponse = {
  queueItem: DocumentQueueItem
  queueLength: number
  error?: string
}

export interface DocRepoListener {
  onDocumentSourceAdded(source: DocumentSource): void
  onDocumentSourceRemoved(origin: string): void
}
