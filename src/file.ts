
import { App, BrowserWindow, dialog } from 'electron';
import { download } from 'electron-dl';
import path from 'node:path';
import fs from 'node:fs';
import { anyDict } from './index';

export const getFileContents = (app: App, payload: string) => {

  try {
    let fileContents = fs.readFileSync(payload);
    if (fileContents) {
      return {
        url: `file://${payload}`,
        contents: fileContents.toString('base64')
      };
    }
  } catch {}

  // default
  return null;

}

export const deleteFile = (app: App, payload: anyDict) => {

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

export const pickFile = (app: App, payload: anyDict) => {

  try {
    let fileURL = dialog.showOpenDialogSync({
      filters: payload?.filters
    });
    if (fileURL) {
      return getFileContents(app, fileURL[0]);
    }
  } catch {}

  // default
  return null;

}


export const writeFileContents = (app: App, payload: anyDict) => {

  // parse properties
  let properties = payload.properties ? { ...payload.properties } : {};
  let defaultPath = app.getPath(properties.directory ? properties.directory : 'downloads');
  let defaultFileName = properties.filename ? properties.filename : payload.url.split('?')[0].split(path.sep).pop();
  if (properties.subdir) {
    defaultPath = path.join(defaultPath, properties.subdir);
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true })
    }
  }

  // destination
  let destinationURL = path.join(defaultPath, defaultFileName);

  // try
  try {
    fs.writeFileSync(destinationURL, Buffer.from(payload.contents, 'base64'));
    return destinationURL;
  } catch (error) {
    console.error('Error while writing file', error);
    return null
  }

}

export const downloadFile = async (app: App, payload: anyDict) => {

  // parse properties
  let properties = payload.properties ? { ...payload.properties } : {};
  let defaultPath = app.getPath(properties.directory ? properties.directory : 'downloads');
  let defaultFileName = properties.filename ? properties.filename : payload.url.split('?')[0].split(path.sep).pop();
  if (properties.subdir) {
    defaultPath = path.join(defaultPath, properties.subdir);
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true })
    }
  }

  // now prompt or not
  let destinationURL: string|undefined = path.join(defaultPath, defaultFileName);
  if (properties.prompt !== false) {
    destinationURL = dialog.showSaveDialogSync({
      defaultPath: destinationURL
    });
  }

  // cancelled
  if (!destinationURL) {
    return null;
  }

  // if file to file, copy
  if (payload.url.startsWith('file://')) {
    try {
      let src = payload.url.slice(7);
      //console.log(`copying ${src} to ${destinationURL}`)
      fs.copyFileSync(src, destinationURL);
      return destinationURL;
    } catch (err) {
      console.error('Error while copying file', err);
      return null;
    }
  }
  
  // download
  let filePath = destinationURL.split(path.sep);
  let filename = `${filePath.pop()}`;
  let directory = filePath.join(path.sep);
  properties = { ...properties, directory, filename };
  //console.log(`downloading ${payload.url} to ${JSON.stringify(properties)}`)

  try {
    // @ts-ignore
    await download(BrowserWindow.getFocusedWindow(),
      payload.url, {
      ...properties,
      onProgress: (status) => {
        //console.log(status);
      },
      onCompleted: (status) => {
        //console.log(status);
      },

    });
    return destinationURL;

  } catch (error) {
    console.error('Error while downloading file', error);
    return null
  }

}
