const { app, Menu, Tray, BrowserWindow, ipcMain, dialog, shell, nativeImage, globalShortcut } = require('electron');
const { download } = require('electron-dl');
const Store = require('electron-store')
const process = require('node:process');
const path = require('node:path');
const fs = require('node:fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// main window
let window = null;
const store = new Store()
const createWindow = () => {
  
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  // restore and save state
  mainWindow.setBounds(store.get('bounds'))
  mainWindow.on('close', () => {
    store.set('bounds', mainWindow.getBounds())
})

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // open links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Open the DevTools.
  if (process.env.DEBUG) {
    mainWindow.webContents.openDevTools();
  }

  // show in the dock
  app.dock.show();

  // done
  return mainWindow;
};

// App functions

const openMainWindow = () => {

  // try to show existig one
  if (window) {
    try {
      window.show();
      return
    } catch {
    }
  }

  // else open a new one
  window = createWindow();

}

const quitApp = () => {
  app.quit();
}

//  Tray icon

let tray = null;
import trayIcon from '../assets/brainTemplate.png?asset';

// tray menu
const trayMenu = [
  { label: 'Message', click: openMainWindow },
  { label: 'Quit', click: quitApp }
];

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  
  // hide dock
  // if (!process.env.DEBUG) {
  //   app.dock.hide();
  // }

  // create the main window
  window = createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      window = createWindow();
    }
  });

  // create tray
  tray = new Tray(nativeImage.createFromDataURL(trayIcon));
  const contextMenu = Menu.buildFromTemplate(trayMenu);
  tray.setContextMenu(contextMenu);

  // global shortcut
  const ret = globalShortcut.register('Alt+Space', openMainWindow)

});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  } else {
    app.dock.hide();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.on('get-app-path', (event) => {
  event.returnValue = app.getPath('userData');
})

ipcMain.on('fullscreen', (event, flag) => {
  window.setFullScreen(flag);
})

ipcMain.on('delete', (event, payload) => {
  try {
    let path = payload.path;
    if (path.startsWith('file://')) {
      path = path.slice(7);
    }
    fs.unlinkSync(path);
    event.returnValue = true;
  } catch (error) {
    console.error('Error while deleting file', error);
    event.returnValue = false;
  }
})

ipcMain.on('pick-file', (event, payload) => {
  let fileURL = dialog.showOpenDialogSync({
    filters: payload?.filters
  });
  if (fileURL) {
    let fileContents = fs.readFileSync(fileURL[0]);
    event.returnValue = {
      url: fileURL[0],
      contents: fileContents.toString('base64')
    };
  } else {
    event.returnValue = null;
  }
})

ipcMain.on('download', async (event, payload) => {

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
    event.returnValue = customURL;    
  } else { /*save cancelled*/
  }
})
