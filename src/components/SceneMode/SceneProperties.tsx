import React from 'react'
import { useStore } from '../../store'
import type { StoryNode, Asset, TransitionType, VariableEffect } from '../../types'
import AssetPicker from '../shared/AssetPicker'

interface Props {
  node: StoryNode
  assets: Asset[]
}

export default function SceneProperties({ node, assets }: Props) {
  const updateNode = useStore(s => s.updateNode)
  const { project } = useStore(s => ({ project: s.project }))

  function update(changes: Partial<StoryNode>) {
    updateNode(node.id, changes)
  }

  const TRANSITIONS: TransitionType[] = ['fade', 'cut', 'slide-left', 'slide-right']
  const imgAssets = assets.filter(a => a.type === 'image')
  const audioAssets = assets.filter(a => a.type === 'audio')

  const bgAsset = node.background ? assets.find(a => a.id === node.background) : null
  const musicAsset = node.music ? assets.find(a => a.id === node.music) : null
  const sfxAsset = node.sfx ? assets.find(a => a.id === node.sfx) : null

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e8ecf4', marginBottom: 14 }}>Scene Properties</div>

      {/* Background */}
      <div className="field-row">
        <label className="field-label">Background Image</label>
        <AssetPicker
          type="image"
          value={node.background}
          assets={imgAssets}
          onChange={id => update({ background: id })}
          preview={bgAsset}
        />
      </div>

      {/* Music */}
      <div className="field-row">
        <label className="field-label">Music</label>
        <AssetPicker
          type="audio"
          value={node.music}
          assets={audioAssets}
          onChange={id => update({ music: id })}
          preview={musicAsset}
        />
      </div>

      {/* Entry SFX */}
      <div className="field-row">
        <label className="field-label">Entry Sound Effect</label>
        <AssetPicker
          type="audio"
          value={node.sfx}
          assets={audioAssets}
          onChange={id => update({ sfx: id })}
          preview={sfxAsset}
        />
      </div>

      {/* Transition */}
      <div className="field-row">
        <label className="field-label">Transition</label>
        <select
          value={node.transition}
          onChange={e => update({ transition: e.target.value as TransitionType })}
          style={{ width: '100%' }}
        >
          {TRANSITIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Characters in scene */}
      <div className="field-row">
        <div className="section-header">
          <span className="section-title">Characters in Scene</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {node.chars.map(id => {
            const c = project.characters.find(ch => ch.id === id)
            return (
              <span key={id} className="chip">
                {c?.name ?? id}
                <span className="chip-x" onClick={() => update({ chars: node.chars.filter(i => i !== id) })}>✕</span>
              </span>
            )
          })}
        </div>
        {project.characters.filter(c => !node.chars.includes(c.id)).length > 0 && (
          <select
            value=""
            onChange={e => { if (e.target.value) update({ chars: [...node.chars, e.target.value] }) }}
            style={{ fontSize: 12 }}
          >
            <option value="">+ Add character…</option>
            {project.characters.filter(c => !node.chars.includes(c.id)).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Variable Effects */}
      <div className="field-row">
        <div className="section-header">
          <span className="section-title">Variables on Entry</span>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '2px 6px' }}
            onClick={() => {
              if (!project.variables.length) return
              const effect: VariableEffect = {
                variableId: project.variables[0].id,
                operation: 'set',
                value: ''
              }
              update({ variables: [...node.variables, effect] })
            }}
          >+ Add</button>
        </div>
        {node.variables.map((effect, i) => {
          return (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <select
                value={effect.variableId}
                onChange={e => {
                  const updated = [...node.variables]
                  updated[i] = { ...effect, variableId: e.target.value }
                  update({ variables: updated })
                }}
                style={{ flex: 1, fontSize: 11 }}
              >
                {project.variables.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <select
                value={effect.operation}
                onChange={e => {
                  const updated = [...node.variables]
                  updated[i] = { ...effect, operation: e.target.value as VariableEffect['operation'] }
                  update({ variables: updated })
                }}
                style={{ width: 80, fontSize: 11 }}
              >
                <option value="set">set</option>
                <option value="add">add</option>
                <option value="subtract">subtract</option>
                <option value="toggle">toggle</option>
              </select>
              <input
                value={String(effect.value)}
                onChange={e => {
                  const updated = [...node.variables]
                  updated[i] = { ...effect, value: e.target.value }
                  update({ variables: updated })
                }}
                style={{ width: 60, fontSize: 11 }}
              />
              <button className="chip-x" onClick={() => {
                update({ variables: node.variables.filter((_, j) => j !== i) })
              }}>✕</button>
            </div>
          )
        })}
        {node.variables.length === 0 && (
          <span style={{ fontSize: 11, color: '#5e6e8a' }}>No variables set</span>
        )}
      </div>
    </div>
  )
}
