import React, { useState } from 'react'
import { useStore } from '../../store'
import type { Asset, AssetType } from '../../types'
import { v4 as uuidv4 } from 'uuid'
import { fileUrl } from '../../utils/fileUrl'
import { isElectron, openMediaFile } from '../../utils/fs'

interface Props {
  type: AssetType
  value: string | null
  assets: Asset[]
  onChange: (id: string | null) => void
  preview?: Asset | null
}

export default function AssetPicker({ type, value, assets, onChange, preview }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const addAsset = useStore(s => s.addAsset)
  const { project } = useStore(s => ({ project: s.project }))

  async function importAsset() {
    const result = await openMediaFile(type)
    if (!result) return

    if (isElectron) {
      // Electron: copy asset to project assets folder
      const projectDir = project.projectPath
        ? project.projectPath.replace(/[/\\][^/\\]+$/, '')
        : null
      if (!projectDir) {
        alert('Please save your project first before importing assets.')
        return
      }
      const destDir = projectDir + '/assets'
      const destPath = await window.electronAPI?.copyAsset(result.path, destDir)
      if (!destPath) return
      const asset: Asset = {
        id: uuidv4(),
        name: result.name.replace(/\.[^.]+$/, ''),
        type,
        filename: result.name,
        path: destPath
      }
      addAsset(asset)
      onChange(asset.id)
    } else {
      // Browser: store as data URL inline
      const asset: Asset = {
        id: uuidv4(),
        name: result.name.replace(/\.[^.]+$/, ''),
        type,
        filename: result.name,
        path: result.path  // data URL
      }
      addAsset(asset)
      onChange(asset.id)
    }
    setShowPicker(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        {preview && type === 'image' ? (
          <img
            src={fileUrl(preview.path)}
            style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #2a3448' }}
            alt={preview.name}
          />
        ) : preview && type === 'audio' ? (
          <span style={{ fontSize: 12, color: '#9aa5bb' }}>♪ {preview.name}</span>
        ) : (
          <span style={{ fontSize: 12, color: '#5e6e8a' }}>{value ? 'Asset not found' : 'None'}</span>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
            onClick={() => setShowPicker(true)}>
            {value ? 'Change' : 'Select'}
          </button>
          {value && (
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => onChange(null)}>Clear</button>
          )}
        </div>
      </div>

      {showPicker && (
        <div className="overlay">
          <div className="modal" style={{ minWidth: 480, maxWidth: 600 }}>
            <div className="modal-title">Select {type === 'image' ? 'Image' : 'Audio'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
              {assets.map(a => (
                <div
                  key={a.id}
                  onClick={() => { onChange(a.id); setShowPicker(false) }}
                  style={{
                    cursor: 'pointer',
                    border: `2px solid ${a.id === value ? '#4a80d4' : '#2a3448'}`,
                    borderRadius: 6,
                    padding: 4,
                    background: '#161b27',
                    width: type === 'image' ? 100 : 'auto'
                  }}
                >
                  {type === 'image' ? (
                    <>
                      <img
                        src={fileUrl(a.path)}
                        style={{ width: 88, height: 60, objectFit: 'cover', borderRadius: 3, display: 'block' }}
                        alt={a.name}
                      />
                      <div style={{ fontSize: 10, color: '#9aa5bb', marginTop: 3, textAlign: 'center' }}>{a.name}</div>
                    </>
                  ) : (
                    <div style={{ padding: '4px 8px', fontSize: 12, color: '#9aa5bb' }}>♪ {a.name}</div>
                  )}
                </div>
              ))}
              {assets.length === 0 && (
                <span style={{ fontSize: 12, color: '#5e6e8a' }}>No {type} assets yet.</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={importAsset}>
                + Import {type === 'image' ? 'Image' : 'Audio'}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowPicker(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
