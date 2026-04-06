import React, { useRef } from 'react'
import { useStore } from '../../store'
import type { StoryNode, DialogueLine, DialoguePosition } from '../../types'

interface Props {
  node: StoryNode
  selectedIndex: number
  onSelect: (i: number) => void
}

const POSITIONS: DialoguePosition[] = ['left', 'center', 'right']

export default function DialogueList({ node, selectedIndex, onSelect }: Props) {
  const { project } = useStore(s => ({ project: s.project }))
  const updateDialogueLines = useStore(s => s.updateDialogueLines)
  const addDialogueLine = useStore(s => s.addDialogueLine)

  const dragIndexRef = useRef<number | null>(null)

  const lines = node.dialogueLines

  function updateLine(i: number, changes: Partial<DialogueLine>) {
    const updated = lines.map((l, j) => j === i ? { ...l, ...changes } : l)
    updateDialogueLines(node.id, updated)
  }

  function deleteLine(i: number) {
    const updated = lines.filter((_, j) => j !== i)
    updateDialogueLines(node.id, updated)
  }

  function handleDragStart(e: React.DragEvent, i: number) {
    dragIndexRef.current = i
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    const dragIndex = dragIndexRef.current
    if (dragIndex === null || dragIndex === dropIndex) return
    const updated = [...lines]
    const [removed] = updated.splice(dragIndex, 1)
    updated.splice(dropIndex, 0, removed)
    updateDialogueLines(node.id, updated)
    dragIndexRef.current = null
  }

  const audioAssets = project.assets.filter(a => a.type === 'audio')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #2a3448', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e8ecf4', marginBottom: 4 }}>Dialogue</div>
        <div style={{ fontSize: 11, color: '#5e6e8a' }}>{lines.length} lines</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {lines.map((line, i) => {
          const speaker = line.speaker ? project.characters.find(c => c.id === line.speaker) : null
          const poses = speaker?.sprites ?? []

          return (
            <div
              key={line.id}
              draggable
              onDragStart={e => handleDragStart(e, i)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, i)}
              onClick={() => onSelect(i)}
              style={{
                background: i === selectedIndex ? '#252d42' : '#161b27',
                border: `1px solid ${i === selectedIndex ? '#4a5a80' : '#2a3448'}`,
                borderRadius: 6,
                marginBottom: 6,
                padding: '8px 10px',
                cursor: 'pointer'
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: '#5e6e8a', cursor: 'grab', fontSize: 14 }}>⠿</span>

                {/* Speaker selector */}
                <select
                  value={line.speaker ?? ''}
                  onChange={e => updateLine(i, { speaker: e.target.value || null, characterPose: null })}
                  style={{ flex: 1, fontSize: 11 }}
                  onClick={e => e.stopPropagation()}
                >
                  <option value="">Narration</option>
                  {project.characters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {/* Position */}
                <select
                  value={line.position}
                  onChange={e => updateLine(i, { position: e.target.value as DialoguePosition })}
                  style={{ width: 70, fontSize: 11 }}
                  onClick={e => e.stopPropagation()}
                >
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                <button
                  className="chip-x"
                  onClick={e => { e.stopPropagation(); deleteLine(i) }}
                >✕</button>
              </div>

              {/* Text */}
              <textarea
                value={line.text}
                onChange={e => updateLine(i, { text: e.target.value })}
                placeholder="Dialogue text…"
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%',
                  minHeight: 50,
                  resize: 'none',
                  fontSize: 12,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: speaker ? speaker.color : '#e8ecf4',
                  padding: 0,
                  fontFamily: 'inherit'
                }}
              />

              {/* Pose & SFX row */}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {poses.length > 0 && (
                  <select
                    value={line.characterPose ?? ''}
                    onChange={e => updateLine(i, { characterPose: e.target.value || null })}
                    style={{ flex: 1, fontSize: 11 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="">— pose —</option>
                    {poses.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                )}
                {audioAssets.length > 0 && (
                  <select
                    value={line.sfx ?? ''}
                    onChange={e => updateLine(i, { sfx: e.target.value || null })}
                    style={{ flex: 1, fontSize: 11 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="">— sfx —</option>
                    {audioAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '8px 10px', borderTop: '1px solid #2a3448', flexShrink: 0 }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', fontSize: 12 }}
          onClick={() => { addDialogueLine(node.id); onSelect(lines.length) }}
        >+ Add line</button>
      </div>
    </div>
  )
}
