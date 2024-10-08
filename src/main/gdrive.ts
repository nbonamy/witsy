
import { OnlineFileMetadata, OnlineStorageProvider, anyDict } from 'types'
import { App } from 'electron'
import { google } from 'googleapis'
import portfinder from 'portfinder'
import * as config from './config'
import path from 'path'
import http from 'http'
import url from 'url'
import fs from 'fs'

export default class implements OnlineStorageProvider {

  app: App
  credentials: any
  oauth2Client: any
  gdrive: any

  timers: { [key: string]: NodeJS.Timeout }

  constructor(app: App) {
    this.app = app
    this.credentials = null
    this.timers = null
  }

  isSetup(): boolean {

    // load credentials
    const assetsFolder = process.env.DEBUG ? path.resolve('./') : process.resourcesPath
    const credentialsFile = path.join(assetsFolder, 'gdrive.json')
    if (fs.existsSync(credentialsFile)) {
      console.log('Gdrive credentials found')
      this.credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'))
    }

    // all we need
    return this.credentials !== null && !!this.getTokens()
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
      this.credentials.installed.client_id,
      this.credentials.installed.client_secret,
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

    // init service
    this.gdrive = google.drive({ version: 'v3', auth: this.oauth2Client })

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

  async metadata(filepath: string): Promise<OnlineFileMetadata> {

    try {

      // needed
      const filename = path.basename(filepath)
      const settings = config.loadSettings(this.app)

      // get the file
      const res = await this.gdrive.files.list({
        spaces: 'appDataFolder',
        q: `name = '${filename}'`,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
        pageSize: 1,
      });

      // get the file
      const file = res.data.files[0]
      if (!file) {
        return null
      }

      // save the fileId if needed
      if (settings.gdrive.fileIds[filename] !== file.id) {
        settings.gdrive.fileIds[filename] = file.id
        config.saveSettings(this.app, settings)
      }

      // done
      return {
        id: file.id,
        size: parseInt(file.size),
        createdTime: new Date(file.createdTime),
        modifiedTime: new Date(file.modifiedTime),
      }

    } catch (error) {
      console.error('Error getting file metadata from Gdrive:', error)
      return null
    }

  }

  async download(filePath: string): Promise<string> {
    
    // needed
    const filename = path.basename(filePath)
    const settings = config.loadSettings(this.app)

    // we need a fileId
    const fileId = settings.gdrive.fileIds[filename]
    if (!fileId) {
      console.error('File does not exist in Gdrive:', filename)
      return null
    }

    // get it
    const file = await this.gdrive.files.get({
      fileId: fileId,
      alt: 'media',
    });

    // it needs to be ok
    if (file.status != 200) {
      console.error('Error downloading file from Gdrive:', file)
      return null
    }

    // get what we need
    return file.data

  }

  async upload(filePath: string, modifiedTime: Date): Promise<boolean> {

    // needed
    const filename = path.basename(filePath)
    const settings = config.loadSettings(this.app)

    // check if we have already uploaded this file
    const fileId = settings.gdrive.fileIds[filename]
    if (fileId) {
      return await this.update(fileId, filePath, modifiedTime)
    } else {
      return await this.create(filePath, modifiedTime)
    }

  }

  private async create(filePath: string, modifiedTime: Date): Promise<boolean> {

    try {

      // needed
      const filename = path.basename(filePath)
      const settings = config.loadSettings(this.app)

      // metadata
      const fileMetadata = {
        name: filename,
        modifiedTime: modifiedTime.toISOString(),
        parents: ['appDataFolder'],
      }
      
      // content
      const media = {
        mimeType: 'application/json',
        body: fs.createReadStream(filePath),
      }

      // create
      const file = await this.gdrive.files.create({
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

  private async update(fileId: string, filePath: string, modifiedTime: Date): Promise<boolean> {

    try {

      // metadata
      const fileMetadata = {
        modifiedTime: modifiedTime.toISOString(),
      }

      // content
      const media = {
        mimeType: 'application/json',
        body: fs.createReadStream(filePath),
      }

      // update
      await this.gdrive.files.update({
        requestBody: fileMetadata,
        fileId: fileId,
        media: media,
      });

      // done
      return true

    } catch (err: unknown) {

      // our file id may be obsolete
      if (err instanceof Error && err.message.includes('File not found')) {
        console.warn('File not found in Gdrive, creating it instead:', err.message)
        return await this.create(filePath, modifiedTime)
      }

      // error
      console.error('Error creating file in Gdrive:', err);
      return false
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

}
