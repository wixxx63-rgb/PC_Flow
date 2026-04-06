import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store'
import type { WriterRoomSection } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  onClose: () => void
}

export default function WritersRoom({ onClose }: Props) {
  const { sections, updateSection, addSection, deleteSection, reorderSections } = useStore(s => ({
    sections: [...s.project.writerRoom].sort((a, b) => a.order - b.order),
    updateSection: s.updateWriterRoomSection,
    addSection: s.addWriterRoomSection,
    deleteSection: s.deleteWriterRoomSection,
    reorderSections: s.reorderWriterRoomSections,
  }))

  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragOverRef = useRef<string | null>(null)

  const selected = sections.find(s => s.id === selectedId)

  function handleAddSection() {
    const newSec: WriterRoomSection = {
      id: uuidv4(),
      title: 'New Section',
      content: '',
      order: sections.length,
    }
    addSection(newSec)
    setSelectedId(newSec.id)
    setEditingTitleId(newSec.id)
    setTitleDraft('New Section')
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this section?')) return
    deleteSection(id)
    if (selectedId === id) {
      const remaining = sections.filter(s => s.id !== id)
      setSelectedId(remaining[0]?.id ?? null)
    }
  }

  function handleTitleBlur(id: string) {
    if (titleDraft.trim()) {
      updateSection(id, { title: titleDraft.trim() })
    }
    setEditingTitleId(null)
  }

  function handleContentChange(id: string, content: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateSection(id, { content })
    }, 500)
  }

  // Drag reorder
  const [dragId, setDragId] = useState<string | null>(null)

  function handleDragStart(id: string) {
    setDragId(id)
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    dragOverRef.current = overId
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (!dragId || !dragOverRef.current || dragId === dragOverRef.current) {
      setDragId(null)
      return
    }
    const sorted = [...sections]
    const fromIdx = sorted.findIndex(s => s.id === dragId)
    const toIdx = sorted.findIndex(s => s.id === dragOverRef.current)
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); return }
    const [item] = sorted.splice(fromIdx, 1)
    sorted.splice(toIdx, 0, item)
    const reordered = sorted.map((s, i) => ({ ...s, order: i }))
    reorderSections(reordered)
    dragOverRef.current = null
    setDragId(null)
  }

  // Move up/down buttons
  function moveSection(id: string, dir: -1 | 1) {
    const sorted = [...sections]
    const idx = sorted.findIndex(s => s.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= sorted.length) return
    const [item] = sorted.splice(idx, 1)
    sorted.splice(newIdx, 0, item)
    reorderSections(sorted.map((s, i) => ({ ...s, order: i })))
  }

  return (
    <div
      style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 420, zIndex: 50,
        background: '#161b27',
        borderRight: '1px solid #2a3448',
        display: 'flex', flexDirection: 'column',
        boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid #2a3448',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#e8ecf4' }}>Writer's Room</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" onClick={handleAddSection} style={{ fontSize: 12, padding: '3px 10px' }}>
            + Section
          </button>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 14, padding: '2px 7px' }}>✕</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Section list */}
        <div style={{
          width: 150, borderRight: '1px solid #2a3448',
          overflowY: 'auto', flexShrink: 0,
          padding: '8px 0',
        }}>
          {sections.map(sec => (
            <div
              key={sec.id}
              draggable
              onDragStart={() => handleDragStart(sec.id)}
              onDragOver={e => handleDragOver(e, sec.id)}
              onDrop={handleDrop}
              onClick={() => setSelectedId(sec.id)}
              style={{
                padding: '7px 10px',
                cursor: 'pointer',
                background: selectedId === sec.id ? '#1a2032' : 'transparent',
                borderLeft: `3px solid ${selectedId === sec.id ? '#4a80d4' : 'transparent'}`,
                color: selectedId === sec.id ? '#e8ecf4' : '#9aa5bb',
                fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: dragId === sec.id ? 0.4 : 1,
                userSelect: 'none',
              }}
            >
              <span style={{ cursor: 'grab', color: '#5e6e8a', fontSize: 11, flexShrink: 0 }}>⠿</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sec.title}
              </span>
            </div>
          ))}
          {sections.length === 0 && (
            <div style={{ padding: '20px 10px', color: '#5e6e8a', fontSize: 12, textAlign: 'center' }}>
              No sections
            </div>
          )}
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {selected ? (
            <>
              {/* Section title bar */}
              <div style={{
                padding: '8px 12px', borderBottom: '1px solid #2a3448',
                display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              }}>
                {editingTitleId === selected.id ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={e => setTitleDraft(e.target.value)}
                    onBlur={() => handleTitleBlur(selected.id)}
                    onKeyDown={e => { if (e.key === 'Enter') handleTitleBlur(selected.id) }}
                    style={{
                      flex: 1, background: '#0f1117', border: '1px solid #3a4a68',
                      borderRadius: 4, color: '#e8ecf4', fontSize: 13, padding: '3px 6px',
                    }}
                  />
                ) : (
                  <span
                    onClick={() => { setEditingTitleId(selected.id); setTitleDraft(selected.title) }}
                    style={{ flex: 1, color: '#e8ecf4', fontSize: 13, cursor: 'text', fontWeight: 600 }}
                    title="Click to rename"
                  >
                    {selected.title}
                  </span>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={() => moveSection(selected.id, -1)}
                  disabled={sections.indexOf(selected) === 0}
                  style={{ fontSize: 12, padding: '2px 6px' }}
                  title="Move up"
                >▲</button>
                <button
                  className="btn btn-ghost"
                  onClick={() => moveSection(selected.id, 1)}
                  disabled={sections.indexOf(selected) === sections.length - 1}
                  style={{ fontSize: 12, padding: '2px 6px' }}
                  title="Move down"
                >▼</button>
                <button
                  className="btn btn-ghost"
                  onClick={() => handleDelete(selected.id)}
                  style={{ fontSize: 12, padding: '2px 6px', color: '#d04040' }}
                  title="Delete section"
                >✕</button>
              </div>

              {/* Textarea */}
              <textarea
                key={selected.id}
                defaultValue={selected.content}
                onChange={e => handleContentChange(selected.id, e.target.value)}
                placeholder="Write your notes here..."
                style={{
                  flex: 1, resize: 'none',
                  background: '#0f1117',
                  border: 'none', outline: 'none',
                  color: '#e8ecf4', fontSize: 13, lineHeight: 1.7,
                  padding: '14px 16px',
                  fontFamily: 'inherit',
                }}
              />
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#5e6e8a', fontSize: 13,
            }}>
              Select a section or add one
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
