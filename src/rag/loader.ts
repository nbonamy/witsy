
import { Configuration } from '../types/config.d'
import { SourceType } from '../types/rag.d'
import { extensionToMimeType } from '../main/mimetype'
import { getPDFRawTextContent, getOfficeRawTextContent } from '../main/text'
import fs from 'fs'

export default class {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  load(type: SourceType, url: string): Promise<string> {
  
    switch (type) {
      case 'file':
        return this.loadFile(url)
      case 'folder':
        return this.loadFolder(url)
      case 'url':
        return this.loadUrl(url)
    }

  }

  async loadUrl(url: string): Promise<string> {
    const response = await fetch(url)
    return response.text()
  }

  async loadFile(url: string): Promise<string> {

    try {

      const extension = url.split('.').pop()
      const mimeType = extensionToMimeType(extension)
      switch (mimeType) {

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          return await getOfficeRawTextContent(fs.readFileSync(url))
        
        case 'application/pdf':
          return await getPDFRawTextContent(fs.readFileSync(url))
        
        case 'application/octet-stream':
          return null

        default:
          return fs.readFileSync(url, 'utf8')

      }

    } catch (error) {
      console.error('Error loading file:', error)
    }
  }

  async loadFolder(url: string): Promise<string> {
    const response = await fetch(url)
    return response.text()
  }

}