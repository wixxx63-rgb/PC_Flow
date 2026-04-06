import React, { useState, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../store'
import type { Playthrough, PlaythroughStep, StoryNode, Variable, VariableState } from '../types'
import { buildDefaultState, applyEffects, applyBranchEffects, evaluateCondition } from '../utils/variables'

// ── Helpers ────────────────────────────────────────────────────────────────

function describeEffect(op: string, varName: string, value: string | number | boolean): string {
  if (op === 'set') return `${varName} = ${value}`
  if (op === 'add') return `${varName} +${value}`
  if (op === 'subtract') return `${varName} -${value}`
  if (op === 'toggle') return `${varName} toggled`
  return `${varName} → ${value}`
}

const TYPE_COLORS: Record<string, string> = {
  scene: '#4a80d4', decision: '#d4a040', grok: '#7a60d4',
  death: '#d04040', ending: '#40a060',
}

// ── Sub-view: Active Simulation ────────────────────────────────────────────

interface SimState {
  currentNodeId: string
  varState: VariableState
  steps: PlaythroughStep[]
  startNodeId: string
  finished: boolean
  endType: 'ending' | 'death' | 'stopped'
  endNodeId: string | null
}

interface ActiveSimProps {
  sim: SimState
  onAdvance: (branchIdx: number | null) => void
  onStop: () => void
  onSave: (name: string) => void
  onReset: () => void
  nodes: StoryNode[]
  variables: Variable[]
}

function ActiveSim({ sim, onAdvance, onStop, onSave, onReset, nodes, variables }: ActiveSimProps) {
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  const node = nodes.find(n => n.id === sim.currentNodeId)

  const availableBranches = useMemo(() => {
    if (!node) return []
    return node.branches.filter(b =>
      evaluateCondition(b.condition, sim.varState, variables)
    )
  }, [node, sim.varState, variables])

  const outgoingEdges = useMemo(() => {
    if (!node) return []
    return []
  }, [node])

  if (!node) {
    return (
      <div style={{ padding: 20, color: '#9aa5bb', textAlign: 'center' }}>
        Node not found — story may have changed since simulation started.
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onReset}>Reset</button>
        </div>
      </div>
    )
  }

  function handleSave() {
    const name = saveName.trim() || `Run ${new Date().toLocaleString()}`
    onSave(name)
    setShowSaveInput(false)
    setSaveName('')
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 0 }}>
      {/* Left: step history */}
      <div style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid #2a3448',
        overflowY: 'auto',
        background: '#0f1117',
      }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #2a3448', fontSize: 11, color: '#5e6e8a', fontWeight: 700 }}>
          BREADCRUMB
        </div>
        {sim.steps.map((step, i) => (
          <div key={i} style={{
            padding: '6px 10px',
            borderBottom: '1px solid #1a2032',
            fontSize: 11,
          }}>
            <div style={{ color: '#9aa5bb' }}>{i + 1}. {step.nodeTitle}</div>
            {step.choiceMade && (
              <div style={{ color: '#d4a040', marginTop: 2 }}>→ {step.choiceMade}</div>
            )}
          </div>
        ))}
        {sim.steps.length === 0 && (
          <div style={{ padding: '20px 10px', color: '#5e6e8a', fontSize: 11, textAlign: 'center' }}>
            Steps will appear here
          </div>
        )}
      </div>

      {/* Center: current node */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {sim.finished ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14,
          }}>
            <div style={{
              fontSize: 24,
              color: sim.endType === 'ending' ? '#40a060' : sim.endType === 'death' ? '#d04040' : '#9aa5bb',
            }}>
              {sim.endType === 'ending' ? '🏁' : sim.endType === 'death' ? '☠' : '⏹'}
            </div>
            <div style={{ fontSize: 15, color: '#e8ecf4', fontWeight: 600 }}>
              {sim.endType === 'ending' ? 'Ending reached'
                : sim.endType === 'death' ? 'Death ending'
                : 'Simulation stopped'}
            </div>
            <div style={{ fontSize: 12, color: '#9aa5bb' }}>
              {sim.steps.length} step{sim.steps.length !== 1 ? 's' : ''} taken
            </div>

            {showSaveInput ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                  placeholder="Playthrough name..."
                  style={{
                    background: '#1a2032', border: '1px solid #3a4a68',
                    borderRadius: 4, color: '#e8ecf4', fontSize: 12,
                    padding: '5px 10px', width: 200,
                  }}
                />
                <button className="btn btn-primary" onClick={handleSave} style={{ fontSize: 12, padding: '5px 12px' }}>Save</button>
                <button className="btn btn-ghost" onClick={() => setShowSaveInput(false)} style={{ fontSize: 12, padding: '5px 8px' }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => setShowSaveInput(true)} style={{ fontSize: 12, padding: '6px 14px' }}>
                  Save Playthrough
                </button>
                <button className="btn btn-ghost" onClick={onReset} style={{ fontSize: 12, padding: '6px 14px' }}>
                  Restart
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Node header */}
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid #2a3448',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                background: TYPE_COLORS[node.type] + '33',
                color: TYPE_COLORS[node.type],
                textTransform: 'uppercase',
              }}>{node.type}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8ecf4', flex: 1 }}>{node.title}</span>
              <span style={{ fontSize: 10, color: '#5e6e8a' }}>{node.id}</span>
            </div>

            {/* Node content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              {node.summary && (
                <div style={{ color: '#9aa5bb', fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
                  {node.summary}
                </div>
              )}

              {node.dialogueLines.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#5e6e8a', fontWeight: 700, marginBottom: 6 }}>DIALOGUE PREVIEW</div>
                  {node.dialogueLines.slice(0, 3).map((line, i) => (
                    <div key={i} style={{
                      background: '#1a2032', borderRadius: 5,
                      padding: '6px 10px', marginBottom: 4, fontSize: 12,
                    }}>
                      {line.speaker && (
                        <span style={{ color: '#4a80d4', fontWeight: 600, marginRight: 6 }}>
                          {line.speaker}:
                        </span>
                      )}
                      <span style={{ color: '#e8ecf4' }}>{line.text}</span>
                    </div>
                  ))}
                  {node.dialogueLines.length > 3 && (
                    <div style={{ fontSize: 11, color: '#5e6e8a', marginTop: 2 }}>
                      +{node.dialogueLines.length - 3} more lines…
                    </div>
                  )}
                </div>
              )}

              {/* Choices */}
              {availableBranches.length > 0 ? (
                <div>
                  <div style={{ fontSize: 11, color: '#5e6e8a', fontWeight: 700, marginBottom: 6 }}>CHOICES</div>
                  {availableBranches.map((branch, i) => (
                    <button
                      key={i}
                      className="btn btn-ghost"
                      onClick={() => onAdvance(node.branches.indexOf(branch))}
                      style={{
                        width: '100%', textAlign: 'left', marginBottom: 6,
                        padding: '8px 12px', fontSize: 13, lineHeight: 1.4,
                      }}
                    >
                      <div style={{ color: '#e8ecf4', fontWeight: 600 }}>{branch.option}</div>
                      {branch.desc && (
                        <div style={{ color: '#9aa5bb', fontSize: 11, marginTop: 2 }}>{branch.desc}</div>
                      )}
                      {branch.effects.length > 0 && (
                        <div style={{ color: '#d4a040', fontSize: 11, marginTop: 2 }}>
                          {branch.effects.join(', ')}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => onAdvance(null)}
                  style={{ fontSize: 13, padding: '8px 20px' }}
                >
                  Continue →
                </button>
              )}
            </div>

            {/* Bottom bar */}
            <div style={{
              padding: '8px 14px', borderTop: '1px solid #2a3448',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, color: '#5e6e8a' }}>Step {sim.steps.length + 1}</span>
              <button className="btn btn-ghost" onClick={onStop} style={{ fontSize: 11, padding: '3px 10px', color: '#d04040' }}>
                Stop
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right: variable state */}
      <div style={{
        width: 170, flexShrink: 0,
        borderLeft: '1px solid #2a3448',
        overflowY: 'auto',
        background: '#0f1117',
      }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #2a3448', fontSize: 11, color: '#5e6e8a', fontWeight: 700 }}>
          VARIABLES
        </div>
        {variables.map(v => (
          <div key={v.id} style={{
            padding: '5px 10px', borderBottom: '1px solid #1a2032',
            fontSize: 11,
          }}>
            <div style={{ color: '#9aa5bb' }}>{v.name}</div>
            <div style={{ color: '#d4a040', fontFamily: 'monospace' }}>
              {String(sim.varState[v.id] ?? '—')}
            </div>
          </div>
        ))}
        {variables.length === 0 && (
          <div style={{ padding: '16px 10px', color: '#5e6e8a', fontSize: 11, textAlign: 'center' }}>
            No variables
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-view: Saved Playthroughs ──────────────────────────────────────────

interface SavedRunsProps {
  playthroughs: Playthrough[]
  onDelete: (id: string) => void
  navigateTo: (id: string) => void
  variables: Variable[]
}

function SavedRuns({ playthroughs, onDelete, navigateTo, variables }: SavedRunsProps) {
  const [selectedA, setSelectedA] = useState<string | null>(playthroughs[0]?.id ?? null)
  const [selectedB, setSelectedB] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)

  const ptA = playthroughs.find(p => p.id === selectedA)
  const ptB = playthroughs.find(p => p.id === selectedB)

  function renderReport(pt: Playthrough) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#9aa5bb' }}>
            {pt.steps.length} steps &bull; {new Date(pt.createdAt).toLocaleString()} &bull;{' '}
            <span style={{ color: pt.endType === 'ending' ? '#40a060' : pt.endType === 'death' ? '#d04040' : '#9aa5bb' }}>
              {pt.endType === 'ending' ? 'Ending' : pt.endType === 'death' ? 'Death' : 'Stopped'}
            </span>
          </span>
        </div>
        {pt.steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '6px 0', borderBottom: '1px solid #1a2032',
            fontSize: 12,
          }}>
            <span style={{ color: '#5e6e8a', flexShrink: 0, width: 22, textAlign: 'right' }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <span
                style={{ color: '#4a80d4', cursor: 'pointer' }}
                onClick={() => navigateTo(step.nodeId)}
              >
                {step.nodeTitle}
              </span>
              {step.choiceMade && (
                <div style={{ color: '#d4a040', marginTop: 2 }}>→ {step.choiceMade}</div>
              )}
              {step.effectsApplied.length > 0 && (
                <div style={{ color: '#40a060', fontSize: 11, marginTop: 2 }}>
                  {step.effectsApplied.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (playthroughs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5e6e8a', fontSize: 13 }}>
        No saved playthroughs yet — run a simulation and save it.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* List */}
      <div style={{
        width: 200, flexShrink: 0, borderRight: '1px solid #2a3448',
        overflowY: 'auto', background: '#0f1117', padding: '8px 0',
      }}>
        {playthroughs.map(pt => (
          <div
            key={pt.id}
            onClick={() => { setSelectedA(pt.id); setCompareMode(false) }}
            style={{
              padding: '7px 10px', cursor: 'pointer',
              background: (selectedA === pt.id || selectedB === pt.id) ? '#1a2032' : 'transparent',
              borderLeft: `3px solid ${selectedA === pt.id ? '#4a80d4' : selectedB === pt.id ? '#d4a040' : 'transparent'}`,
              fontSize: 12, color: '#e8ecf4',
            }}
          >
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pt.name}
            </div>
            <div style={{ fontSize: 11, color: '#5e6e8a', marginTop: 1 }}>
              {pt.steps.length} steps
            </div>
          </div>
        ))}
      </div>

      {/* Report */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{
          padding: '7px 12px', borderBottom: '1px solid #2a3448',
          display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
        }}>
          {ptA && <span style={{ fontSize: 13, color: '#e8ecf4', fontWeight: 600, flex: 1 }}>{ptA.name}</span>}
          {!compareMode && ptA && (
            <button className="btn btn-ghost" onClick={() => { setCompareMode(true); setSelectedB(playthroughs.find(p => p.id !== selectedA)?.id ?? null) }} style={{ fontSize: 11, padding: '3px 10px' }}>
              Compare
            </button>
          )}
          {compareMode && (
            <button className="btn btn-ghost" onClick={() => setCompareMode(false)} style={{ fontSize: 11, padding: '3px 10px' }}>
              Cancel
            </button>
          )}
          {ptA && (
            <button className="btn btn-ghost" onClick={() => { if (confirm('Delete this playthrough?')) onDelete(ptA.id) }} style={{ fontSize: 11, padding: '3px 8px', color: '#d04040' }}>
              ✕
            </button>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {ptA && !compareMode && renderReport(ptA)}

          {compareMode && (
            <>
              <div style={{ flex: 1, borderRight: '1px solid #2a3448', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '6px 10px', background: '#1a2032', fontSize: 12, color: '#4a80d4', fontWeight: 600, flexShrink: 0 }}>
                  {ptA?.name}
                </div>
                {ptA && renderReport(ptA)}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '4px 8px', background: '#1a2032', flexShrink: 0,
                  display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid #2a3448',
                }}>
                  <span style={{ fontSize: 12, color: '#d4a040', fontWeight: 600 }}>Compare with:</span>
                  <select
                    value={selectedB ?? ''}
                    onChange={e => setSelectedB(e.target.value)}
                    style={{
                      flex: 1, background: '#0f1117', border: '1px solid #2a3448',
                      borderRadius: 4, color: '#e8ecf4', fontSize: 11, padding: '2px 6px',
                    }}
                  >
                    {playthroughs.filter(p => p.id !== selectedA).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {ptB && renderReport(ptB)}
              </div>
            </>
          )}

          {!ptA && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5e6e8a', fontSize: 13 }}>
              Select a playthrough
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export default function SimulatorPanel({ onClose }: Props) {
  const {
    project, navigateTo, addPlaythrough, deletePlaythrough,
    setSimulatorOpen,
  } = useStore(s => ({
    project: s.project,
    navigateTo: s.navigateTo,
    addPlaythrough: s.addPlaythrough,
    deletePlaythrough: s.deletePlaythrough,
    setSimulatorOpen: s.setSimulatorOpen,
  }))

  const [tab, setTab] = useState<'simulate' | 'saved'>('simulate')

  // Pick heuristic start node (highest out-degree among nodes with no incoming)
  const startNode = useMemo(() => {
    const { nodes, edges } = project
    const hasIncoming = new Set(edges.map(e => e.to))
    const roots = nodes.filter(n => !hasIncoming.has(n.id))
    return roots.reduce<StoryNode | null>((best, n) => {
      const deg = edges.filter(e => e.from === n.id).length
      const bestDeg = best ? edges.filter(e => e.from === best.id).length : -1
      return deg > bestDeg ? n : best
    }, null)
  }, [project])

  const initialVarState = useMemo(
    () => buildDefaultState(project.variables),
    [project.variables]
  )

  const [sim, setSim] = useState<SimState | null>(null)
  const [startPickId, setStartPickId] = useState<string>(startNode?.id ?? '')

  function beginSim() {
    const nodeId = startPickId || startNode?.id
    if (!nodeId) return
    setSim({
      currentNodeId: nodeId,
      varState: initialVarState,
      steps: [],
      startNodeId: nodeId,
      finished: false,
      endType: 'stopped',
      endNodeId: null,
    })
  }

  function handleAdvance(branchIdx: number | null) {
    if (!sim) return
    const node = project.nodes.find(n => n.id === sim.currentNodeId)
    if (!node) return

    let nextNodeId: string | null = null
    let choiceMade: string | null = null
    let choiceDesc: string | null = null
    let effectsApplied: string[] = []
    let newVarState = { ...sim.varState }

    if (branchIdx !== null) {
      const branch = node.branches[branchIdx]
      if (!branch) return
      choiceMade = branch.option
      choiceDesc = branch.desc || null
      newVarState = applyBranchEffects(newVarState, branch.effects, project.variables)
      effectsApplied = branch.effects
      nextNodeId = branch.leads[0] ?? null
    } else {
      // Apply node-level variable effects
      newVarState = applyEffects(newVarState, node.variables)
      effectsApplied = node.variables.map(ve => {
        const v = project.variables.find(pv => pv.id === ve.variableId)
        return v ? describeEffect(ve.operation, v.name, ve.value) : ''
      }).filter(Boolean)
      // Next via edge
      const outEdges = project.edges.filter(e => e.from === node.id)
      nextNodeId = outEdges[0]?.to ?? null
    }

    const step: PlaythroughStep = {
      nodeId: node.id,
      nodeTitle: node.title,
      choiceMade,
      choiceDesc,
      effectsApplied,
      varStateAfter: { ...newVarState },
    }

    if (!nextNodeId) {
      setSim(prev => prev ? {
        ...prev, varState: newVarState,
        steps: [...prev.steps, step],
        finished: true, endType: 'stopped', endNodeId: node.id,
      } : prev)
      return
    }

    const nextNode = project.nodes.find(n => n.id === nextNodeId)
    if (!nextNode) {
      setSim(prev => prev ? {
        ...prev, varState: newVarState,
        steps: [...prev.steps, step],
        finished: true, endType: 'stopped', endNodeId: node.id,
      } : prev)
      return
    }

    const isEnd = nextNode.type === 'ending' || nextNode.type === 'death'
    setSim(prev => prev ? {
      ...prev,
      currentNodeId: nextNodeId!,
      varState: newVarState,
      steps: [...prev.steps, step],
      finished: isEnd,
      endType: isEnd ? (nextNode.type === 'ending' ? 'ending' : 'death') : 'stopped',
      endNodeId: isEnd ? nextNodeId : null,
    } : prev)
  }

  function handleStop() {
    if (!sim) return
    const node = project.nodes.find(n => n.id === sim.currentNodeId)
    const step: PlaythroughStep = {
      nodeId: sim.currentNodeId,
      nodeTitle: node?.title ?? sim.currentNodeId,
      choiceMade: null, choiceDesc: null, effectsApplied: [],
      varStateAfter: { ...sim.varState },
    }
    setSim(prev => prev ? {
      ...prev, steps: [...prev.steps, step],
      finished: true, endType: 'stopped', endNodeId: sim.currentNodeId,
    } : prev)
  }

  function handleSave(name: string) {
    if (!sim) return
    const pt: Playthrough = {
      id: uuidv4(), name,
      startNodeId: sim.startNodeId,
      steps: sim.steps,
      endNodeId: sim.endNodeId,
      endType: sim.endType,
      createdAt: Date.now(),
    }
    addPlaythrough(pt)
    setTab('saved')
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: '#161b27',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderBottom: '1px solid #2a3448',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#e8ecf4' }}>Playthrough Simulator</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['simulate', 'saved'] as const).map(t => (
            <button
              key={t}
              className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(t)}
              style={{ fontSize: 12, padding: '4px 12px', textTransform: 'capitalize' }}
            >
              {t === 'simulate' ? 'Simulate' : `Saved (${project.playthroughs.length})`}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 14, padding: '2px 8px' }}>✕</button>
      </div>

      {/* Content */}
      {tab === 'simulate' ? (
        sim ? (
          <ActiveSim
            sim={sim}
            onAdvance={handleAdvance}
            onStop={handleStop}
            onSave={handleSave}
            onReset={() => setSim(null)}
            nodes={project.nodes}
            variables={project.variables}
          />
        ) : (
          // Start screen
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 16, padding: 32,
          }}>
            <div style={{ fontSize: 15, color: '#e8ecf4', fontWeight: 600 }}>
              Step through your story
            </div>
            <div style={{ fontSize: 13, color: '#9aa5bb', textAlign: 'center', maxWidth: 400 }}>
              The simulator lets you navigate choices, apply variable effects, and record playthroughs for comparison.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#9aa5bb' }}>Start node:</span>
              <select
                value={startPickId}
                onChange={e => setStartPickId(e.target.value)}
                style={{
                  background: '#1a2032', border: '1px solid #3a4a68',
                  borderRadius: 4, color: '#e8ecf4', fontSize: 12, padding: '4px 8px',
                  minWidth: 160,
                }}
              >
                {project.nodes.map(n => (
                  <option key={n.id} value={n.id}>{n.title} ({n.id})</option>
                ))}
              </select>
            </div>
            {project.nodes.length === 0 ? (
              <div style={{ color: '#d04040', fontSize: 13 }}>No nodes in project — add scenes first.</div>
            ) : (
              <button className="btn btn-primary" onClick={beginSim} style={{ fontSize: 13, padding: '8px 24px' }}>
                Start Simulation
              </button>
            )}
          </div>
        )
      ) : (
        <SavedRuns
          playthroughs={project.playthroughs}
          onDelete={deletePlaythrough}
          navigateTo={id => { navigateTo(id); setSimulatorOpen(false) }}
          variables={project.variables}
        />
      )}
    </div>
  )
}
