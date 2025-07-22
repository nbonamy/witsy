import { App } from 'electron'
import { GoogleGenAI } from '@google/genai'
import * as config from './config'
import path from 'node:path'
import { promises as fs } from 'node:fs'

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

    // Monitor file download completion
    const waitForDownload = async (): Promise<void> => {
      const inactivityTimeout = 5000 // 5 seconds of inactivity
      const stabilityTime = 2000 // 2 seconds of stable size
      const checkInterval = 200 // Check every 200ms
      
      let lastSize = -1
      let lastStableTime = 0
      let lastActivityTime = Date.now()
      
      while (true) {
        try {
          const stats = await fs.stat(targetPath)
          const currentSize = stats.size
          
          // File must exist and have content
          if (currentSize > 0) {
            // Check if size changed (activity detected)
            if (currentSize !== lastSize) {
              lastSize = currentSize
              lastStableTime = 0
              lastActivityTime = Date.now() // Reset inactivity timer
            } else {
              // Size is stable, check how long it's been stable
              if (lastStableTime === 0) {
                lastStableTime = Date.now()
              } else if (Date.now() - lastStableTime >= stabilityTime) {
                // Size has been stable for required time
                return
              }
            }
          }
        } catch {
          // File doesn't exist yet, reset activity timer
          lastActivityTime = Date.now()
        }
        
        // Check for inactivity timeout
        if (Date.now() - lastActivityTime >= inactivityTimeout) {
          throw new Error('Download timeout: no activity detected for 5 seconds')
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }
    }

    await waitForDownload()

    // done
    return `file://${targetPath}`

  } catch (error) {
    
    console.error('Error downloading media from Google:', error)
    return null
  
  }
}
