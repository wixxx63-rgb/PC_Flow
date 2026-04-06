import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (filters: Electron.FileFilter[]) => ipcRenderer.invoke('dialog:openFile', filters),
  saveFile: (filters: Electron.FileFilter[], defaultPath?: string) =>
    ipcRenderer.invoke('dialog:saveFile', filters, defaultPath),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  copyAsset: (src: string, destDir: string) => ipcRenderer.invoke('fs:copyAsset', src, destDir),
  exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
  readFileBase64: (path: string) => ipcRenderer.invoke('fs:readFileBase64', path),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path)
})
