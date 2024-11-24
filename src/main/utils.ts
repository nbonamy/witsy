
import { strDict } from '../types/index';
import { v4 as uuidv4 } from 'uuid'

const textCache: strDict = {}

export const wait = async (millis = 200) => {
  if (process.env.DEBUG && process.platform === 'win32') {
    // for an unknown reason, the promise code started to fail when debugging on Windows
    const waitTill = new Date(new Date().getTime() + millis);
    while (waitTill > new Date()) {
      // do nothing
    }
  } else {
    await new Promise((resolve) => setTimeout(resolve, millis));
  }
}

export const  getCachedText = (id: string): string => {
  const prompt = textCache[id]
  delete textCache[id]
  return prompt
}

export const putCachedText = (text: string): string => {
  const id = uuidv4()
  textCache[id] = text
  return id
}
