
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

export const fixPath = (): void => {

  try {

    // on windows everything is fine
    if (process.platform === 'win32') {
      return
    }

    // macOS and Linux need to fix the PATH
    const command = `${process.env.SHELL} -l -c 'echo -n "_SHELL_ENV_DELIMITER_"; printenv PATH; echo -n "_SHELL_ENV_DELIMITER_";'`
    const output = execSync(command).toString();
    let path = output.split('_SHELL_ENV_DELIMITER_')[1].trim();

    // on macOS we add homebrew paths
    if (process.platform === 'darwin') {
      const paths = path.split(':')
      for (const hbp of [ '/usr/local/bin', '/opt/homebrew/bin' ]) {
        if (fs.existsSync(hbp) && !paths.includes(hbp)) {
          paths.push(hbp)
        }
      }
      path = paths.join(':')
    }

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
