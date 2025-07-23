import { ExternalApp } from '../types/index';
import { FileContents, FileSaveParams, FileDownloadParams, FilePickParams } from '../types/file';
import { DirectoryItem } from '../types/filesystem';
import { App, dialog } from 'electron';
import { extensionToMimeType as e2mt } from 'multi-llm-ts';
import { execSync } from 'child_process';
import autolib from 'autolib';
import icns from 'icns-lib';
import plist from 'plist';
import process from 'process'
import path from 'node:path';
import fs from 'node:fs';

export const extensionToMimeType = (ext: string): string => {
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.avi') return 'video/x-msvideo'
  if (ext === '.mov') return 'video/quicktime'
  if (ext === '.wmv') return 'video/x-ms-wmv'
  if (ext === '.flv') return 'video/x-flv'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.mkv') return 'video/x-matroska'
  if (ext === '.m4v') return 'video/x-m4v'
  if (ext === '.3gp') return 'video/3gpp'
  if (ext === '.ogv') return 'video/ogg'
  if (ext === '.ts') return 'video/mp2t'
  if (ext === '.mts') return 'video/mp2t'
  if (ext === '.m2ts') return 'video/mp2t'
  else return e2mt(ext)
}

export const getFileContents = (app: App, filepath: string): FileContents|null => {

  try {
    if (filepath.startsWith('file://')) {
      filepath = filepath.slice(7);
    }
    const fileContents = fs.readFileSync(filepath);
    if (fileContents) {
      return {
        url: `file://${filepath}`,
        mimeType: extensionToMimeType(path.extname(filepath)),
        contents: fileContents.toString('base64')
      };
    }
  } catch (error) {
    console.error('Error while reading file', error);
  }

  // default
  return null;

}

export const getIconContents = (app: App, filepath: string): FileContents|null => {

  try {

    // check extension
    const extension = path.extname(filepath);
    if (extension === '.icns') {
    
      const buffer = fs.readFileSync(filepath);
      const icons = icns.parse(buffer);
      const icon = icons[Object.keys(icons)[0]]
      return {
        url: `file://${filepath}`,
        mimeType: extensionToMimeType('png'),
        contents: icon.toString('base64')
      };
    
    } else if (process.platform == 'win32') {

      // for windows
      const iconInfo = autolib.getApplicationIcon(filepath);

      // convert iconInfo to base64 encoded string
      if (iconInfo && iconInfo.iconData) {
        return {
          url: `file://${filepath}`,
          mimeType: 'image/x-icon',
          contents: Buffer.from(iconInfo.iconData).toString('base64')
        };
      }

    }
  } catch (error) {
    console.error('Error while reading icon', error);
  }

  // default
  return null;

}

export const deleteFile = (app: App, filepath: string): boolean => {

  try {
    let path = filepath;
    if (path.startsWith('file://')) {
      path = path.slice(7);
    }
    if (!fs.existsSync(path)) {
      return false;
    }
    fs.unlinkSync(path);
    return true;
  } catch (error) {
    console.error('Error while deleting file', error);
    return false;
  }

}

export const pickFile = (app: App, payload: FilePickParams): string|string[]|FileContents|null => {

  try {

    // build dialog propertis
    const dialogProperties: ('openFile' | 'treatPackageAsDirectory' | 'noResolveAliases' | 'multiSelections')[] = ['openFile'];
    if (!payload.packages) {
      dialogProperties.push('treatPackageAsDirectory');
    }
    if (payload.location) {
      dialogProperties.push('noResolveAliases');
    }
    if (payload.multiselection) {
      dialogProperties.push('multiSelections');
    }

    // show it and pick
    const fileURL = dialog.showOpenDialogSync({
      properties: dialogProperties,
      filters: payload?.filters || [{ name: 'All Files', extensions: ['*'] }]
    });

    // return
    if (fileURL) {
      if (payload.multiselection) return fileURL;
      else if (payload.location) return fileURL[0];
      else return getFileContents(app, fileURL[0]);
    }

  } catch (error) {
    console.error('Error while picking file', error);
  }

  // default
  return null;

}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const pickDirectory = (app: App): string|null => {

  try {

    // build dialog propertis
    const dialogProperties: ('openDirectory' | 'treatPackageAsDirectory')[] = ['openDirectory', 'treatPackageAsDirectory'];

    // show it and pick
    const fileURL = dialog.showOpenDialogSync({
      properties: dialogProperties,
    });

    // return
    if (fileURL) {
      return fileURL[0];
    }

  } catch (error) {
    console.error('Error while picking directory', error);
  }

  // default
  return null;

}

export const listFilesRecursively = (directoryPath: string): string[] => {

  let fileList: string[] = []

  try {

    // Read the contents of the directory
    const files = fs.readdirSync(directoryPath)

    for (const file of files) {
      const filePath = path.join(directoryPath, file)
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // If it's a directory, recursively call the function
        fileList = fileList.concat(listFilesRecursively(filePath));
      } else {
        // If it's a file, add it to the list
        fileList.push(filePath);
      }
    }

  } catch (err) {
    console.error('Error while listing files recursively', err);
  }

  return fileList;
}

export const listDirectory = (app: App, dirPath: string, includeHidden: boolean = false): DirectoryItem[] => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    
    return items
      .filter(item => includeHidden || !item.name.startsWith('.'))
      .map(item => {
        const itemPath = path.join(dirPath, item.name)
        const result: DirectoryItem = {
          name: item.name,
          fullPath: itemPath,
          isDirectory: item.isDirectory()
        }
        
        if (!item.isDirectory()) {
          try {
            const stats = fs.statSync(itemPath)
            result.size = stats.size
          } catch {
            // Ignore errors for individual files
          }
        }
        
        return result
      })
  } catch (error) {
    console.error('Error while listing directory', error)
    throw error
  }
}

export const fileExists = (app: App, filePath: string): boolean => {
  try {
    return fs.existsSync(filePath)
  } catch (error) {
    console.error('Error while checking file existence', error)
    return false
  }
}

export const writeFile = (app: App, filePath: string, content: string): boolean => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    fs.writeFileSync(filePath, content, 'utf8')
    return true
  } catch (error) {
    console.error('Error while writing new file', error)
    return false
  }
}

export const normalizePath = (app: App, filePath: string): string => {
  try {
    // Handle tilde expansion for home directory
    if (filePath.startsWith('~/')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE
      if (homeDir) {
        filePath = path.join(homeDir, filePath.slice(2))
      }
    } else if (filePath === '~') {
      const homeDir = process.env.HOME || process.env.USERPROFILE
      if (homeDir) {
        filePath = homeDir
      }
    } else if (!path.isAbsolute(filePath)) {
      // Make relative paths relative to home directory
      const homeDir = process.env.HOME || process.env.USERPROFILE
      if (homeDir) {
        filePath = path.join(homeDir, filePath)
      }
    }
    
    return path.resolve(filePath)
  } catch (error) {
    console.error('Error while normalizing path', error)
    return filePath
  }
}

export const findProgram = (app: App, program: string) => {
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const path = execSync(`${which} ${program}`).toString().split('\n')[0].trim();
    return path;
  } catch (error) {
    console.error(`Error while finding program ${program}`, error);
  }
  return null;
}

export const writeFileContents = (app: App, payload: FileSaveParams): string => {

  // defaults
  payload = {
    ...{
      contents: '',
      properties: {
        directory: 'downloads',
        prompt: false,
        subdir: false,
      },
    },
    ...payload
  }

  // parse properties
  const properties = payload.properties;
  let defaultPath = app.getPath(properties.directory);
  const defaultFileName = properties.filename ? properties.filename : payload.url.split('?')[0].split(path.sep).pop();
  if (properties.subdir) {
    defaultPath = path.join(defaultPath, properties.subdir);
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true })
    }
  }

  // destination
  let destinationURL = path.join(defaultPath, defaultFileName);
  if (payload.url?.startsWith('file://')) {
    destinationURL = payload.url.slice(7);
  }
  if (properties.prompt) {
    destinationURL = dialog.showSaveDialogSync({
      defaultPath: destinationURL
    });
    if (!destinationURL) return null;
  }

  // try
  try {
    fs.writeFileSync(destinationURL, Buffer.from(payload.contents, 'base64'));
    return `file://${destinationURL}`;
  } catch (error) {
    console.error('Error while writing file', error);
    return null
  }

}

export const downloadFile = async (app: App, payload: FileDownloadParams) => {

  const savePayload: FileSaveParams = {
    contents: '',
    url: payload.url,
    properties: payload.properties
  }

  try {

    // get contents
    if (payload.url.startsWith('file://')) {

      savePayload.contents = fs.readFileSync(payload.url.slice(7)).toString('base64');
      //savePayload.properties.filename = payload.url.split('?')[0].split(path.sep).pop();
      savePayload.url = null

    } else {

      // fal.media has certificate issues
      // if (payload.url.includes('fal.media')) {
      //   process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
      // }

      const response = await fetch(payload.url);
      const contents = await response.arrayBuffer();
      savePayload.contents = Buffer.from(contents).toString('base64');

      // reset
      // delete process.env['NODE_TLS_REJECT_UNAUTHORIZED']      

    }

    // now just save
    return writeFileContents(app, savePayload);

  } catch (error) {
    console.error('Error while downloading file', error);
    return null
  }

}

export const getAppInfo = async (app: App, filepath: string): Promise<ExternalApp | null> => {

  // for macos
  if (process.platform == 'darwin') {
    try {
      const plistPath = path.join(filepath, 'Contents', 'Info.plist');
      const plistInfo = plist.parse(fs.readFileSync(plistPath, 'utf-8'));
      let plistIcon = plistInfo.CFBundleIconFile || 'AppIcon';
      if (!plistIcon.endsWith('.icns')) {
        plistIcon = `${plistIcon}.icns`;
      }
      return {
        name: plistInfo.CFBundleName,
        identifier: plistInfo.CFBundleIdentifier,
        icon: getIconContents(app, path.join(filepath, 'Contents', 'Resources', plistIcon))
      };
    } catch (err) {
      console.error('Error while getting app info', err);
    }
  }

  // for windows
  if (process.platform == 'win32') {
    try {

      const exePath = filepath;
      const productName = autolib.getProductName(exePath);
      if (!productName) {
        console.error('Error while getting product name', exePath);
        return null;
      }
      return {
        name: productName,
        identifier: exePath,
        icon: getIconContents(app, exePath)
      }

    } catch (err) {
      console.error('Error while getting app info', err);
    }
  }

  // too bad
  return null

}
