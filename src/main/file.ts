
import { anyDict, strDict } from '../types/index.d';
import { App, BrowserWindow, dialog } from 'electron';
import { execSync } from 'child_process';
import { download } from 'electron-dl';
import process from 'process'
import path from 'node:path';
import fs from 'node:fs';

export const getFileContents = (app: App, filepath: string): strDict => {

  try {
    const fileContents = fs.readFileSync(filepath);
    if (fileContents) {
      return {
        url: `file://${filepath}`,
        contents: fileContents.toString('base64')
      };
    }
  } catch (error) {
    console.error('Error while reading file', error);
  }

  // default
  return null;

}

export const deleteFile = (app: App, filepath: string) => {

  try {
    let path = filepath;
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

export const pickFile = (app: App, payload: anyDict): string|strDict => {

  try {
    
    // build dialog propertis
    const dialogProperties: ("openFile" | "treatPackageAsDirectory" | "noResolveAliases")[] = [ 'openFile', 'treatPackageAsDirectory' ];
    if (payload.location) dialogProperties.push('noResolveAliases');
    
    // show it and pick
    const fileURL = dialog.showOpenDialogSync({
      properties: dialogProperties,
      filters: payload?.filters || [ { name: 'All Files', extensions: ['*'] } ]
    });

    // return
    if (fileURL) {
      if (payload.location) return fileURL[0];
      else return getFileContents(app, fileURL[0]);
    }
    
  } catch (error) {
    console.error('Error while picking file', error);
  }

  // default
  return null;

}

export const findProgram = (app: App, program: string) => {
  if (process.platform !== 'win32') {
    try {
      const path = execSync(`which ${program}`).toString().trim();
      return path;
    } catch(error) {
      console.error(`Error while finding program ${program}`, error);
    }
  }
  return null;
}

export const writeFileContents = (app: App, payload: anyDict): string => {

  // parse properties
  const properties = payload.properties ? { ...payload.properties } : {};
  let defaultPath = app.getPath(properties.directory ? properties.directory : 'downloads');
  const defaultFileName = properties.filename ? properties.filename : payload.url.split('?')[0].split(path.sep).pop();
  if (properties.subdir) {
    defaultPath = path.join(defaultPath, properties.subdir);
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true })
    }
  }

  // destination
  const destinationURL = path.join(defaultPath, defaultFileName);

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
  const defaultFileName = properties.filename ? properties.filename : payload.url.split('?')[0].split(path.sep).pop();
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
      const src = payload.url.slice(7);
      //console.log(`copying ${src} to ${destinationURL}`)
      fs.copyFileSync(src, destinationURL);
      return destinationURL;
    } catch (err) {
      console.error('Error while copying file', err);
      return null;
    }
  }
  
  // download
  const filePath = destinationURL.split(path.sep);
  const filename = `${filePath.pop()}`;
  const directory = filePath.join(path.sep);
  properties = { ...properties, directory, filename };
  //console.log(`downloading ${payload.url} to ${JSON.stringify(properties)}`)

  try {
    await download(BrowserWindow.getFocusedWindow(),
      payload.url, {
      ...properties,
      onProgress: () => {
        //console.log(status);
      },
      onCompleted: () => {
        //console.log(status);
      },

    });
    return destinationURL;

  } catch (error) {
    console.error('Error while downloading file', error);
    return null
  }

}
