import React, { useState } from 'react'
import { useStore } from '../../store'
import DialogueList from './DialogueList'
import ScenePreview from './ScenePreview'
import SceneProperties from './SceneProperties'

export default function SceneEditor() {
  const { sceneNodeId, project, mode } = useStore(s => ({
    sceneNodeId: s.sceneNodeId,
    project: s.project,
    mode: s.mode
  }))
  const [selectedLineIndex, setSelectedLineIndex] = useState(0)

  if (mode !== 'scene' || !sceneNodeId) return null
  const node = project.nodes.find(n => n.id === sceneNodeId)
  if (!node) return null

  const currentLine = node.dialogueLines[selectedLineIndex] ?? null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      top: 'var(--toolbar-height)',
      background: '#0f1117',
      display: 'flex',
      zIndex: 3
    }}>
      {/* Left — Dialogue list */}
      <div style={{
        width: 340,
        borderRight: '1px solid #2a3448',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}>
        <DialogueList
          node={node}
          selectedIndex={selectedLineIndex}
          onSelect={setSelectedLineIndex}
        />
      </div>

      {/* Centre — Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ScenePreview
          node={node}
          currentLine={currentLine}
          assets={project.assets}
          characters={project.characters}
        />
      </div>

      {/* Right — Properties */}
      <div style={{
        width: 300,
        borderLeft: '1px solid #2a3448',
        flexShrink: 0,
        overflowY: 'auto'
      }}>
        <SceneProperties node={node} assets={project.assets} />
      </div>
    </div>
  )
}
