
import { ipcRenderer } from 'electron'
import { v4 as uuidv4 } from 'uuid'

export const getFileContents = (url) => {
  return ipcRenderer.sendSync('get-contents', url.replace('file://', ''))
}
  
export const download = (url) => {

  // get extension from url
  let extension = url.split('.').pop().trim()
  if (extension == '') {
    extension = 'jpg'
  }

  let filename = `${uuidv4()}.${extension}`
  filename = ipcRenderer.sendSync('download', {
    url: url,
    properties: {
      filename: filename,
      directory: 'userData',
      subdir: 'images',
      prompt: false
    }
  })

  // done
  return filename

}

