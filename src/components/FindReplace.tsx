import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../store'

interface Match {
  nodeId: string
  field: string
  lineIndex?: number
}

export default function FindReplace() {
  const { project, searchQuery, setSearchQuery, setFindBarOpen, navigateTo,
    snapshotForUndo, updateNode, setCanvasTransform, canvasTransform } = useStore(s => ({
    project: s.project,
    searchQuery: s.searchQuery,
    setSearchQuery: s.setSearchQuery,
    setFindBarOpen: s.setFindBarOpen,
    navigateTo: s.navigateTo,
    snapshotForUndo: s.snapshotForUndo,
    updateNode: s.updateNode,
    setCanvasTransform: s.setCanvasTransform,
    canvasTransform: s.canvasTransform
  }))

  const [replaceText, setReplaceText] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const findInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { findInputRef.current?.focus() }, [])

  // Reset match index when query changes
  useEffect(() => { setMatchIndex(0) }, [searchQuery])

  const matches = useMemo((): Match[] => {
    if (!searchQuery) return []
    const q = searchQuery.toLowerCase()
    const result: Match[] = []
    project.nodes.forEach(n => {
      const fields: [string, string][] = [
        ['title', n.title], ['summary', n.summary], ['trigger', n.trigger],
        ['dialogue', n.dialogue], ['grokHandoff', n.grokHandoff], ['consequences', n.consequences]
      ]
      fields.forEach(([field, val]) => {
        if (val?.toLowerCase().includes(q)) result.push({ nodeId: n.id, field })
      })
      n.dialogueLines.forEach((line, li) => {
        if (line.text.toLowerCase().includes(q)) result.push({ nodeId: n.id, field: 'dialogueLine', lineIndex: li })
      })
    })
    return result
  }, [searchQuery, project.nodes])

  const uniqueNodeIds = useMemo(() => [...new Set(matches.map(m => m.nodeId))], [matches])

  function centerOnNode(nodeId: string) {
    const node = project.nodes.find(n => n.id === nodeId)
    if (!node) return
    setCanvasTransform({ ...canvasTransform, x: -node.x + 600, y: -node.y + 300 })
  }

  function goToMatch(idx: number) {
    if (!matches.length) return
    const i = ((idx % matches.length) + matches.length) % matches.length
    setMatchIndex(i)
    const m = matches[i]
    navigateTo(m.nodeId)
    centerOnNode(m.nodeId)
  }

  function handleReplace() {
    if (!searchQuery || !matches.length) return
    const m = matches[matchIndex % matches.length]
    const node = project.nodes.find(n => n.id === m.nodeId)
    if (!node) return
    snapshotForUndo('field_edited')
    if (m.field === 'dialogueLine' && m.lineIndex !== undefined) {
      const lines = node.dialogueLines.map((l, i) =>
        i === m.lineIndex ? { ...l, text: l.text.replace(searchQuery, replaceText) } : l
      )
      updateNode(node.id, { dialogueLines: lines })
    } else {
      const val = (node as any)[m.field] as string
      updateNode(node.id, { [m.field]: val.replace(searchQuery, replaceText) } as any)
    }
  }

  function handleReplaceAll() {
    if (!searchQuery || !matches.length) return
    if (!confirm(`Replace all ${matches.length} match(es) of "${searchQuery}" with "${replaceText}"?`)) return
    snapshotForUndo('field_edited')
    const nodeUpdates = new Map<string, any>()
    matches.forEach(m => {
      const node = project.nodes.find(n => n.id === m.nodeId)
      if (!node) return
      const pending = nodeUpdates.get(m.nodeId) ?? { ...node }
      if (m.field === 'dialogueLine' && m.lineIndex !== undefined) {
        const lines = [...pending.dialogueLines]
        lines[m.lineIndex] = { ...lines[m.lineIndex], text: lines[m.lineIndex].text.replaceAll(searchQuery, replaceText) }
        pending.dialogueLines = lines
      } else {
        pending[m.field] = (pending[m.field] as string).replaceAll(searchQuery, replaceText)
      }
      nodeUpdates.set(m.nodeId, pending)
    })
    nodeUpdates.forEach((changes, id) => updateNode(id, changes))
    setSearchQuery('')
  }

  function close() {
    setFindBarOpen(false)
    setSearchQuery('')
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      zIndex: 4,
      background: '#161b27',
      borderBottom: '1px solid #2a3448',
      padding: '6px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }}>
      {/* Row 1: Find */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#5e6e8a', width: 52, textAlign: 'right', flexShrink: 0 }}>Find</span>
        <input
          ref={findInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') goToMatch(matchIndex + 1)
            if (e.key === 'Escape') close()
          }}
          placeholder="Search all nodes…"
          style={{ flex: 1, fontSize: 13, maxWidth: 320 }}
        />
        <span style={{ fontSize: 12, color: '#5e6e8a', minWidth: 100 }}>
          {searchQuery
            ? `${matches.length} match${matches.length !== 1 ? 'es' : ''} in ${uniqueNodeIds.length} node${uniqueNodeIds.length !== 1 ? 's' : ''}`
            : ''}
        </span>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }}
          disabled={!matches.length}
          onClick={() => goToMatch(matchIndex - 1)}>◀ Prev</button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }}
          disabled={!matches.length}
          onClick={() => goToMatch(matchIndex + 1)}>Next ▶</button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 6px' }}
          onClick={close}>✕</button>
      </div>
      {/* Row 2: Replace */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#5e6e8a', width: 52, textAlign: 'right', flexShrink: 0 }}>Replace</span>
        <input
          value={replaceText}
          onChange={e => setReplaceText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') close() }}
          placeholder="Replacement text…"
          style={{ flex: 1, fontSize: 13, maxWidth: 320 }}
        />
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }}
          disabled={!matches.length}
          onClick={handleReplace}>Replace</button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }}
          disabled={!matches.length}
          onClick={handleReplaceAll}>Replace All</button>
      </div>
    </div>
  )
}
