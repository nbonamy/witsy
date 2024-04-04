const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { download } = require('electron-dl');
const process = require('node:process');
const path = require('node:path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  if (process.env.DEBUG) {
    mainWindow.webContents.openDevTools();
  }
  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.on('get-app-path', (event) => {
  event.returnValue = app.getPath('userData');
})

ipcMain.on('download', async (event, { payload }) => {
  let properties = payload.properties ? { ...payload.properties } : {};
  const defaultPath = app.getPath(properties.directory ? properties.directory : 'downloads');
  const defaultFileName = properties.filename ? properties.filename : payload.url.split('?')[0].split('/').pop();
  let customURL = dialog.showSaveDialogSync({
    defaultPath: `${defaultPath}/${defaultFileName}`
  });
  if (customURL) {
    let filePath = customURL.split('/');
    let filename = `${filePath.pop()}`;
    let directory = filePath.join('/');
    properties = { ...properties, directory, filename };
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
  } else { /*save cancelled*/
  }
})
