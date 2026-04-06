import React, { useState } from 'react'
import { useStore } from '../store'
import type { Character, Sprite } from '../types'
import { v4 as uuidv4 } from 'uuid'
import AssetPicker from './shared/AssetPicker'

interface Props {
  onClose: () => void
}

export default function CharacterManager({ onClose }: Props) {
  const { project } = useStore(s => ({ project: s.project }))
  const addCharacter = useStore(s => s.addCharacter)
  const updateCharacter = useStore(s => s.updateCharacter)
  const deleteCharacter = useStore(s => s.deleteCharacter)

  const [selectedId, setSelectedId] = useState<string | null>(
    project.characters[0]?.id ?? null
  )

  const selected = project.characters.find(c => c.id === selectedId)

  function createCharacter() {
    const char: Character = {
      id: uuidv4(),
      name: 'New Character',
      color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
      sprites: []
    }
    addCharacter(char)
    setSelectedId(char.id)
  }

  function handleDelete(id: string) {
    const usedIn = project.nodes.filter(n => n.chars.includes(id) || n.dialogueLines.some(l => l.speaker === id))
    const msg = usedIn.length
      ? `This character is used in ${usedIn.length} scene(s). Delete anyway?`
      : 'Delete this character?'
    if (!confirm(msg)) return
    deleteCharacter(id)
    setSelectedId(project.characters.find(c => c.id !== id)?.id ?? null)
  }

  function addSprite(charId: string) {
    const char = project.characters.find(c => c.id === charId)
    if (!char) return
    const sprite: Sprite = { id: uuidv4(), label: 'neutral', assetId: '' }
    updateCharacter(charId, { sprites: [...char.sprites, sprite] })
  }

  function updateSprite(charId: string, spriteId: string, changes: Partial<Sprite>) {
    const char = project.characters.find(c => c.id === charId)
    if (!char) return
    updateCharacter(charId, {
      sprites: char.sprites.map(s => s.id === spriteId ? { ...s, ...changes } : s)
    })
  }

  function deleteSprite(charId: string, spriteId: string) {
    const char = project.characters.find(c => c.id === charId)
    if (!char) return
    updateCharacter(charId, { sprites: char.sprites.filter(s => s.id !== spriteId) })
  }

  const imgAssets = project.assets.filter(a => a.type === 'image')

  return (
    <div className="overlay">
      <div style={{
        background: '#1a2032',
        border: '1px solid #2a3448',
        borderRadius: 8,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        minWidth: 600,
        maxWidth: 700,
        width: 660,
        height: '80vh',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a3448', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Characters</h2>
          <button className="btn btn-ghost" style={{ fontSize: 14 }} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Character list */}
          <div style={{ width: 200, borderRight: '1px solid #2a3448', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {project.characters.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: c.id === selectedId ? '#252d42' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 2
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#e8ecf4' }}>{c.name}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: 8, borderTop: '1px solid #2a3448' }}>
              <button className="btn btn-primary" style={{ width: '100%', fontSize: 12 }} onClick={createCharacter}>
                + Add Character
              </button>
            </div>
          </div>

          {/* Character editor */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {!selected ? (
              <div style={{ color: '#5e6e8a', fontSize: 13, marginTop: 20 }}>Select a character to edit</div>
            ) : (
              <>
                {/* Name */}
                <div className="field-row">
                  <label className="field-label">Name</label>
                  <input
                    value={selected.name}
                    onChange={e => updateCharacter(selected.id, { name: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Color */}
                <div className="field-row">
                  <label className="field-label">Dialogue Color</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={selected.color}
                      onChange={e => updateCharacter(selected.id, { color: e.target.value })}
                      style={{ width: 48, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      value={selected.color}
                      onChange={e => updateCharacter(selected.id, { color: e.target.value })}
                      style={{ width: 100, fontFamily: 'monospace', fontSize: 12 }}
                    />
                    <span style={{ color: selected.color, fontWeight: 700, fontSize: 14 }}>Preview text</span>
                  </div>
                </div>

                {/* Sprites */}
                <div className="field-row">
                  <div className="section-header">
                    <span className="section-title">Sprites / Poses</span>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => addSprite(selected.id)}>+ Add sprite</button>
                  </div>
                  {(selected.sprites ?? []).map(sprite => {
                    const asset = project.assets.find(a => a.id === sprite.assetId)
                    return (
                      <div key={sprite.id} style={{
                        background: '#161b27', border: '1px solid #2a3448',
                        borderRadius: 6, padding: '8px 10px', marginBottom: 8,
                        display: 'flex', gap: 10, alignItems: 'center'
                      }}>
                        {asset ? (
                          <img src={`file://${asset.path}`} style={{ width: 50, height: 70, objectFit: 'contain', borderRadius: 3 }} alt={sprite.label} />
                        ) : (
                          <div style={{ width: 50, height: 70, background: '#2a3448', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#5e6e8a' }}>No img</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: 6 }}>
                            <label className="field-label">Label</label>
                            <input
                              value={sprite.label}
                              onChange={e => updateSprite(selected.id, sprite.id, { label: e.target.value })}
                              style={{ width: '100%', fontSize: 12 }}
                              placeholder="e.g. neutral, happy, sad"
                            />
                          </div>
                          <AssetPicker
                            type="image"
                            value={sprite.assetId || null}
                            assets={imgAssets}
                            onChange={id => updateSprite(selected.id, sprite.id, { assetId: id ?? '' })}
                            preview={asset}
                          />
                        </div>
                        <button className="chip-x" onClick={() => deleteSprite(selected.id, sprite.id)}>✕</button>
                      </div>
                    )
                  })}
                  {(selected.sprites ?? []).length === 0 && (
                    <div style={{ fontSize: 12, color: '#5e6e8a' }}>No sprites. Add one above.</div>
                  )}
                </div>

                <button className="btn btn-danger" style={{ fontSize: 12, marginTop: 8 }}
                  onClick={() => handleDelete(selected.id)}>Delete Character</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
