import autolib from 'autolib';
import { execSync } from 'child_process';
import { App, dialog } from 'electron';
import icns from 'icns-lib';
import { minimatch } from 'minimatch';
import { extensionToMimeType as e2mt } from 'multi-llm-ts';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import plist from 'plist';
import process from 'process';
import { FileContents, FileDownloadParams, FilePickParams, FileProperties, FileSaveParams, FileStats, SearchMatch, SearchOptions, SearchResult } from 'types/file';
import { DirectoryItem } from 'types/filesystem';
import { ExternalApp } from 'types/index';

const FILE_SIZE_LIMIT = 256 * 1024 * 1024; // 256MB

export const extensionToMimeType = (ext: string): string => {
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.avi') return 'video/x-msvideo'
  if (ext === '.mov') return 'video/quicktime'
  if (ext === '.wmv') return 'video/x-ms-wmv'
  if (ext === '.flv') return 'video/x-flv'
  // if (ext === '.webm') return 'video/webm'
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

    // load and check
    const fileContents = fs.readFileSync(filepath);
    if (!fileContents) {
      console.error('File is empty or cannot be read', filepath);
      return null;
    }

    // check size
    if (fileContents.length > FILE_SIZE_LIMIT) {
      console.error('File too large to read', filepath);
      return null;
    }

    // good
    return {
      url: `file://${filepath}`,
      mimeType: extensionToMimeType(path.extname(filepath)),
      contents: fileContents.toString('base64')
    };

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

export const deleteFile = (filepath: string): boolean => {

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

export const listFilesRecursively = (directoryPath: string, excludePatterns?: string[]): string[] => {

  let fileList: string[] = []

  try {

    // Read the contents of the directory
    const files = fs.readdirSync(directoryPath)

    for (const file of files) {

      // ignored files
      if (file === '.DS_Store' || file === 'Thumbs.db') {
        continue
      }

      // check exclude patterns
      if (excludePatterns?.some(pattern => minimatch(file, pattern))) {
        continue
      }

      const filePath = path.join(directoryPath, file)
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // If it's a directory, recursively call the function
        fileList = fileList.concat(listFilesRecursively(filePath, excludePatterns));
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

export const findFiles = async (app: App, basePath: string, pattern: string, maxResults: number = 10): Promise<string[]> => {
  const results: string[] = []

  try {
    const findFilesRecursive = async (currentPath: string, depth: number = 0): Promise<boolean> => {
      // Safety limit to prevent infinite recursion
      if (depth > 50) return false

      try {
        const items = await fsPromises.readdir(currentPath, { withFileTypes: true })

        for (const item of items) {
          // Stop if we've reached the max results
          if (results.length >= maxResults) return true

          // Skip hidden files and system files
          if (item.name.startsWith('.') || item.name === 'node_modules') continue

          const itemPath = path.join(currentPath, item.name)

          if (item.isDirectory()) {
            // Recursively search subdirectories
            if (await findFilesRecursive(itemPath, depth + 1)) return true
          } else {
            // Check if file matches the pattern
            if (minimatch(itemPath, pattern) || minimatch(item.name, pattern)) {
              results.push(itemPath)
            }
          }
        }
      } catch (error) {
        // Silently skip directories we can't read (permissions, etc.)
        console.debug('Skipping directory due to error:', currentPath, error)
      }

      return results.length >= maxResults
    }

    await findFilesRecursive(basePath)

  } catch (error) {
    console.error('Error while finding files', error)
    throw error
  }

  return results
}

export const fileExists = (app: App, filePath: string): boolean => {
  try {
    return fs.existsSync(filePath)
  } catch (error) {
    console.error('Error while checking file existence', error)
    return false
  }
}

export const fileStats = (app: App, filePath: string): FileStats | null => {
  try {
    const stats = fs.lstatSync(filePath)
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      isSymbolicLink: stats.isSymbolicLink(),
      lastModified: stats.mtimeMs,
      createdAt: stats.birthtimeMs,
    }
  } catch (error) {
    console.error('Error while getting file stats', error)
    return null
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
  const defaultPayload = {
    contents: '',
    properties: {
      directory: 'downloads',
      prompt: false,
      subdir: false,
    } as FileProperties,
  };
  
  payload = {
    ...defaultPayload,
    ...payload,
    properties: {
      ...defaultPayload.properties,
      ...payload.properties
    }
  };

  // parse properties
  const properties = payload.properties;
  let defaultPath = app.getPath(properties.directory);
  
  // handle workspace-specific paths
  if (properties.workspace && properties.directory === 'userData') {
    const workspaceFolder = path.join(defaultPath, 'workspaces', properties.workspace);
    if (!fs.existsSync(workspaceFolder)) {
      fs.mkdirSync(workspaceFolder, { recursive: true });
    }
    defaultPath = workspaceFolder;
  }
  
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

// Directories to skip when searching
const SKIP_DIRECTORIES = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.git', '.svn', '.hg'
])

/**
 * Find files recursively with glob filtering
 */
const findFilesForSearch = (dir: string, globPattern?: string, maxFiles: number = 1000): string[] => {
  const files: string[] = []
  const stack: string[] = [dir]

  while (stack.length > 0 && files.length < maxFiles) {
    const currentDir = stack.pop()!

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break

      // Skip hidden files and common non-code directories
      if (entry.name.startsWith('.') || SKIP_DIRECTORIES.has(entry.name)) {
        continue
      }

      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.isFile()) {
        if (globPattern) {
          const relativePath = path.relative(dir, fullPath)
          if (!minimatch(relativePath, globPattern, { matchBase: true })) {
            continue
          }
        }
        files.push(fullPath)
      }
    }
  }

  return files
}

/**
 * Search for content inside files
 */
export const searchContent = (
  basePath: string,
  pattern: string,
  options: SearchOptions = {}
): SearchResult => {
  const { glob, caseInsensitive = false, contextLines = 0, maxResults = 100 } = options

  // Validate regex pattern
  let regex: RegExp
  try {
    regex = new RegExp(pattern, caseInsensitive ? 'gi' : 'g')
  } catch {
    return { matches: [], filesSearched: 0, truncated: false }
  }

  const matches: SearchMatch[] = []
  let truncated = false

  // Handle file vs directory
  const stats = fs.statSync(basePath)
  const files = stats.isFile() ? [basePath] : findFilesForSearch(basePath, glob)

  for (const file of files) {
    if (matches.length >= maxResults) {
      truncated = true
      break
    }

    let content: string
    try {
      content = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }

    // Skip binary files
    if (content.includes('\0')) continue

    const lines = content.split('\n')
    const relativePath = path.relative(basePath, file)
    const displayPath = relativePath || path.basename(file)

    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= maxResults) {
        truncated = true
        break
      }

      regex.lastIndex = 0
      if (regex.test(lines[i])) {
        if (contextLines > 0) {
          const startLine = Math.max(0, i - contextLines)
          const endLine = Math.min(lines.length - 1, i + contextLines)

          for (let j = startLine; j <= endLine; j++) {
            matches.push({
              file: displayPath,
              line: j + 1,
              content: lines[j],
              isMatch: j === i
            })
          }
        } else {
          matches.push({
            file: displayPath,
            line: i + 1,
            content: lines[i],
            isMatch: true
          })
        }
      }
    }
  }

  return {
    matches,
    filesSearched: files.length,
    truncated
  }
}
