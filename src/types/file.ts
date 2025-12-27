
export type FileContents = {
  url: string
  mimeType: string
  contents: string
}

export type AppDirectory = 'home' | 'appData' | 'userData' | 'sessionData' | 'temp' | 'documents' | 'downloads'

export type FileProperties = {
  directory?: AppDirectory
  prompt?: boolean
  subdir?: string | false
  filename?: string
  workspace?: string
}

export type FileSaveParams = {
  contents: string
  url?: string
  properties?: FileProperties
}

export type FileDownloadParams = {
  url: string
  properties?: FileProperties
}

export type FilePickParams = {
  packages?: boolean
  location?: boolean
  multiselection?: boolean
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

export type FileStats = {
  size: number
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
  modifiedAt: number
  createdAt: number
}
