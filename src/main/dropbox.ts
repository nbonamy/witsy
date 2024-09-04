// import { App } from 'electron'
// import { Dropbox, DropboxAuth } from 'dropbox'
// import * as config from './config'
// import fs from 'fs'

// const DROPBOX_CLIENT_ID = ''
// const DROPBOX_CLIENT_SECRET = ''

// export default class {

//   app: App
//   localPath: string
//   remotePath: string
//   timer: NodeJS.Timeout

//   constructor(app: App, localPath: string, remotePath: string) {
//     this.app = app
//     this.localPath = localPath
//     this.remotePath = remotePath
//     this.timer = null
//   }

//   async getOAuthUrl(): Promise<string> {

//     try {
      
//       const dbxAuth = new DropboxAuth({
//         clientId: DROPBOX_CLIENT_ID,
//         clientSecret: DROPBOX_CLIENT_SECRET
//       })

//       return await dbxAuth.getAuthenticationUrl('', 'state', 'code', 'legacy', [
//         'files.metadata.read',
//         'files.content.read', 'files.content.write'
//       ], 'user', false) as string
    
//     } catch (error) {
//       console.error('Error getting authentication URL:', error)
//       throw error
//     }

//   }

//   async saveAccessToken(dbxAuth: DropboxAuth): Promise<void> {

//     const settings = config.loadSettings(this.app)
//     settings.dropbox.accessToken = dbxAuth.getAccessToken()
//     //settings.dropbox.accessTokenExpiresAt = dbxAuth.getAccessTokenExpiresAt()
//     //settings.dropbox.refreshToken = dbxAuth.getRefreshToken()
//     config.saveSettings(this.app, settings)

//   }

//   async getAccessTokenFromCode(code: string): Promise<string> {

//     try {

//       const dbxAuth = new DropboxAuth({
//         clientId: DROPBOX_CLIENT_ID,
//         clientSecret: DROPBOX_CLIENT_SECRET
//       })
    
//       // log
//       console.log('Getting access token from code', code)

//       // do it
//       const response = await dbxAuth.getAccessTokenFromCode('', code)
//       //console.log(response)
//       const result = response.result as { access_token: string }//; expires_in: number; refresh_token: string }
//       const accessToken = result.access_token
//       // const expiresIn = result.expires_in
//       // const expiresAt = new Date().getTime() + expiresIn * 1000
//       // const refreshToken = result.refresh_token
//       dbxAuth.setAccessToken(accessToken)
//       // dbxAuth.setAccessTokenExpiresAt(new Date(expiresAt))
//       // dbxAuth.setRefreshToken(refreshToken)
//       this.saveAccessToken(dbxAuth)

//       return accessToken
    
//     } catch (error) {
//       console.error('Error getting access token:', error)
//     }

//     // too bad
//     return null
//   }

//   async getAccessToken(): Promise<string> {

//     const settings = config.loadSettings(this.app)
//     const accessToken = settings.dropbox.accessToken
//     // const accessTokenExpiresAt = settings.dropbox.accessTokenExpiresAt
//     // const refreshToken = settings.dropbox.refreshToken

//     // if we already have an access token, check it and return it
//     if (accessToken) {// && accessTokenExpiresAt && accessTokenExpiresAt) {

//       try {

//         const dbxAuth = new DropboxAuth({
//           clientId: DROPBOX_CLIENT_ID,
//           clientSecret: DROPBOX_CLIENT_SECRET,
//           accessToken: accessToken,
//           // accessTokenExpiresAt: accessTokenExpiresAt,
//           // refreshToken: refreshToken
//         })

//         // log
//         //console.log('Checking Dropbox access token')

//         // do it
//         // await dbxAuth.checkAndRefreshAccessToken()
//         // this.saveAccessToken(dbxAuth)
//         return dbxAuth.getAccessToken()

//       } catch (error) {
//         console.error('Error checking Dropbox access token:', error)
//       }

//     }

//     // too bad
//     return null

//   }

//   async getMetadata(): Promise<any> {

//     try {
    
//       const accessToken = await this.getAccessToken()
//       if (!accessToken) return

//       const dbx = new Dropbox({ accessToken: accessToken })

//       const response = await dbx.filesGetMetadata({ path: this.remotePath })
//       return response.result
    
//     } catch (error) {
//       console.error(`Error getting Dropbox metadata for ${this.remotePath}:`, error)
//     }

//     return null

//   }

//   async monitor(): Promise<void> {
//     if (this.timer) return
//     this.timer = setInterval(() => {
//       this.downloadIfNeeded()
//     }, 1000*60*5)
//   }

//   async downloadIfNeeded(): Promise<boolean> {
  
//     try {
      
//       // first check if dropbox has the file
//       const dropboxMetadata = await this.getMetadata()
//       if (!dropboxMetadata) {
//         //console.log('Dropbox metadata not found')
//         return false
//       }

//       // needed
//       const remoteSize = dropboxMetadata.size
//       const remoteModifiedTime = new Date(dropboxMetadata.client_modified)

//       // check if we need to download the file
//       let needDownload = false
      
//       // if file does not exist, we need to download it
//       if (!fs.existsSync(this.localPath)) {
//         needDownload = true
//       } else {
//         // we need to compare
//         const localStats = fs.statSync(this.localPath)
//         const localSize = localStats.size
//         const localModifiedTime = localStats.mtime

//         // console.log('localSize = ', localSize)
//         // console.log('remoteSize = ', remoteSize)
//         // console.log('localModifiedTime = ', localModifiedTime)
//         // console.log('remoteModifiedTime = ', remoteModifiedTime)

//         needDownload = localSize !== remoteSize || localModifiedTime.getTime() !== remoteModifiedTime.getTime()
//         //console.log('Dropbox metadata comparison implies download = ', needDownload)
//       }

//       // exit if no need to download
//       if (!needDownload) {
//         return false
//       }

//       // do it
//       await this.download(remoteModifiedTime)
//       return true

//     } catch (error) {
//       console.error(`Error downloading ${this.remotePath} from Dropbox:`, error)
//       return false
//     }

//   }

//   async download(modifiedTime: fs.TimeLike|null): Promise<void> {
    
//     const accessToken = await this.getAccessToken()
//     if (!accessToken) return

//     const dbx = new Dropbox({ accessToken: accessToken })

//     // download
//     const response = await dbx.filesDownload({ path: this.remotePath })
//     const fileContent = (response.result as any).fileBinary

//     // write and set time
//     fs.writeFileSync(this.localPath, fileContent)
//     if (modifiedTime) {
//       fs.utimesSync(this.localPath, modifiedTime, modifiedTime)
//     }

//     // done
//     console.log(`Downloaded ${this.remotePath} from Dropbox`)

//   }

//   async upload(): Promise<void> {

//     const accessToken = await this.getAccessToken()
//     if (!accessToken) return

//     const dbx = new Dropbox({ accessToken: accessToken })

//     // read
//     const fileContent = fs.readFileSync(this.localPath, 'utf8')

//     // upload
//     await dbx.filesUpload({
//       path: this.remotePath,
//       contents: fileContent,
//       mode: { '.tag': 'overwrite' },
//     })

//     // sync modified time
//     const dropboxMetadata = await this.getMetadata()
//     const modifiedTime = new Date(dropboxMetadata.client_modified)
//     fs.utimesSync(this.localPath, modifiedTime, modifiedTime)

//     // done
//     console.log(`Uploaded ${this.remotePath} to Dropbox`)

//   }

// }
