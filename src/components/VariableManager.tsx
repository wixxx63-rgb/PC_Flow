import React from 'react'
import { useStore } from '../store'
import type { Variable, VariableType } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  onClose: () => void
}

export default function VariableManager({ onClose }: Props) {
  const { project } = useStore(s => ({ project: s.project }))
  const addVariable = useStore(s => s.addVariable)
  const updateVariable = useStore(s => s.updateVariable)
  const deleteVariable = useStore(s => s.deleteVariable)

  function createVariable() {
    const variable: Variable = {
      id: uuidv4(),
      name: 'new_variable',
      type: 'number',
      defaultValue: 0
    }
    addVariable(variable)
  }

  const TYPES: VariableType[] = ['string', 'boolean', 'number']

  function getDefaultForType(type: VariableType): string | boolean | number {
    if (type === 'boolean') return false
    if (type === 'number') return 0
    return ''
  }

  return (
    <div className="overlay">
      <div className="modal" style={{ minWidth: 540 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Story Variables</h2>
          <button className="btn btn-ghost" style={{ fontSize: 14 }} onClick={onClose}>✕</button>
        </div>

        <p style={{ fontSize: 12, color: '#5e6e8a', marginBottom: 14 }}>
          Variables track story state. Use in branch conditions: <code style={{ color: '#9aa5bb' }}>loyalty=high</code>, <code style={{ color: '#9aa5bb' }}>day&gt;3</code>
        </p>

        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px 32px', gap: 8, marginBottom: 6, padding: '0 2px' }}>
          <span className="field-label">Name</span>
          <span className="field-label">Type</span>
          <span className="field-label">Default</span>
          <span />
        </div>

        <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 12 }}>
          {project.variables.map(v => (
            <div
              key={v.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 90px 120px 32px',
                gap: 8, alignItems: 'center',
                background: '#161b27', border: '1px solid #2a3448',
                borderRadius: 6, padding: '7px 10px', marginBottom: 6
              }}
            >
              <input
                value={v.name}
                onChange={e => updateVariable(v.id, { name: e.target.value })}
                style={{ fontSize: 12 }}
                placeholder="variable_name"
              />
              <select
                value={v.type}
                onChange={e => {
                  const type = e.target.value as VariableType
                  updateVariable(v.id, { type, defaultValue: getDefaultForType(type) })
                }}
                style={{ fontSize: 12 }}
              >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {v.type === 'boolean' ? (
                <select
                  value={String(v.defaultValue)}
                  onChange={e => updateVariable(v.id, { defaultValue: e.target.value === 'true' })}
                  style={{ fontSize: 12 }}
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              ) : (
                <input
                  value={String(v.defaultValue)}
                  onChange={e => updateVariable(v.id, {
                    defaultValue: v.type === 'number' ? (Number(e.target.value) || 0) : e.target.value
                  })}
                  type={v.type === 'number' ? 'number' : 'text'}
                  style={{ fontSize: 12 }}
                />
              )}
              <button className="chip-x" onClick={() => {
                if (confirm(`Delete variable "${v.name}"?`)) deleteVariable(v.id)
              }}>✕</button>
            </div>
          ))}
          {project.variables.length === 0 && (
            <div style={{ fontSize: 12, color: '#5e6e8a', padding: '12px 0' }}>
              No variables defined yet.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={createVariable}>
            + Add Variable
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
