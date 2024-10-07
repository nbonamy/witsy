
import { OnlineStorageProvider, anyDict } from 'types'
import { App } from 'electron'
import { google } from 'googleapis'
import portfinder from 'portfinder'
import * as config from './config'
import creds from '../../gdrive.json'
import path from 'path'
import http from 'http'
import url from 'url'
import fs from 'fs'

export default class implements OnlineStorageProvider {

  app: App
  oauth2Client: any
  timers: { [key: string]: NodeJS.Timeout }

  constructor(app: App) {
    this.app = app
    this.timers = null
  }

  isSetup(): boolean {
    return !!this.getTokens()
  }

  async initialize(): Promise<void> {

    // we may need a server and a port
    let port = 8000

    // check if we already have tokens
    const tokens = await this.getTokens()
    if (!tokens) {
    
      // find a port and listen
      port = await portfinder.getPortPromise()
      http.createServer(async (req, res) => {

        const queryObject = url.parse(req.url, true).query
        const code = queryObject.code as string
        const { tokens } = await this.oauth2Client.getToken(code)
        this.oauth2Client.setCredentials(tokens)
        this.saveTokens(tokens)
        res.end('Authentication successful! You can close this tab now.')
      
      }).listen(port)

    }

    // now create the OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      creds.installed.client_id,
      creds.installed.client_secret,
      `http://localhost:${port}`
    )

    // callback when tokens are refreshed
    this.oauth2Client.on('tokens', (tokens: anyDict) => {
      this.saveTokens(tokens)
    });

    // set the tokens
    if (tokens) {
      this.oauth2Client.setCredentials(tokens)
    }
    
  }

  getOAuthUrl(): string {

    try {
      
      const scopes = [
        'https://www.googleapis.com/auth/drive.appdata',
      ]
      
      return this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
      })

    } catch (error) {
      console.error('Error getting authentication URL:', error)
      throw error
    }

  }

  private saveTokens(tokens: any): void {
    const settings = config.loadSettings(this.app)
    tokens = {...settings.gdrive.tokens ?? {}, ...tokens}
    settings.gdrive.tokens = tokens
    config.saveSettings(this.app, settings)
  }

  private getTokens(): anyDict {
    const settings = config.loadSettings(this.app)
    const tokens = settings.gdrive.tokens
    return tokens
  }

  async getMetadata(filepath: string): Promise<any> {

    try {

      // needed
      const filename = path.basename(filepath)
      const settings = config.loadSettings(this.app)
      const service = google.drive({ version: 'v3', auth: this.oauth2Client })

      // we need a fileId
      const fileId = settings.gdrive.fileIds[filename]
      if (!fileId) {
        console.error('File does not exist in Gdrive:', filename)
        return null
      }

      // get the file
      const res = await service.files.list({
        spaces: 'appDataFolder',
        q: `fileId = '${fileId}'`,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
        pageSize: 1,
      });

      // get the file
      const file = res.data.files[0]
      if (!file) {
        return null
      }

      // done
      return file

    } catch (error) {
      console.error('Error getting file metadata from Gdrive:', error)
      return null
    }

  }

  monitor(filepath: string): void {

    // do not monitor more than once
    const timer = this.timers[filepath]
    if (timer) {
      return
    }

    // create the timer
    this.timers[filepath] = setInterval(() => {
      this.downloadIfNeeded(filepath)
    }, 1000*60*5)
  }

  async downloadIfNeeded(filepath: string): Promise<boolean> {
  
    try {

      // do we need to download
      let needDownload = false

      // check if it exists
      const existsLocal = fs.existsSync(filepath)
      const metadata = await this.getMetadata(filepath)

      // if it does not exist remotely then...
      if (!metadata) {
        return false
      }

      if (!existsLocal) {
        needDownload = true
      } else {

        // get the local stats
        const local = await fs.promises.stat(filepath)

        // needed
        const remoteSize = metadata.size
        const remoteModifiedTime = new Date(metadata.modifiedTime)

        // we need to compare
        const localSize = local.size
        const localModifiedTime = local.mtime

        // console.log('localSize = ', localSize)
        // console.log('remoteSize = ', remoteSize)
        // console.log('localModifiedTime = ', localModifiedTime)
        // console.log('remoteModifiedTime = ', remoteModifiedTime)

        needDownload = localSize !== remoteSize || localModifiedTime.getTime() !== remoteModifiedTime.getTime()
        //console.log('Dropbox metadata comparison implies download = ', needDownload)
      }

      // exit if no need to download
      if (!needDownload) {
        return false
      }

      // download
      const content = await this.download(metadata.id)

      // wite
      fs.promises.writeFile(filepath, content)
      return true

    } catch (error) {
      console.error(`Error downloading ${filepath} from Dropbox:`, error)
      return false
    }

  }

  async download(filePath: string): Promise<any> {
    
    // needed
    const filename = path.basename(filePath)
    const settings = config.loadSettings(this.app)
    const service = google.drive({ version: 'v3', auth: this.oauth2Client })

    // we need a fileId
    const fileId = settings.gdrive.fileIds[filename]
    if (!fileId) {
      console.error('File does not exist in Gdrive:', filename)
      return null
    }

    // get it
    const file = await service.files.get({
      fileId: fileId,
      alt: 'media',
    });

    // it needs to be ok
    if (file.status != 200) {
      console.error('Error downloading file from Gdrive:', file)
      return null
    }

    // get what we need
    const contents = file.data

    console.log(file);

    // const res = await service.files.list({
    //   spaces: 'appDataFolder',
    //   fields: 'nextPageToken, files(id, name, headRevisionId, size, modifiedTime)',
    //   pageSize: 100,
    // });
    // res.data.files.forEach(async function(file) {
    //   console.log('Found file:', file.name, file.id, file.headRevisionId, file.size, file.modifiedTime);
    //   await service.files.delete({
    //     fileId: file.id
    //   })
    // });

  }

  async upload(filePath: string): Promise<boolean> {

    // needed
    const filename = path.basename(filePath)
    const settings = config.loadSettings(this.app)

    // check if we have already uploaded this file
    const fileId = settings.gdrive.fileIds[filename]
    if (fileId) {
      return await this.update(fileId, filePath)
    } else {
      return await this.create(filePath)
    }

  }

  async create(filePath: string): Promise<boolean> {

    try {

      // needed
      const filename = path.basename(filePath)
      const settings = config.loadSettings(this.app)
      const service = google.drive({ version: 'v3', auth: this.oauth2Client })

      // metadata
      const fileMetadata = {
        name: filename,
        parents: ['appDataFolder'],
      }
      
      // content
      const media = {
        mimeType: 'application/json',
        body: fs.createReadStream(filePath),
      }

      // create
      const file = await service.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
      });

      // record
      const fileId = file.data.id
      settings.gdrive.fileIds[filename] = fileId
      config.saveSettings(this.app, settings)

      // done
      return true

    } catch (err) {
      console.error('Error creating file in Gdrive:', err);
      return false
    }

  }

  async update(fileId: string, filePath: string): Promise<boolean> {

    try {

      // needed
      const service = google.drive({ version: 'v3', auth: this.oauth2Client })

      // content
      const media = {
        mimeType: 'application/json',
        body: fs.createReadStream(filePath),
      }

      // update
      await service.files.update({
        fileId: fileId,
        media: media,
      });

      // done
      return true

    } catch (err: unknown) {

      // our file id may be obsolete
      if (err instanceof Error && err.message.includes('File not found')) {
        console.warn('File not found in Gdrive, creating it instead:', err.message)
        return await this.create(filePath)
      }

      // error
      console.error('Error creating file in Gdrive:', err);
      return false
    }

  }

}
