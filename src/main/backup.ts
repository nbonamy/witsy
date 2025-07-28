import { App, dialog } from 'electron'
import { useI18n } from '../main/i18n'
import { settingsFilePath } from './config'
import { historyFilePath } from './history'
import { expertsFilePath } from './experts'
import { commandsFilePath } from './commands'
import * as file from './file'
import archiver from 'archiver'
import extractZip from 'extract-zip'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// files to backup with their respective paths
const filesToBackup = (app: App) => ([
  { name: 'settings.json', path: settingsFilePath(app) },
  { name: 'history.json', path: historyFilePath(app) },
  { name: 'experts.json', path: expertsFilePath(app) },
  { name: 'commands.json', path: commandsFilePath(app) }
])

// Folders to backup with their respective paths
const foldersToBackup = (app: App) => ([
  { name: 'agents', path: path.join(app.getPath('userData'), 'agents') },
  { name: 'engines', path: path.join(app.getPath('userData'), 'engines') },
  { name: 'images', path: path.join(app.getPath('userData'), 'images') }
])

export const exportBackup = async (app: App): Promise<boolean> => {
  try {
    // Pick a directory to save the backup
    const targetDir = file.pickDirectory(app)
    if (!targetDir) {
      return false
    }

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const backupFilename = `witsy-backup-${timestamp}.zip`
    const backupPath = path.join(targetDir, backupFilename)

    // Create a file to stream archive data to
    const output = fs.createWriteStream(backupPath)
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    })

    // Good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Backup warning:', err)
      } else {
        throw err
      }
    })

    // Good practice to catch this error explicitly
    archive.on('error', (err) => {
      throw err
    })

    // Pipe archive data to the file
    archive.pipe(output)

    // Add individual files
    for (const fileInfo of filesToBackup(app)) {
      if (fs.existsSync(fileInfo.path)) {
        archive.file(fileInfo.path, { name: fileInfo.name })
      }
    }

    // Add folders if they exist
    for (const folder of foldersToBackup(app)) {
      if (fs.existsSync(folder.path)) {
        archive.directory(folder.path, folder.name)
      }
    }

    // Wait for stream to close
    return await new Promise<boolean>((resolve) => {
      output.on('close', () => {
        console.log(`Backup created: ${backupPath} (${archive.pointer()} bytes)`)
        resolve(true)
      })

      output.on('error', (err) => {
        console.error('Error creating backup:', err)
        resolve(false)
      })

      // Finalize the archive
      archive.finalize()
    })

  } catch (error) {
    console.error('Error during backup export:', error)
    return false
  }
}

export const importBackup = async (app: App, quitApp: () => void): Promise<boolean> => {

  const t = useI18n(app)

  try {

    // Show confirmation dialog
    const response = await dialog.showMessageBox({
      type: 'warning',
      title: t('backup.restore.confirm.title'),
      message: t('backup.restore.confirm.message'),
      detail: t('backup.restore.confirm.detail'),
      buttons: [t('common.cancel'), t('backup.restore.confirm.restore')],
      defaultId: 0,
      cancelId: 0
    })

    // If user cancelled
    if (response.response === 0) {
      return false
    }

    // Pick the backup file
    const backupFile = file.pickFile(app, { 
      location: true, 
      filters: [{ name: t('backup.restore.files'), extensions: ['zip'] }] 
    })
    
    if (!backupFile) {
      return false
    }

    // Create temporary directory for extraction
    const tempDir = path.join(os.tmpdir(), `witsy-restore-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      // Extract the ZIP file
      await extractZip(backupFile as string, { dir: tempDir })

      // Get target file paths
      const targetFiles = filesToBackup(app).map(fileInfo => ({
        source: path.join(tempDir, fileInfo.name),
        target: fileInfo.path,
      }))

      // Restore individual files
      for (const fileInfo of targetFiles) {
        if (fs.existsSync(fileInfo.source)) {
          fs.copyFileSync(fileInfo.source, fileInfo.target)
          console.log(`Restored: ${fileInfo.target}`)
        }
      }

      const targetFolders = foldersToBackup(app).map(folderInfo => ({
        source: path.join(tempDir, folderInfo.name),
        target: folderInfo.path,
      }))

      // Restore folders if they exist
      for (const folderInfo of targetFolders) {
        const { source, target } = folderInfo
        if (fs.existsSync(source)) {
          fs.mkdirSync(target, { recursive: true })
          copyDirectoryRecursive(source, target)
          console.log(`Restored folder: ${target}`)
        }
      }

      // Show success message
      await dialog.showMessageBox({
        type: 'info',
        title: t('backup.restore.restart.title'),
        message: t('backup.restore.restart.message'),
        detail: t('backup.restore.restart.detail'),
        buttons: [t('common.ok')]
      })

      console.log('Backup restoration completed successfully')
      
      // Restart the application if quitApp function is provided
      try {
        app.relaunch()
        quitApp()
      } catch (restartError) {
        console.error('Error restarting app:', restartError)
      }
      
      return true

    } finally {
      // Clean up temporary directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn('Error cleaning up temp directory:', cleanupError)
      }
    }

  } catch (error) {
    console.error('Error during backup import:', error)
    
    // Show error message
    await dialog.showMessageBox({
      type: 'error',
      title: t('backup.restore.error.title'),
      message: t('backup.restore.error.message'),
      detail: t('backup.restore.error.detail', { error: error instanceof Error ? error.message : String(error) }),
      buttons: ['OK']
    })
    
    return false
  }
}

// Helper function to copy directory recursively
const copyDirectoryRecursive = (src: string, dest: string) => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}