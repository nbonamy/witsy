
const { BrowserWindow, dialog } = require('electron');
const { download } = require('electron-dl');
const path = require('node:path');
const fs = require('node:fs');

const deleteFile = (app, payload) => {

  try {
    let path = payload.path;
    if (path.startsWith('file://')) {
      path = path.slice(7);
    }
    fs.unlinkSync(path);
    return true;
  } catch (error) {
    console.error('Error while deleting file', error);
    return false;
  }

}

const pickFile = (app, payload) => {

  let fileURL = dialog.showOpenDialogSync({
    filters: payload?.filters
  });
  if (fileURL) {
    let fileContents = fs.readFileSync(fileURL[0]);
    return {
      url: fileURL[0],
      contents: fileContents.toString('base64')
    };
  } else {
    return null;
  }

}

const downloadFile = async (app, payload) => {

  // parse properties
  let properties = payload.properties ? { ...payload.properties } : {};
  let defaultPath = app.getPath(properties.directory ? properties.directory : 'downloads');
  let defaultFileName = properties.filename ? properties.filename : payload.url.split('?')[0].split('/').pop();
  if (properties.subdir) {
    defaultPath = path.join(defaultPath, properties.subdir);
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true })
    }
  }

  // now prompt or not
  let customURL = path.join(defaultPath, defaultFileName);
  if (properties.prompt !== false) {
    customURL = dialog.showSaveDialogSync({
      defaultPath: customURL
    });
  }
  if (customURL) {
    let filePath = customURL.split('/');
    let filename = `${filePath.pop()}`;
    let directory = filePath.join('/');
    properties = { ...properties, directory, filename };
    //console.log(`downloading ${payload.url} to ${customURL}`)
    await download(BrowserWindow.getFocusedWindow(),
      payload.url, {
      ...properties,
      onProgress: (progress) => {
        //mainWindow.webContents.send('download-progress', progress)
      },
      onCompleted: (item) => {
        //mainWindow.webContents.send('download-complete', item)
      }
    });
    return customURL;    
  } else {
    return null
  }  
}

export { deleteFile, pickFile, downloadFile }
