
import { execSync } from 'child_process'

console.log('Running preinstall script...')

const platform = process.platform
const arch = process.arch

// Remove nut.js package on Windows ARM
if (platform === 'win32' && arch.startsWith('arm')) {
  console.log('Windows ARM detected. Removing nut.js package.')
  execSync('npm uninstall @nut-tree-fork/nut-js')
}
