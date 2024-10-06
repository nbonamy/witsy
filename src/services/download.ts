
import { v4 as uuidv4 } from 'uuid'

export const getFileContents = (url: string) => {
  return window.api.file.read(url.replace('file://', ''))
}

export const saveFileContents = (extension: string, contents: string) => {

  // call main
  const fileUrl = window.api.file.save({
    contents: contents,
    properties: {
      filename: `${uuidv4()}.${extension}`,
      directory: 'userData',
      subdir: 'images',
      prompt: false
    }
  })

  // done
  return fileUrl
}
  
export const download = (url: string) => {

  // get extension from url
  let extension = url.split(/[#?]/)[0].split('.').pop().trim()
  if (extension == '') {
    extension = 'jpg'
  }

  // call main
  const fileUrl = window.api.file.download({
    url: url,
    properties: {
      filename: `${uuidv4()}.${extension}`,
      directory: 'userData',
      subdir: 'images',
      prompt: false
    }
  })

  // done
  return fileUrl

}

