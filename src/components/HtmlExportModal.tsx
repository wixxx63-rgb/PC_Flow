import React, { useState, useCallback, useMemo } from 'react'
import { useStore } from '../store'
import { generateHtmlExport } from '../utils/htmlExport'

interface Props {
  onClose: () => void
}

type ExportState = 'idle' | 'running' | 'done' | 'error'

export default function HtmlExportModal({ onClose }: Props) {
  const { project } = useStore(s => ({ project: s.project }))

  // Assets that have a path set but the path looks potentially missing (empty or blank)
  const missingAssets = useMemo(() =>
    project.assets.filter(a => !a.path || !a.path.trim()),
    [project.assets]
  )

  const [state, setState] = useState<ExportState>('idle')
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleExport = useCallback(async () => {
    // Ask user for save path
    const savePath = await window.electronAPI?.saveFile(
      [{ name: 'HTML File', extensions: ['html'] }],
      (project.name || 'story').replace(/[^a-zA-Z0-9_-]/g, '_') + '.html'
    )
    if (!savePath) return

    setState('running')
    setProgress(0)
    setProgressMsg('Starting…')
    setErrorMsg(null)

    try {
      const html = await generateHtmlExport(project, (pct, msg) => {
        setProgress(pct)
        setProgressMsg(msg)
      })

      setProgress(95)
      setProgressMsg('Writing file…')

      const ok = await window.electronAPI?.writeFile(savePath, html)
      if (!ok) throw new Error('Failed to write output file.')

      setProgress(100)
      setProgressMsg('Done!')
      setOutputPath(savePath)
      setState('done')
    } catch (err: any) {
      setErrorMsg(err?.message ?? String(err))
      setState('error')
    }
  }, [project])

  function handleOpenFolder() {
    if (outputPath) window.electronAPI?.showItemInFolder(outputPath)
  }

  return (
    <div className="overlay" onClick={state === 'running' ? e => e.stopPropagation() : onClose}>
      <div
        className="modal"
        style={{ width: 480 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e8ecf4' }}>Export Playable HTML</span>
          {state !== 'running' && (
            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
          )}
        </div>

        {/* Idle: info + button */}
        {state === 'idle' && (
          <>
            <div style={{ fontSize: 13, color: '#9aa5bb', lineHeight: 1.6, marginBottom: 16 }}>
              Exports a single self-contained <code style={{ color: '#4a80d4' }}>.html</code> file that
              plays your story in any web browser. All assets (images, audio) are embedded as base64
              — no server or internet connection needed.
            </div>
            <div style={{
              background: '#1a2032', borderRadius: 6, padding: '10px 12px',
              marginBottom: 18, fontSize: 12, color: '#9aa5bb',
            }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#e8ecf4' }}>Nodes:</span> {project.nodes.length}
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#e8ecf4' }}>Assets to embed:</span> {project.assets.filter(a => a.path).length}
              </div>
              <div style={{ marginBottom: missingAssets.length > 0 ? 6 : 0 }}>
                <span style={{ color: '#e8ecf4' }}>Characters:</span> {project.characters.length}
              </div>
              {missingAssets.length > 0 && (
                <div style={{ marginTop: 6, padding: '6px 8px', background: '#2a1010', borderRadius: 4, borderLeft: '3px solid #d04040' }}>
                  <div style={{ color: '#d04040', fontWeight: 600, marginBottom: 3 }}>
                    ⚠ {missingAssets.length} asset{missingAssets.length !== 1 ? 's' : ''} may be missing:
                  </div>
                  {missingAssets.slice(0, 3).map(a => (
                    <div key={a.id} style={{ color: '#d08080', fontSize: 11, marginTop: 1 }}>• {a.name}</div>
                  ))}
                  {missingAssets.length > 3 && (
                    <div style={{ color: '#d08080', fontSize: 11 }}>…and {missingAssets.length - 3} more</div>
                  )}
                  <div style={{ color: '#9aa5bb', fontSize: 11, marginTop: 4 }}>These will be skipped during export.</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExport} style={{ fontSize: 13, padding: '6px 18px' }}>
                Choose Output &amp; Export
              </button>
            </div>
          </>
        )}

        {/* Running: progress bar */}
        {state === 'running' && (
          <div>
            <div style={{ fontSize: 13, color: '#9aa5bb', marginBottom: 12 }}>
              {progressMsg}
            </div>
            <div style={{
              height: 8, background: '#0f1117', borderRadius: 4, overflow: 'hidden', marginBottom: 8,
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: '#4a80d4',
                borderRadius: 4,
                transition: 'width 0.2s ease',
              }} />
            </div>
            <div style={{ fontSize: 11, color: '#5e6e8a', textAlign: 'right' }}>{progress}%</div>
          </div>
        )}

        {/* Done */}
        {state === 'done' && outputPath && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
              color: '#40a060', fontSize: 14, fontWeight: 600,
            }}>
              <span style={{ fontSize: 20 }}>✓</span>
              Export complete
            </div>
            <div style={{
              background: '#1a2032', borderRadius: 6, padding: '8px 12px',
              fontSize: 12, color: '#9aa5bb', wordBreak: 'break-all', marginBottom: 16,
              fontFamily: 'monospace',
            }}>
              {outputPath}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={handleOpenFolder} style={{ fontSize: 13 }}>
                Open Folder
              </button>
              <button className="btn btn-primary" onClick={onClose} style={{ fontSize: 13, padding: '6px 14px' }}>
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div>
            <div style={{
              color: '#d04040', fontSize: 14, fontWeight: 600, marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>✖</span> Export failed
            </div>
            {errorMsg && (
              <div style={{
                background: '#1a2032', borderRadius: 6, padding: '8px 12px',
                fontSize: 12, color: '#d04040', marginBottom: 16, wordBreak: 'break-all',
                fontFamily: 'monospace',
              }}>
                {errorMsg}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Close</button>
              <button className="btn btn-primary" onClick={() => { setState('idle'); setErrorMsg(null) }} style={{ fontSize: 13, padding: '6px 14px' }}>
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
