
import { App } from 'electron'
import { GoogleGenAI } from '@google/genai'
import * as config from './config'
import path from 'node:path'

export const downloadMedia = async (app: App, url: string, mimeType: string): Promise<string> => {
  try {

    // we need a configuration
    const settings = config.loadSettings(app)

    // destination
    const targetDirectory = path.join(app.getPath('userData'), 'images')
    const targetFilename = crypto.randomUUID() + '.' + mimeType.split('/')[1]
    const targetPath = path.join(targetDirectory, targetFilename)

    // build google client
    const client = new GoogleGenAI({ apiKey: settings.engines.google.apiKey })
    await client.files.download({ file: url, downloadPath: targetPath, })

    // done
    return `file://${targetPath}`

  } catch (error) {
    
    console.error('Error downloading media from Google:', error)
    return null
  
  }
}
