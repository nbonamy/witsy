
import { execSync } from 'child_process'

export default function(platform, arch) {

  console.log('Running prePackage script…')

  // Remove nut.js package on Windows ARM
  if (platform === 'win32' && arch.startsWith('arm')) {
    console.log('Windows ARM detected. Removing nut.js package.')
    execSync('npm uninstall @nut-tree-fork/nut-js')
  }

  // Add robotjs for Linux
  if (platform === 'linux') {
    console.log('Linux detected. Installing robotjs.')
    execSync('npm install robotjs')
  }

}
