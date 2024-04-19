// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { ipcRenderer } from 'electron'

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.on('show-settings', () => {
    // not super nice but enough for the moment!
    document.querySelector('#open-settings').click()
  })
})
