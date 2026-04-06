import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import type { StoryNode, Branch, NodeType, NodeStatus, BlockType, TransitionType } from '../../types'
import { v4 as uuidv4 } from 'uuid'
import AddChoicesForm from './AddChoicesForm'
import DependencyMap from './DependencyMap'

// ── POV helpers ────────────────────────────────────────────────────────────

/** Return all POV nodes for a character in BFS graph-traversal order */
function getPovNodesOrdered(charId: string, nodes: StoryNode[], edges: { from: string; to: string }[]): StoryNode[] {
  const edgeMap = new Map<string, string[]>()
  edges.forEach(e => {
    if (!edgeMap.has(e.from)) edgeMap.set(e.from, [])
    edgeMap.get(e.from)!.push(e.to)
  })
  const hasIncoming = new Set(edges.map(e => e.to))
  const visited = new Set<string>()
  const result: StoryNode[] = []
  const queue = nodes.filter(n => !hasIncoming.has(n.id)).map(n => n.id)
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const n = nodes.find(nd => nd.id === id)
    if (n?.isPov && n.povCharacter === charId) result.push(n)
    ;(edgeMap.get(id) ?? []).forEach(nid => queue.push(nid))
  }
  nodes.forEach(n => { if (n.isPov && n.povCharacter === charId && !visited.has(n.id)) result.push(n) })
  return result
}

const NODE_TYPES: NodeType[] = ['scene', 'decision', 'grok', 'death', 'ending']
const STATUS_OPTIONS: { value: NodeStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'inprog', label: 'In Progress' },
  { value: 'done', label: 'Done' }
]
const BLOCKS: (BlockType | '')[] = ['', 'Morning', 'Afternoon', 'Evening', 'Night', 'All']
const TRANSITIONS: TransitionType[] = ['fade', 'cut', 'slide-left', 'slide-right']

export default function DetailPanel() {
  const {
    project, selectedNodeId, panelNavHistory, mode
  } = useStore(s => ({
    project: s.project,
    selectedNodeId: s.selectedNodeId,
    panelNavHistory: s.panelNavHistory,
    mode: s.mode
  }))

  const updateNode = useStore(s => s.updateNode)
  const deleteNode = useStore(s => s.deleteNode)
  const deleteEdge = useStore(s => s.deleteEdge)
  const navigateTo = useStore(s => s.navigateTo)
  const setSelectedNode = useStore(s => s.setSelectedNode)
  const setMode = useStore(s => s.setMode)
  const addEdge = useStore(s => s.addEdge)
  const createNodeAt = useStore(s => s.createNodeAt)
  const duplicateNode = useStore(s => s.duplicateNode)
  const snapshotForUndo = useStore(s => s.snapshotForUndo)
  const createPovNode = useStore(s => s.createPovNode)

  const [showAddChoices, setShowAddChoices] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDepsMap, setShowDepsMap] = useState(false)
  const [showPovForm, setShowPovForm] = useState(false)
  const [povCharSelect, setPovCharSelect] = useState('')
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Cancel pending debounced updates when unmounting or switching nodes
  useEffect(() => {
    return () => { Object.values(debounceRef.current).forEach(clearTimeout) }
  }, [selectedNodeId])

  const nodeOrUndef = project.nodes.find(n => n.id === selectedNodeId)

  if (!nodeOrUndef || mode !== 'graph') return null

  const node: StoryNode = nodeOrUndef

  const outgoingEdges = project.edges.filter(e => e.from === node.id)
  const incomingEdges = project.edges.filter(e => e.to === node.id)
  const allPaths = [...new Set(project.nodes.map(n => n.path).filter(Boolean))]

  function debounceUpdate(field: string, value: unknown) {
    if (debounceRef.current[field]) clearTimeout(debounceRef.current[field])
    debounceRef.current[field] = setTimeout(() => {
      snapshotForUndo('field_edited')
      updateNode(node.id, { [field]: value } as Partial<StoryNode>)
    }, 800)
  }

  function handleDelete() {
    deleteNode(node.id)
    setShowDeleteConfirm(false)
  }

  function handleNext() {
    // POV node: navigate to next POV node of same character
    if (node.isPov && node.povCharacter) {
      const ordered = getPovNodesOrdered(node.povCharacter, project.nodes, project.edges)
      const idx = ordered.findIndex(n => n.id === node.id)
      if (idx >= 0 && idx < ordered.length - 1) { navigateTo(ordered[idx + 1].id); return }
      return
    }
    const sequential = outgoingEdges.filter(e => !e.label)
    if (sequential.length >= 1) {
      navigateTo(sequential[0].to)
      return
    }
    const newNode = createNodeAt(node.x, node.y + 220)
    addEdge({ id: uuidv4(), from: node.id, to: newNode.id, label: '', desc: '', isDeath: false })
    navigateTo(newNode.id)
  }

  function handlePrevious() {
    // POV node: navigate to previous POV node of same character
    if (node.isPov && node.povCharacter) {
      const ordered = getPovNodesOrdered(node.povCharacter, project.nodes, project.edges)
      const idx = ordered.findIndex(n => n.id === node.id)
      if (idx > 0) { navigateTo(ordered[idx - 1].id); return }
      return
    }
    if (incomingEdges.length === 1) {
      navigateTo(incomingEdges[0].from)
    }
    // If multiple, show dropdown (handled via state)
  }

  const [showPrevDropdown, setShowPrevDropdown] = useState(false)

  // POV context: main path nodes immediately before/after this POV node
  const povMainContext = (() => {
    if (!node.isPov) return null
    let prevId: string | null = incomingEdges[0]?.from ?? null
    while (prevId) {
      const pn = project.nodes.find(n => n.id === prevId)
      if (!pn?.isPov) break
      prevId = project.edges.find(e => e.to === prevId && !e.label)?.from ?? null
    }
    let nextId: string | null = outgoingEdges.find(e => !e.label)?.to ?? null
    while (nextId) {
      const nn = project.nodes.find(n => n.id === nextId)
      if (!nn?.isPov) break
      nextId = project.edges.find(e => e.from === nextId && !e.label)?.to ?? null
    }
    return { prevMainId: prevId, nextMainId: nextId }
  })()

  // POV scenes inserted after this main path node (before next main path node)
  const povScenesAtPoint = (() => {
    if (node.isPov) return []
    const result: StoryNode[] = []
    let cur: string | null = outgoingEdges.find(e => !e.label)?.to ?? null
    while (cur) {
      const n2 = project.nodes.find(nd => nd.id === cur)
      if (!n2?.isPov) break
      result.push(n2)
      cur = project.edges.find(e => e.from === cur && !e.label)?.to ?? null
    }
    return result
  })()

  function handleCreatePov() {
    if (!povCharSelect) return
    const newNode = createPovNode(node.id, povCharSelect)
    if (newNode) { setShowPovForm(false); setPovCharSelect(''); navigateTo(newNode.id) }
  }

  const povChar = node.isPov ? project.characters.find(c => c.id === node.povCharacter) : null
  const nextPovNode = (() => {
    if (!node.isPov || !node.povCharacter) return null
    const ordered = getPovNodesOrdered(node.povCharacter, project.nodes, project.edges)
    const idx = ordered.findIndex(n => n.id === node.id)
    return idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null
  })()

  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 400,
      background: '#1a2032',
      borderLeft: '1px solid #2a3448',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 5,
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #2a3448', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`badge badge-${node.type}`}>{node.type}</span>
            {node.isPov && povChar && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                background: povChar.color + '22', color: povChar.color,
                border: `1px solid ${povChar.color}60`
              }}>POV · {povChar.name}</span>
            )}
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '2px 6px', fontSize: 16 }}
            onClick={() => setSelectedNode(null)}
          >✕</button>
        </div>

        <EditableTitle node={node} onUpdate={v => { snapshotForUndo('field_edited'); updateNode(node.id, { title: v }) }} />

        <div style={{ fontSize: 11, color: '#5e6e8a', marginTop: 4, display: 'flex', gap: 8 }}>
          <span>{node.id}</span>
          {node.path && <span>Path: {node.path}</span>}
          {node.day != null && <span>Day {node.day}</span>}
          {node.block && <span>{node.block}</span>}
        </div>
      </div>

      {/* Navigation breadcrumb */}
      {panelNavHistory.length > 0 && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #2a3448', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {panelNavHistory.map((id, i) => (
            <React.Fragment key={id + i}>
              <span className="chip" onClick={() => navigateTo(id)} style={{ fontSize: 11 }}>{id}</span>
              {i < panelNavHistory.length - 1 && <span style={{ color: '#5e6e8a', fontSize: 12 }}>→</span>}
            </React.Fragment>
          ))}
          <span style={{ color: '#5e6e8a', fontSize: 12 }}>→</span>
          <span style={{ fontSize: 11, color: '#9aa5bb', fontWeight: 600 }}>{node.id}</span>
        </div>
      )}

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* POV Assignment */}
        <div className="field-row">
          <div className="section-header">
            <span className="section-title">POV</span>
          </div>
          {!node.isPov ? (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, color: '#9060d0', borderColor: '#9060d060' }}
              onClick={() => {
                if (project.characters.length === 0) { alert('Create characters first in the Characters tab.'); return }
                snapshotForUndo('field_edited')
                updateNode(node.id, { isPov: true, povCharacter: project.characters[0].id })
              }}
            >Mark as POV scene…</button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={node.povCharacter ?? ''}
                onChange={e => { snapshotForUndo('field_edited'); updateNode(node.id, { povCharacter: e.target.value }) }}
                style={{ flex: 1, fontSize: 12 }}
              >
                {project.characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, color: '#e06060', flexShrink: 0 }}
                onClick={() => { snapshotForUndo('field_edited'); updateNode(node.id, { isPov: false, povCharacter: null }) }}
              >Remove POV</button>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="field-row">
          <label className="field-label">Status</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className="btn"
                style={{
                  flex: 1,
                  background: node.status === opt.value ? '#2d3750' : 'transparent',
                  border: `1px solid ${node.status === opt.value ? '#4a5a80' : '#2a3448'}`,
                  color: node.status === opt.value ? '#e8ecf4' : '#5e6e8a',
                  fontSize: 12, padding: '4px 8px'
                }}
                onClick={() => updateNode(node.id, { status: opt.value })}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div className="field-row">
          <label className="field-label">Type</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {NODE_TYPES.map(t => (
              <button
                key={t}
                className={`badge badge-${t}`}
                style={{
                  cursor: 'pointer',
                  opacity: node.type === t ? 1 : 0.4,
                  padding: '3px 10px'
                }}
                onClick={() => updateNode(node.id, { type: t })}
              >{t}</button>
            ))}
          </div>
        </div>

        {/* Day & Block */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Day</label>
            <input
              type="number"
              defaultValue={node.day ?? ''}
              onChange={e => debounceUpdate('day', e.target.value ? Number(e.target.value) : null)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Block</label>
            <select
              value={node.block ?? ''}
              onChange={e => updateNode(node.id, { block: (e.target.value as BlockType) || null })}
              style={{ width: '100%' }}
            >
              {BLOCKS.map(b => <option key={b} value={b}>{b || '—'}</option>)}
            </select>
          </div>
        </div>

        {/* Path */}
        <div className="field-row">
          <label className="field-label">Path</label>
          <input
            list="paths-datalist"
            defaultValue={node.path}
            onChange={e => debounceUpdate('path', e.target.value)}
            placeholder="e.g. A, B, ALT"
            style={{ width: '100%' }}
          />
          <datalist id="paths-datalist">
            {allPaths.map(p => <option key={p} value={p} />)}
          </datalist>
        </div>

        {/* Trigger */}
        <div className="field-row">
          <label className="field-label">Trigger Condition</label>
          <input
            defaultValue={node.trigger}
            onChange={e => debounceUpdate('trigger', e.target.value)}
            placeholder="What activates this scene"
            style={{ width: '100%' }}
          />
        </div>

        {/* Summary */}
        <div className="field-row">
          <label className="field-label">Summary</label>
          <AutoGrowTextarea
            value={node.summary}
            onChange={v => debounceUpdate('summary', v)}
            placeholder="Structural notes about what happens"
          />
        </div>

        {/* Characters */}
        <div className="field-row">
          <label className="field-label">Characters</label>
          <CharacterTagInput
            chars={node.chars}
            characters={project.characters}
            onChange={chars => updateNode(node.id, { chars })}
          />
        </div>

        {/* Main path context — shown for POV nodes */}
        {node.isPov && povMainContext && (
          <div className="field-row">
            <div className="section-header">
              <span className="section-title">Main path context</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#9aa5bb' }}>
              {povMainContext.prevMainId ? (
                <span className="chip" onClick={() => navigateTo(povMainContext.prevMainId!)}>
                  ◀ {povMainContext.prevMainId}
                </span>
              ) : <span style={{ color: '#5e6e8a' }}>← start</span>}
              <span style={{ color: '#5e6e8a' }}>→ [this POV] →</span>
              {povMainContext.nextMainId ? (
                <span className="chip" onClick={() => navigateTo(povMainContext.nextMainId!)}>
                  {povMainContext.nextMainId} ▶
                </span>
              ) : <span style={{ color: '#5e6e8a' }}>end →</span>}
            </div>
          </div>
        )}

        {/* POV scenes at this point — shown for main path nodes */}
        {!node.isPov && povScenesAtPoint.length > 0 && (
          <div className="field-row">
            <div className="section-header">
              <span className="section-title">POV scenes at this point</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {povScenesAtPoint.map(pn => {
                const pChar = project.characters.find(c => c.id === pn.povCharacter)
                return (
                  <span
                    key={pn.id}
                    className="chip"
                    onClick={() => navigateTo(pn.id)}
                    style={{ color: pChar?.color ?? '#9aa5bb', borderColor: (pChar?.color ?? '#3a4a68') + '60' }}
                  >
                    {pChar?.name ?? '?'} · {pn.id}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Branches */}
        <div className="field-row">
          <div className="section-header">
            <span className="section-title">Branches</span>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => {
                const newBranch: Branch = {
                  option: String.fromCharCode(65 + node.branches.length),
                  desc: '',
                  leads: [],
                  effects: [],
                  condition: null
                }
                updateNode(node.id, { branches: [...node.branches, newBranch] })
              }}
            >+ Add branch</button>
          </div>
          {node.branches.map((branch, i) => (
            <BranchRow
              key={i}
              branch={branch}
              nodes={project.nodes}
              onUpdate={(updated) => {
                const branches = [...node.branches]
                branches[i] = updated
                updateNode(node.id, { branches })
              }}
              onDelete={() => {
                const branches = node.branches.filter((_, j) => j !== i)
                updateNode(node.id, { branches })
              }}
              onNavigate={navigateTo}
              onCreate={(_id) => {
                const newNode = createNodeAt(node.x + (i - node.branches.length / 2) * 280, node.y + 220)
                // override id isn't possible but we update the branch leads
                const updated = { ...branch, leads: [...branch.leads, newNode.id] }
                const branches = [...node.branches]
                branches[i] = updated
                updateNode(node.id, { branches })
                addEdge({ id: uuidv4(), from: node.id, to: newNode.id, label: branch.option, desc: '', isDeath: false })
                navigateTo(newNode.id)
              }}
            />
          ))}
        </div>

        {/* Connections */}
        <div className="field-row">
          <div className="section-header">
            <span className="section-title">Outgoing</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {outgoingEdges.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="chip" onClick={() => navigateTo(e.to)}>
                  {e.label ? `[${e.label}] ` : ''}{e.to}
                </span>
                <button
                  className="chip-x"
                  title="Remove edge"
                  onClick={() => { if (confirm(`Remove edge to ${e.to}?`)) deleteEdge(e.id) }}
                >✕</button>
              </div>
            ))}
            {outgoingEdges.length === 0 && <span style={{ fontSize: 12, color: '#5e6e8a' }}>None</span>}
          </div>
          <div className="section-header" style={{ marginTop: 8 }}>
            <span className="section-title">Incoming</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {incomingEdges.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="chip" onClick={() => navigateTo(e.from)}>
                  {e.label ? `[${e.label}] ` : ''}{e.from}
                </span>
                <button
                  className="chip-x"
                  title="Remove edge"
                  onClick={() => { if (confirm(`Remove edge from ${e.from}?`)) deleteEdge(e.id) }}
                >✕</button>
              </div>
            ))}
            {incomingEdges.length === 0 && <span style={{ fontSize: 12, color: '#5e6e8a' }}>None</span>}
          </div>
        </div>

        {/* Scene content summary */}
        <div className="field-row">
          <div className="section-header">
            <span className="section-title">Scene Content</span>
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => setMode('scene', node.id)}
            >Edit Scene</button>
          </div>
          <div style={{ fontSize: 12, color: '#9aa5bb', display: 'flex', gap: 12 }}>
            <span>{node.dialogueLines.length} dialogue lines</span>
            {node.background && <span>⬛ BG set</span>}
            {node.music && (() => {
              const a = project.assets.find(a => a.id === node.music)
              return a ? <span>♪ {a.name}</span> : null
            })()}
          </div>
        </div>

        {/* Transition */}
        <div className="field-row">
          <label className="field-label">Scene Transition</label>
          <select
            value={node.transition}
            onChange={e => updateNode(node.id, { transition: e.target.value as TransitionType })}
            style={{ width: '100%' }}
          >
            {TRANSITIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Grok Handoff */}
        {node.type === 'grok' && (
          <div className="field-row">
            <label className="field-label" style={{ color: '#9060d0' }}>Grok Handoff</label>
            <AutoGrowTextarea
              value={node.grokHandoff}
              onChange={v => debounceUpdate('grokHandoff', v)}
              placeholder="Situation description for explicit content handoff"
              style={{ borderColor: '#9060d0', background: '#200840' }}
            />
          </div>
        )}

        {/* Consequences */}
        <div className="field-row">
          <label className="field-label">Consequences</label>
          <AutoGrowTextarea
            value={node.consequences}
            onChange={v => debounceUpdate('consequences', v)}
            placeholder="Downstream story effects"
          />
        </div>

        {/* Dialogue notes */}
        <div className="field-row">
          <label className="field-label">Notes</label>
          <AutoGrowTextarea
            value={node.dialogue}
            onChange={v => debounceUpdate('dialogue', v)}
            placeholder="Freeform writing notes"
          />
        </div>

      </div>

      {/* Footer controls */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #2a3448', flexShrink: 0 }}>
        {/* Flow controls */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', fontSize: 12 }}
              disabled={incomingEdges.length === 0}
              onClick={() => {
                if (incomingEdges.length === 1) handlePrevious()
                else setShowPrevDropdown(v => !v)
              }}
            >◀ Previous</button>
            {showPrevDropdown && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                background: '#1a2032', border: '1px solid #3a4a68',
                borderRadius: 6, padding: 4, marginBottom: 4, zIndex: 10
              }}>
                {incomingEdges.map(e => (
                  <button
                    key={e.id}
                    className="btn btn-ghost"
                    style={{ width: '100%', textAlign: 'left', fontSize: 12 }}
                    onClick={() => { navigateTo(e.from); setShowPrevDropdown(false) }}
                  >{e.from}</button>
                ))}
              </div>
            )}
          </div>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, fontSize: 12 }}
            onClick={handleNext}
          >Next ▶</button>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: 6, fontSize: 12 }}
          onClick={() => setShowAddChoices(true)}
        >+ Add choices</button>

        {/* + POV scene button + inline form */}
        {!showPovForm ? (
          <button
            className="btn btn-ghost"
            style={{ width: '100%', marginBottom: 6, fontSize: 12, color: '#9060d0', borderColor: '#9060d0' + '60' }}
            onClick={() => { setShowPovForm(true); setPovCharSelect(project.characters[0]?.id ?? '') }}
          >+ POV scene</button>
        ) : (
          <div style={{ background: '#200840', border: '1px solid #9060d060', borderRadius: 6, padding: '10px 12px', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9060d0', marginBottom: 8 }}>New POV Scene</div>
            {project.characters.length === 0 ? (
              <div style={{ fontSize: 12, color: '#5e6e8a', marginBottom: 8 }}>
                Create characters in the Characters tab first.
              </div>
            ) : (
              <>
                <label className="field-label">Character POV</label>
                <select
                  value={povCharSelect}
                  onChange={e => setPovCharSelect(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, fontSize: 12 }}
                >
                  {project.characters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {(() => {
                  const nextSeq = outgoingEdges.find(e => !e.label)?.to
                  return (
                    <div style={{ fontSize: 11, color: '#9aa5bb', marginBottom: 8 }}>
                      Insert after <strong>{node.id}</strong>
                      {nextSeq ? <> and before <strong>{nextSeq}</strong></> : null}.
                    </div>
                  )
                })()}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: 12, background: '#400860', borderColor: '#9060d0' }}
                    onClick={handleCreatePov}>Confirm</button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}
                    onClick={() => setShowPovForm(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}
            onClick={() => setMode('scene', node.id)}>Edit Scene</button>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}
            onClick={() => duplicateNode(node.id)}>Duplicate</button>
          <button className="btn btn-danger" style={{ flex: 1, fontSize: 12 }}
            onClick={() => setShowDeleteConfirm(true)}>Delete</button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, color: '#40a060' }}
            onClick={() => setMode('play', node.id)}
            title="Play the story starting from this node">
            ▶ Play from here
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, color: '#9aa5bb' }}
            onClick={() => setShowDepsMap(true)}>
            Dependencies
          </button>
        </div>
      </div>

      {/* Add choices form */}
      {showAddChoices && (
        <AddChoicesForm node={node} onClose={() => setShowAddChoices(false)} />
      )}

      {/* Dependency Map */}
      {showDepsMap && (
        <DependencyMap nodeId={node.id} onClose={() => setShowDepsMap(false)} />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="overlay">
          <div className="modal" style={{ minWidth: 320 }}>
            <div className="modal-title">Delete {node.id}?</div>
            <p style={{ fontSize: 13, color: '#9aa5bb', marginBottom: 20 }}>
              All connected edges will also be removed.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EditableTitle({ node, onUpdate }: { node: StoryNode; onUpdate: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(node.title)

  useEffect(() => { if (!editing) setVal(node.title) }, [node.id, node.title, editing])

  if (!editing) {
    return (
      <h2
        onClick={() => setEditing(true)}
        style={{ fontSize: 18, fontWeight: 700, cursor: 'text', color: '#e8ecf4', lineHeight: 1.2 }}
      >{node.title || <span style={{ color: '#5e6e8a' }}>Untitled</span>}</h2>
    )
  }
  return (
    <input
      autoFocus
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onUpdate(val); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onUpdate(val); setEditing(false) } }}
      style={{ fontSize: 18, fontWeight: 700, width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #4a5a80', padding: '0 0 2px', outline: 'none' }}
    />
  )
}

function AutoGrowTextarea({
  value, onChange, placeholder, style
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [val, setVal] = useState(value)

  useEffect(() => { setVal(value) }, [value])

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [val])

  return (
    <textarea
      ref={ref}
      value={val}
      onChange={e => { setVal(e.target.value); onChange(e.target.value) }}
      placeholder={placeholder}
      style={{ width: '100%', minHeight: 60, resize: 'none', overflow: 'hidden', ...style }}
    />
  )
}

function CharacterTagInput({
  chars, characters, onChange
}: {
  chars: string[]
  characters: { id: string; name: string }[]
  onChange: (chars: string[]) => void
}) {
  const available = characters.filter(c => !chars.includes(c.id))
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {chars.map(id => {
          const c = characters.find(ch => ch.id === id)
          return (
            <span key={id} className="chip">
              {c?.name ?? id}
              <span className="chip-x" onClick={() => onChange(chars.filter(i => i !== id))}>✕</span>
            </span>
          )
        })}
      </div>
      {available.length > 0 && (
        <select
          value=""
          onChange={e => { if (e.target.value) onChange([...chars, e.target.value]) }}
          style={{ fontSize: 12 }}
        >
          <option value="">+ Add character…</option>
          {available.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
    </div>
  )
}

function BranchRow({
  branch, nodes, onUpdate, onDelete, onNavigate, onCreate
}: {
  branch: Branch
  nodes: StoryNode[]
  onUpdate: (b: Branch) => void
  onDelete: () => void
  onNavigate: (id: string) => void
  onCreate: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: '#161b27',
      border: '1px solid #2a3448',
      borderRadius: 6,
      marginBottom: 8,
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
        <span style={{ fontWeight: 700, color: '#d4a040', minWidth: 18 }}>{branch.option}</span>
        <input
          value={branch.desc}
          onChange={e => onUpdate({ ...branch, desc: e.target.value })}
          placeholder="Choice text shown to player"
          style={{ flex: 1, fontSize: 12 }}
        />
        <button style={{ fontSize: 12, color: '#5e6e8a', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => setExpanded(v => !v)}>{expanded ? '▲' : '▼'}</button>
        <button className="chip-x" onClick={onDelete}>✕</button>
      </div>

      {expanded && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Leads to */}
          <div>
            <label className="field-label" style={{ marginBottom: 4 }}>Leads to</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {branch.leads.map(id => {
                const exists = nodes.some(n => n.id === id)
                return (
                  <span
                    key={id}
                    className="chip"
                    style={{ background: exists ? undefined : '#300f0f', borderColor: exists ? undefined : '#d04040' }}
                    onClick={() => exists ? onNavigate(id) : onCreate(id)}
                  >
                    {id} {!exists && <span style={{ color: '#d04040' }}>+ Create</span>}
                  </span>
                )
              })}
              <input
                placeholder="Add node ID…"
                style={{ width: 100, fontSize: 12, padding: '2px 6px' }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (val && !branch.leads.includes(val)) {
                      onUpdate({ ...branch, leads: [...branch.leads, val] });
                      (e.target as HTMLInputElement).value = ''
                    }
                  }
                }}
              />
            </div>
          </div>
          {/* Effects */}
          <div>
            <label className="field-label">Effects</label>
            <input
              value={branch.effects.join(', ')}
              onChange={e => onUpdate({ ...branch, effects: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="e.g. loyalty+1, PATH_C:open"
              style={{ width: '100%', fontSize: 12 }}
            />
          </div>
          {/* Condition */}
          <div>
            <label className="field-label">Condition</label>
            <input
              value={branch.condition ?? ''}
              onChange={e => onUpdate({ ...branch, condition: e.target.value || null })}
              placeholder="e.g. loyalty=high"
              style={{ width: '100%', fontSize: 12 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
