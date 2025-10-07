import { execSync } from 'child_process'
import { app, dialog } from 'electron'
import log from 'electron-log/main'
import fs from 'fs'
import path from 'path'
import { useI18n } from '../main/i18n'
import * as config from './config'

function isSymlinkValid(symlinkPath: string, expectedTarget: string): boolean {
  try {
    // Check if symlink exists (use lstat to check the symlink itself, not its target)
    const stats = fs.lstatSync(symlinkPath)
    if (!stats.isSymbolicLink() && !stats.isFile()) {
      return false
    }

    // Check if it points to the correct target
    const linkTarget = fs.readlinkSync(symlinkPath)
    const resolvedTarget = path.resolve(path.dirname(symlinkPath), linkTarget)
    const resolvedSource = path.resolve(expectedTarget)

    return resolvedTarget === resolvedSource
  } catch {
    // Symlink doesn't exist or error reading it
    return false
  }
}

async function installCLI(fallbackMethod: boolean): Promise<boolean> {
  if (process.platform === 'darwin') {
    return await installMacOSCLI(fallbackMethod)
  } else if (process.platform === 'win32') {
    return await installWindowsCLI()
  } else if (process.platform === 'linux') {
    return await installLinuxCLI(fallbackMethod)
  }
}

export async function checkAndInstallCLI(fallbackMethod: boolean): Promise<void> {

  // Check if previous installation failed - if so, skip
  const cfg = config.loadSettings(app)
  if (cfg.general.cliInstallError) {
    return
  }

  await installCLI(fallbackMethod)
}

export async function retryInstallCLI(): Promise<{ success: boolean }> {
  try {
    // Reset error flag
    const cfg = config.loadSettings(app)
    cfg.general.cliInstallError = false
    config.saveSettings(app, cfg)

    // Attempt installation
    return {
      success: await installCLI(true)
    }

  } catch (error) {
    log.error('Error in retryInstallCLI:', error)
    return { success: false }
  }
}

async function installMacOSCLI(fallbackMethod: boolean): Promise<boolean> {
  
  const appPath = app.getAppPath()
  const resourcesPath = path.join(appPath, '..', '..', 'Resources')
  const sourcePath = path.join(resourcesPath, 'cli', 'bin', 'witsy')

  const elevatedInstall = (sourcePath: string, symlinkPath: string) => {

    const script = `
      if [ ! -d "/usr/local/bin" ]; then
        mkdir -p /usr/local/bin
      fi
      ln -sf "${sourcePath}" "${symlinkPath}"
      chmod +x "${sourcePath}"
    `
    execSync(`osascript -e 'do shell script "${script.replace(/"/g, '\\"')}" with administrator privileges'`)
  }

  return await installUnixCLI(sourcePath, fallbackMethod ? elevatedInstall : undefined)
}

async function installLinuxCLI(fallbackMethod: boolean): Promise<boolean> {
  const appPath = app.getPath('exe')
  const appDir = path.dirname(appPath)
  const sourcePath = path.join(appDir, 'resources', 'cli', 'bin', 'witsy')

  const elevatedInstall = (sourcePath: string, symlinkPath: string) => {

    const script = `
      mkdir -p /usr/local/bin
      ln -sf "${sourcePath}" "${symlinkPath}"
      chmod +x "${sourcePath}"
    `
    execSync(`pkexec sh -c '${script.replace(/'/g, "\\'")}'`)
  }

  return await installUnixCLI(sourcePath, fallbackMethod ? elevatedInstall : undefined)
}

async function installUnixCLI(
  sourcePath: string,
  elevatedInstall: (sourcePath: string, symlinkPath: string) => void
): Promise<boolean> {

  const t = useI18n(app)
  const symlinkPath = '/usr/local/bin/witsy'

  try {
    // Check if symlink already exists and is valid
    if (isSymlinkValid(symlinkPath, sourcePath)) {
      log.info('CLI symlink already exists and is valid')
      return true
    }

    // Try to create/update symlink without sudo first
    try {
      if (!fs.existsSync('/usr/local/bin')) {
        fs.mkdirSync('/usr/local/bin', { recursive: true })
      }

      // Remove existing file/symlink if it exists
      if (fs.existsSync(symlinkPath)) {
        fs.unlinkSync(symlinkPath)
      }

      fs.symlinkSync(sourcePath, symlinkPath)
      fs.chmodSync(sourcePath, 0o755)
      log.info('CLI installed successfully to /usr/local/bin/witsy')

    } catch {

      if (elevatedInstall) {

        // If that fails, show info dialog and use elevated privileges
        await dialog.showMessageBox({
          type: 'info',
          title: t('cli.install.title'),
          message: t('cli.install.elevated'),
          buttons: [t('common.ok')]
        })

        try {
          
          elevatedInstall(sourcePath, symlinkPath)

          log.info('CLI installed successfully to /usr/local/bin/witsy (with elevated privileges)')
        
        } catch (elevatedError) {

          log.error('Failed to install CLI with elevated privileges:', elevatedError)

          // Show error dialog
          await dialog.showMessageBox({
            type: 'error',
            title: t('cli.install.title'),
            message: t('cli.install.failure'),
            buttons: [t('common.ok')]
          })

          // Record error in config
          const cfg = config.loadSettings(app)
          cfg.general.cliInstallError = true
          config.saveSettings(app, cfg)
        }

      }
    }

  } catch (error) {
    log.error('Failed to install CLI:', error)
  }

  // success
  return isSymlinkValid(symlinkPath, sourcePath)


}

async function installWindowsCLI(): Promise<boolean> {

  const appPath = app.getPath('exe')
  const appDir = path.dirname(appPath)

  // Detect if we're running under Squirrel (versioned app-X.X.X folder)
  const isSquirrel = appDir.includes('\\app-')

  let targetDir: string
  let sourceCmd: string

  if (isSquirrel) {
    // Extract root directory (parent of app-X.X.X)
    const appMatch = appDir.match(/^(.*?)\\app-[^\\]+$/)
    if (!appMatch) {
      log.error('Failed to extract root directory from Squirrel path:', appDir)
      return false
    }

    const rootDir = appMatch[1]
    targetDir = rootDir

    for (const ext of ['.cmd', '.ps1']) {

      sourceCmd = path.join(appDir, 'resources', 'cli', 'bin', `witsy${ext}`)
      const targetCmd = path.join(rootDir, `witsy${ext}`)

      // Copy witsy.ps1 to root directory
      try {
        fs.copyFileSync(sourceCmd, targetCmd)
        log.info(`Copied witsy${ext} to root:`, targetCmd)
      } catch (error) {
        log.error(`Failed to copy witsy${ext} to root:`, error)
        return false
      }

    }
  
  } else {
    // Non-Squirrel installation (keep old behavior for compatibility)
    targetDir = path.join(appDir, 'resources', 'cli', 'bin')
  }

  try {
    // Get current PATH
    const checkScript = `[Environment]::GetEnvironmentVariable('Path', 'User')`
    const currentPath = execSync(`powershell -Command "${checkScript}"`, {
      shell: 'powershell.exe',
      encoding: 'utf8'
    }).trim()

    // Check if target directory is already in PATH
    if (currentPath.includes(targetDir)) {
      log.info('CLI directory already in PATH:', targetDir)
      return true
    }

    // Add target directory to PATH
    const newPath = currentPath + ';' + targetDir
    const psScript = `[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(/'/g, "''")}', 'User')`

    execSync(`powershell -Command "${psScript}"`, { shell: 'powershell.exe' })

    log.info('CLI installed successfully, added to PATH:', targetDir)

    return true

  } catch (error) {
    log.error('Failed to install CLI:', error)
    return false
  }
}
