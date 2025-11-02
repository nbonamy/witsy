
export type DirectoryItem = {
    name: string
    fullPath: string
    isDirectory: boolean
    size?: number
  }

export type ListDirectorySuccess = {
  success: true
  items: DirectoryItem[]
}

export type ReadFileSuccess = {
  success: true
  path: string
  contents: string
}

export type WriteFileSuccess = {
  success: true
  path: string
}

export type DeleteFileSuccess = {
  success: true
  path: string
}

export type FindFilesSuccess = {
  success: true
  files: string[]
  count: number
  truncated: boolean
}

export type FilesystemError = {
  success: false
  error: string
}

export type ListDirectoryResponse = ListDirectorySuccess | FilesystemError
export type ReadFileResponse = ReadFileSuccess | FilesystemError
export type WriteFileResponse = WriteFileSuccess | FilesystemError
export type DeleteFileResponse = DeleteFileSuccess | FilesystemError
export type FindFilesResponse = FindFilesSuccess | FilesystemError
