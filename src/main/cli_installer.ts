import { app } from 'electron'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import log from 'electron-log/main'

export async function checkAndInstallCLI(): Promise<void> {

  if (process.platform === 'darwin') {
    await installMacOSCLI()
  } else if (process.platform === 'win32') {
    await installWindowsCLI()
  } else if (process.platform === 'linux') {
    await installLinuxCLI()
  }
}

async function installMacOSCLI(): Promise<void> {
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

  await installUnixCLI(sourcePath, elevatedInstall)
}

async function installLinuxCLI(): Promise<void> {
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

  await installUnixCLI(sourcePath, elevatedInstall)
}

async function installUnixCLI(
  sourcePath: string,
  elevatedInstall: (sourcePath: string, symlinkPath: string) => void
): Promise<void> {
  const symlinkPath = '/usr/local/bin/witsy'

  try {
    // Check if symlink exists (use lstat to check the symlink itself, not its target)
    let symlinkExists = false
    try {
      const stats = fs.lstatSync(symlinkPath)
      symlinkExists = stats.isSymbolicLink() || stats.isFile()
    } catch {
      // Symlink doesn't exist
    }

    if (symlinkExists) {
      try {
        const linkTarget = fs.readlinkSync(symlinkPath)
        const resolvedTarget = path.resolve(path.dirname(symlinkPath), linkTarget)
        const resolvedSource = path.resolve(sourcePath)

        if (resolvedTarget === resolvedSource) {
          return
        }
      } catch {
        // Not a symlink, will replace it
      }
    }

    // Try to create/update symlink without sudo first
    try {
      if (!fs.existsSync('/usr/local/bin')) {
        fs.mkdirSync('/usr/local/bin', { recursive: true })
      }

      // Remove existing file/symlink if it exists
      if (symlinkExists) {
        fs.unlinkSync(symlinkPath)
      }

      fs.symlinkSync(sourcePath, symlinkPath)
      fs.chmodSync(sourcePath, 0o755)
      log.info('CLI installed successfully to /usr/local/bin/witsy')

    } catch {

      // If that fails, use elevated privileges
      elevatedInstall(sourcePath, symlinkPath)
      log.info('CLI installed successfully to /usr/local/bin/witsy (with elevated privileges)')
    }

  } catch (error) {
    log.error('Failed to install CLI:', error)
  }
}

async function installWindowsCLI(): Promise<void> {

  const appPath = app.getPath('exe')
  const appDir = path.dirname(appPath)
  const cliDir = path.join(appDir, 'resources', 'cli', 'bin')

  try {
    // Check if already in PATH using PowerShell
    const checkScript = `[Environment]::GetEnvironmentVariable('Path', 'User')`
    const currentPath = execSync(`powershell -Command "${checkScript}"`, {
      shell: 'powershell.exe',
      encoding: 'utf8'
    }).trim()

    if (currentPath.includes(cliDir)) {
      return
    }

    // Add to user PATH using PowerShell
    const psScript = `
      $oldPath = [Environment]::GetEnvironmentVariable('Path', 'User')
      $newPath = $oldPath + ';${cliDir}'
      [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    `

    execSync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, { shell: 'powershell.exe' })

    log.info('CLI installed successfully, added to PATH:', cliDir)

  } catch (error) {
    log.error('Failed to install CLI:', error)
  }
}
