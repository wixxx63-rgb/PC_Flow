import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs'
import { dirname, basename, extname } from 'path'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0f1117',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      webSecurity: false // allow loading local file assets
    },
    show: false
  })

  win.once('ready-to-show', () => win.show())

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async (_e, filters) => {
  const { filePaths } = await dialog.showOpenDialog({ filters, properties: ['openFile'] })
  return filePaths[0] ?? null
})

ipcMain.handle('dialog:saveFile', async (_e, filters, defaultPath) => {
  const { filePath } = await dialog.showSaveDialog({ filters, defaultPath })
  return filePath ?? null
})

ipcMain.handle('fs:readFile', (_e, path) => {
  try { return readFileSync(path, 'utf-8') } catch { return null }
})

ipcMain.handle('fs:writeFile', (_e, path, content) => {
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, 'utf-8')
    return true
  } catch (err) {
    console.error('writeFile error:', err)
    return false
  }
})

ipcMain.handle('fs:copyAsset', (_e, src, destDir) => {
  try {
    mkdirSync(destDir, { recursive: true })
    const name = basename(src)
    const dest = join(destDir, name)
    copyFileSync(src, dest)
    return dest
  } catch (err) {
    console.error('copyAsset error:', err)
    return null
  }
})

ipcMain.handle('fs:exists', (_e, path) => existsSync(path))

ipcMain.handle('fs:readFileBase64', (_e, path) => {
  try { return readFileSync(path).toString('base64') } catch { return null }
})

ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url))

ipcMain.handle('shell:showItemInFolder', (_e, path) => shell.showItemInFolder(path))
