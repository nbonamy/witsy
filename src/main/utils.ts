
import { strDict } from '../types/index';
import { v4 as uuidv4 } from 'uuid'

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
