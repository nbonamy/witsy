import { BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

type PrintPdfOptions = {
  html: string
  landscape?: boolean
}

const waitForReadyState = async (window: BrowserWindow): Promise<void> => {
  await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve(true);
        return;
      }
      window.addEventListener('load', () => resolve(true), { once: true });
    });
  `)

  await window.webContents.executeJavaScript(`
    (async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      return true;
    })();
  `)
}

export const printPdfFromHtml = async (options: PrintPdfOptions): Promise<Buffer> => {
  const tmpFilePath = path.join(os.tmpdir(), `witsy-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.html`)
  const printWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      defaultEncoding: 'UTF-8',
    }
  })

  try {
    await fs.writeFile(tmpFilePath, options.html, 'utf8')
    await printWindow.loadFile(tmpFilePath)
    await waitForReadyState(printWindow)

    return await printWindow.webContents.printToPDF({
      landscape: options.landscape ?? false,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      generateTaggedPDF: true,
      generateDocumentOutline: true,
    })
  } finally {
    try {
      await fs.unlink(tmpFilePath)
    } catch {
      // no-op
    }
    if (!printWindow.isDestroyed()) {
      printWindow.destroy()
    }
  }
}
