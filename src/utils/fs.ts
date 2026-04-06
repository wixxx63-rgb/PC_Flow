/**
 * Cross-platform file system utilities.
 * Uses Electron APIs when available, falls back to browser APIs (download/file picker).
 */

export const isElectron = typeof window !== 'undefined' && !!window.electronAPI

/** Download a text file in the browser, or save via Electron dialog. Returns true on success. */
export async function saveTextFile(
  filename: string,
  content: string,
  ext?: string
): Promise<boolean> {
  if (isElectron) {
    const e = ext ?? filename.split('.').pop() ?? 'txt'
    const path = await window.electronAPI!.saveFile(
      [{ name: filename, extensions: [e] }],
      filename
    )
    if (!path) return false
    return !!(await window.electronAPI!.writeFile(path, content))
  } else {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  }
}

/** Open a text file. Returns { name, content } or null if cancelled. */
export async function openTextFile(
  extensions: string[],
  electronLabel = 'Files'
): Promise<{ name: string; content: string } | null> {
  if (isElectron) {
    const filePath = await window.electronAPI!.openFile([
      { name: electronLabel, extensions }
    ])
    if (!filePath) return null
    const content = await window.electronAPI!.readFile(filePath)
    if (!content) return null
    return { name: filePath, content }
  } else {
    return new Promise(resolve => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = extensions.map(e => `.${e}`).join(',')
      input.style.display = 'none'
      document.body.appendChild(input)
      input.onchange = () => {
        const file = input.files?.[0]
        document.body.removeChild(input)
        if (!file) { resolve(null); return }
        const reader = new FileReader()
        reader.onload = () => resolve({ name: file.name, content: reader.result as string })
        reader.onerror = () => resolve(null)
        reader.readAsText(file)
      }
      // Some browsers fire onchange instead of oncancel when nothing selected
      window.addEventListener('focus', function onFocus() {
        window.removeEventListener('focus', onFocus)
        setTimeout(() => { if (!input.files?.length) { document.body.contains(input) && document.body.removeChild(input); resolve(null) } }, 300)
      }, { once: true })
      input.click()
    })
  }
}

/** Open an image/audio file and return its data URL (for browser) or file path (for Electron). */
export async function openMediaFile(
  type: 'image' | 'audio'
): Promise<{ name: string; path: string } | null> {
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
  const audioExts = ['mp3', 'ogg', 'wav', 'flac', 'm4a']
  const extensions = type === 'image' ? imageExts : audioExts

  if (isElectron) {
    const filePath = await window.electronAPI!.openFile([
      { name: type === 'image' ? 'Images' : 'Audio', extensions }
    ])
    if (!filePath) return null
    return { name: filePath.split(/[/\\]/).pop()!, path: filePath }
  } else {
    return new Promise(resolve => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = extensions.map(e => `.${e}`).join(',')
      input.style.display = 'none'
      document.body.appendChild(input)
      input.onchange = () => {
        const file = input.files?.[0]
        document.body.removeChild(input)
        if (!file) { resolve(null); return }
        const reader = new FileReader()
        reader.onload = () => resolve({ name: file.name, path: reader.result as string })
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(file)
      }
      window.addEventListener('focus', function onFocus() {
        window.removeEventListener('focus', onFocus)
        setTimeout(() => { if (!input.files?.length) { document.body.contains(input) && document.body.removeChild(input); resolve(null) } }, 300)
      }, { once: true })
      input.click()
    })
  }
}
