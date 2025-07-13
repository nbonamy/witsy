
import { strDict } from '../types/index';
import { execSync } from 'node:child_process'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'

const textCache: strDict = {}

export const wait = async (millis = 200) => {
  if (process.env.DEBUG && process.platform !== 'darwin') {
    // for an unknown reason, the promise code started to fail when debugging on Windows/Linux
    const waitTill = new Date().getTime() + millis;
    while (waitTill > new Date().getTime()) {
      // do nothing
    }
  } else {
    await new Promise((resolve) => setTimeout(resolve, millis));
  }
}

export const fixPath = async (): Promise<void> => {

  try {

    // on windows everything is fine
    if (process.platform === 'win32') {
      console.log('PATH', process.env.PATH)
      return
    }

    // nu requires some tweaking
    const shell = process.env.SHELL || '/bin/bash'
    const isNu = shell === 'nu' || shell.endsWith('/nu')
    const echo = isNu ? 'print' : 'echo -n'

    // macOS and Linux need to fix the PATH
    const command = `${shell} -l -c '${echo} "_SHELL_ENV_DELIMITER_"; printenv PATH; ${echo} "_SHELL_ENV_DELIMITER_";'`
    const output = execSync(command).toString();
    let path = output.split('_SHELL_ENV_DELIMITER_')[1].trim();
    const paths = path.split(':')

    // on macOS we add homebrew paths
    try {
      if (process.platform === 'darwin') {
        for (const hbp of [ '/usr/local/bin', '/opt/homebrew/bin' ]) {
          if (fs.existsSync(hbp) && !paths.includes(hbp)) {
            paths.push(hbp)
          }
        }
        path = paths.join(':')
      }
    } catch { /* empty */ }

    // try to deal with nvm using nvm
    let nvmFixed = false
    try {
      const command = `${shell} -l -c '${echo} "_SHELL_NVM_DELIMITER_"; nvm which current; ${echo} "_SHELL_NVM_DELIMITER_";'`
      const output = execSync(command).toString();
      let nbp = output.split('_SHELL_NVM_DELIMITER_')[1].trim()
      if (fs.existsSync(nbp)) {
        nvmFixed = true
        nbp = nbp.split('/').slice(0, -1).join('/')
        if (!paths.includes(nbp)) {
          paths.push(nbp)
        }
      }
    } catch { /* empty */ }

    // try to deal with nvm using files
    if (!nvmFixed) {
      try {
        const nvf = `${process.env.HOME}/.nvm/alias/default`
        const nbf = `${process.env.HOME}/.nvm/versions/node`
        if (fs.existsSync(nvf) && fs.existsSync(nbf)) {
          
          // read current version file
          // could be simply '20' but we need to add 'v' prefix
          let current = fs.readFileSync(nvf, 'utf8').trim()
          if (!current.startsWith('v')) {
            current = `v${current}`
          }

          // now iterate on existing versions
          let best = ''
          const versions = fs.readdirSync(nbf).sort()
          for (const v of versions) {
            if (v === current) {
              best = v
              break
            } else if (v.startsWith(current)) {            
              best = v
            }
          }

          if (best) {
            const nvpPath = `${nbf}/${best}/bin`
            if (!paths.includes(nvpPath)) {
              paths.push(nvpPath)
            }
          }
        }
      } catch { /* empty */ }
    }

    // join
    path = paths.join(':')

    // done
    console.log('Fixing PATH:', path)
    process.env.PATH = path;

  } catch (error) {
    console.error('Failed to fix PATH:', error)
  }

}

export const getCachedText = (id: string): string => {
  const prompt = textCache[id]
  delete textCache[id]
  return prompt
}

export const putCachedText = (text: string): string => {
  const id = uuidv4()
  textCache[id] = text
  return id
}
