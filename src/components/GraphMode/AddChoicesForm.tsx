import React, { useState } from 'react'
import { useStore } from '../../store'
import type { StoryNode } from '../../types'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  node: StoryNode
  onClose: () => void
}

interface ChoiceEntry {
  label: string
  text: string
  assignedNodeId: string | null
}

export default function AddChoicesForm({ node, onClose }: Props) {
  const { project } = useStore(s => ({ project: s.project }))
  const updateNode = useStore(s => s.updateNode)
  const addEdge = useStore(s => s.addEdge)
  const createNodeAt = useStore(s => s.createNodeAt)
  const snapshotForUndo = useStore(s => s.snapshotForUndo)

  const existingOutgoing = project.edges.filter(e => e.from === node.id)

  // For each existing edge, we need to assign it to a choice or leave unassigned
  const [existingAssignments, setExistingAssignments] = useState<Record<string, string | null>>(
    Object.fromEntries(existingOutgoing.map(e => [e.id, null]))
  )

  const [choices, setChoices] = useState<ChoiceEntry[]>([
    { label: 'A', text: '', assignedNodeId: null },
    { label: 'B', text: '', assignedNodeId: null },
    { label: 'C', text: '', assignedNodeId: null }
  ])

  function addChoice() {
    const next = String.fromCharCode(65 + choices.length)
    setChoices([...choices, { label: next, text: '', assignedNodeId: null }])
  }

  function removeChoice(i: number) {
    const updated = choices.filter((_, j) => j !== i)
    setChoices(updated.map((c, j) => ({ ...c, label: String.fromCharCode(65 + j) })))
  }

  function confirm() {
    const nonEmpty = choices.filter(c => c.text.trim())
    if (!nonEmpty.length) { onClose(); return }
    snapshotForUndo('node_created')

    const spread = nonEmpty.length
    const startX = node.x - ((spread - 1) / 2) * 280

    nonEmpty.forEach((choice, i) => {
      let targetId: string

      if (choice.assignedNodeId) {
        targetId = choice.assignedNodeId
      } else {
        const newNode = createNodeAt(startX + i * 280, node.y + 240)
        targetId = newNode.id
      }

      // Check if edge already exists
      const edgeExists = project.edges.some(e => e.from === node.id && e.to === targetId && e.label === choice.label)
      if (!edgeExists) {
        addEdge({
          id: uuidv4(),
          from: node.id,
          to: targetId,
          label: choice.label,
          desc: choice.text,
          isDeath: false
        })
      }
    })

    // Update node type and branches
    updateNode(node.id, {
      type: 'decision',
      branches: nonEmpty.map(c => ({
        option: c.label,
        desc: c.text,
        leads: [c.assignedNodeId ?? ''].filter(Boolean),
        effects: [],
        condition: null
      }))
    })

    onClose()
  }

  return (
    <div className="overlay">
      <div className="modal" style={{ minWidth: 460 }}>
        <div className="modal-title">Add Choices</div>

        {/* Handle existing connections */}
        {existingOutgoing.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#9aa5bb', marginBottom: 10 }}>
              This node already has connections. Assign each to a choice or leave unassigned:
            </p>
            {existingOutgoing.map(edge => {
              const targetNode = project.nodes.find(n => n.id === edge.to)
              return (
                <div key={edge.id} style={{ background: '#161b27', border: '1px solid #2a3448', borderRadius: 6, padding: '8px 12px', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: '#9aa5bb', marginBottom: 6 }}>
                    → {edge.to}: {targetNode?.title}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {choices.filter(c => c.text.trim()).map(c => (
                      <button
                        key={c.label}
                        className="btn"
                        style={{
                          fontSize: 11, padding: '2px 10px',
                          background: existingAssignments[edge.id] === c.label ? '#2d3750' : 'transparent',
                          border: `1px solid ${existingAssignments[edge.id] === c.label ? '#4a5a80' : '#2a3448'}`
                        }}
                        onClick={() => {
                          setExistingAssignments({ ...existingAssignments, [edge.id]: c.label })
                          setChoices(choices.map(ch => ch.label === c.label ? { ...ch, assignedNodeId: edge.to } : ch))
                        }}
                      >Choice {c.label}</button>
                    ))}
                    <button
                      className="btn"
                      style={{
                        fontSize: 11, padding: '2px 10px',
                        background: existingAssignments[edge.id] === null ? '#2d3750' : 'transparent',
                        border: `1px solid ${existingAssignments[edge.id] === null ? '#4a5a80' : '#2a3448'}`
                      }}
                      onClick={() => setExistingAssignments({ ...existingAssignments, [edge.id]: null })}
                    >Leave unassigned</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Choices */}
        {choices.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#d4a040', minWidth: 18 }}>{c.label}</span>
            <input
              value={c.text}
              onChange={e => setChoices(choices.map((ch, j) => j === i ? { ...ch, text: e.target.value } : ch))}
              placeholder={`Choice ${c.label} text (leave blank to skip)`}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button className="chip-x" onClick={() => removeChoice(i)}>✕</button>
          </div>
        ))}

        <button className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 16 }} onClick={addChoice}>
          + Add choice
        </button>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm}>Confirm</button>
        </div>
      </div>
    </div>
  )
}
