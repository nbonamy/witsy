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

export const exportBackup = async (app: App): Promise<boolean> => {
  try {
    // Pick a directory to save the backup
    const targetDir = file.pickDirectory(app)
    if (!targetDir) {
      return false
    }

    // Get userData path
    const userDataPath = app.getPath('userData')
    
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

    // Files to backup with their respective path functions
    const filesToBackup = [
      { path: settingsFilePath(app), name: 'settings.json' },
      { path: historyFilePath(app), name: 'history.json' },
      { path: expertsFilePath(app), name: 'experts.json' },
      { path: commandsFilePath(app), name: 'commands.json' }
    ]

    // Add individual files
    for (const fileInfo of filesToBackup) {
      if (fs.existsSync(fileInfo.path)) {
        archive.file(fileInfo.path, { name: fileInfo.name })
      }
    }

    // Add images folder if it exists
    const imagesPath = path.join(userDataPath, 'images')
    if (fs.existsSync(imagesPath)) {
      archive.directory(imagesPath, 'images')
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
      const targetFiles = [
        { source: path.join(tempDir, 'settings.json'), target: settingsFilePath(app) },
        { source: path.join(tempDir, 'history.json'), target: historyFilePath(app) },
        { source: path.join(tempDir, 'experts.json'), target: expertsFilePath(app) },
        { source: path.join(tempDir, 'commands.json'), target: commandsFilePath(app) }
      ]

      // Restore individual files
      for (const fileInfo of targetFiles) {
        if (fs.existsSync(fileInfo.source)) {
          // Create backup of current file before overwriting
          if (fs.existsSync(fileInfo.target)) {
            const backupPath = `${fileInfo.target}.backup-${Date.now()}`
            fs.copyFileSync(fileInfo.target, backupPath)
            console.log(`Backed up existing file: ${backupPath}`)
          }

          // Copy the restored file
          fs.copyFileSync(fileInfo.source, fileInfo.target)
          console.log(`Restored: ${fileInfo.target}`)
        }
      }

      // Restore images folder if it exists
      const sourceImagesPath = path.join(tempDir, 'images')
      const targetImagesPath = path.join(app.getPath('userData'), 'images')
      
      if (fs.existsSync(sourceImagesPath)) {
        // Create backup of existing images folder
        if (fs.existsSync(targetImagesPath)) {
          const backupImagesPath = `${targetImagesPath}.backup-${Date.now()}`
          fs.renameSync(targetImagesPath, backupImagesPath)
          console.log(`Backed up existing images folder: ${backupImagesPath}`)
        }

        // Copy the restored images folder
        fs.mkdirSync(targetImagesPath, { recursive: true })
        copyDirectoryRecursive(sourceImagesPath, targetImagesPath)
        console.log(`Restored images folder: ${targetImagesPath}`)
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