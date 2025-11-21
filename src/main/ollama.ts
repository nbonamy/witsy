import { net } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { mainWindow } from './windows/main';
import * as IPC from '@/ipc_consts';

interface DownloadState {
  downloadId: string;
  filePath: string;
  totalBytes: number;
  downloadedBytes: number;
  cancelled: boolean;
}

let currentDownload: DownloadState | null = null;

/**
 * Get the platform-specific Ollama download URL
 */
function getOllamaDownloadUrl(): { url: string; filename: string } {
  const platform = process.platform;
  
  if (platform === 'darwin') {
    return {
      url: 'https://ollama.com/download/Ollama.dmg',
      filename: 'Ollama.dmg'
    };
  } else if (platform === 'win32') {
    return {
      url: 'https://ollama.com/download/OllamaSetup.exe',
      filename: 'OllamaSetup.exe'
    };
  } else {
    return {
      url: 'https://ollama.com/download/ollama-linux-amd64',
      filename: 'ollama-linux-amd64'
    };
  }
}

/**
 * Start downloading Ollama
 */
export function startDownload(targetDirectory: string): string {
  if (currentDownload) {
    throw new Error('Download already in progress');
  }

  const { url, filename } = getOllamaDownloadUrl();
  const downloadId = Date.now().toString();
  const filePath = path.join(targetDirectory, filename);

  currentDownload = {
    downloadId,
    filePath,
    totalBytes: 0,
    downloadedBytes: 0,
    cancelled: false
  };

  // Start the download
  const request = net.request(url);
  
  request.on('response', (response) => {
    const contentLength = response.headers['content-length'];
    if (contentLength && typeof contentLength === 'string') {
      currentDownload!.totalBytes = parseInt(contentLength, 10);
    }

    const writeStream = fs.createWriteStream(filePath);
    
    response.on('data', (chunk) => {

      if (!currentDownload) return;

      if (currentDownload?.cancelled) {
        writeStream.close();
        return;
      }

      writeStream.write(chunk);
      currentDownload!.downloadedBytes += chunk.length;
      
      // Send progress update
      const progress = currentDownload!.totalBytes > 0 
        ? (currentDownload!.downloadedBytes / currentDownload!.totalBytes) * 100 
        : 0;
      
      mainWindow?.webContents.send(IPC.OLLAMA.DOWNLOAD_PROGRESS, {
        downloadId: currentDownload!.downloadId,
        progress: Math.round(progress),
        downloadedBytes: currentDownload!.downloadedBytes,
        totalBytes: currentDownload!.totalBytes
      });
    });

    response.on('end', () => {
      writeStream.close();
      
      if (currentDownload?.cancelled) {
        // Clean up cancelled download
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Error cleaning up cancelled download:', error);
        }
        currentDownload = null;
        return;
      }

      // Download completed successfully
      mainWindow?.webContents.send(IPC.OLLAMA.DOWNLOAD_COMPLETE, {
        downloadId: currentDownload?.downloadId,
        filePath: currentDownload?.filePath
      });

      currentDownload = null;
    });

    response.on('error', (error) => {
      writeStream.close();
      
      // Clean up failed download
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up failed download:', cleanupError);
      }

      mainWindow?.webContents.send(IPC.OLLAMA.DOWNLOAD_ERROR, {
        downloadId: currentDownload?.downloadId || downloadId,
        error: error.message
      });

      currentDownload = null;
    });
  });

  request.on('error', (error) => {
    mainWindow?.webContents.send(IPC.OLLAMA.DOWNLOAD_ERROR, {
      downloadId: downloadId,
      error: error.message
    });

    currentDownload = null;
  });

  request.end();
  
  return downloadId;
}

/**
 * Cancel the current download
 */
export function cancelDownload(): boolean {
  if (!currentDownload) {
    return false;
  }

  currentDownload.cancelled = true;
  
  // Clean up the partial file
  try {
    if (fs.existsSync(currentDownload.filePath)) {
      fs.unlinkSync(currentDownload.filePath);
    }
  } catch (error) {
    console.error('Error cleaning up cancelled download:', error);
  }

  currentDownload = null;
  return true;
}

/**
 * Open the downloaded file in the file explorer
 */
export function openInFileExplorer(filePath: string): void {
  const platform = process.platform;
  const directory = path.dirname(filePath);

  if (platform === 'darwin') {
    // On macOS, open Finder and select the file
    spawn('open', ['-R', filePath]);
  } else if (platform === 'win32') {
    // On Windows, open Explorer and select the file
    spawn('explorer', ['/select,', filePath]);
  } else {
    // On Linux, open the directory
    spawn('xdg-open', [directory]);
  }
}

/**
 * Get current download status
 */
export function getDownloadStatus(): DownloadState | null {
  return currentDownload;
}
