import React, { useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { detectConflicts } from '../utils/conflictDetector'
import type { ConflictIssue, ConflictIssueType } from '../types'

const TYPE_LABELS: Record<ConflictIssueType, string> = {
  'orphan': 'Orphaned Nodes',
  'dead-end': 'Dead Ends',
  'broken-connection': 'Broken Connections',
  'empty-decision': 'Empty Decisions',
  'undefined-variable': 'Undefined Variables',
  'unwritten': 'Unwritten Scenes',
  'circular-trap': 'Circular Traps',
}

const SEVERITY_ICON: Record<string, string> = {
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
}

const SEVERITY_COLOR: Record<string, string> = {
  error: '#d04040',
  warning: '#d4a040',
  info: '#4a80d4',
}

interface Props {
  onClose: () => void
}

export default function ConflictsPanel({ onClose }: Props) {
  const { project, navigateTo, setConflictsPanelOpen } = useStore(s => ({
    project: s.project,
    navigateTo: s.navigateTo,
    setConflictsPanelOpen: s.setConflictsPanelOpen,
  }))

  const [issues, setIssues] = React.useState<ConflictIssue[]>(() => detectConflicts(project))

  // Re-scan whenever nodes/edges/variables change
  useEffect(() => {
    setIssues(detectConflicts(project))
  }, [project.nodes, project.edges, project.variables])

  const rescan = useCallback(() => {
    setIssues(detectConflicts(project))
  }, [project])

  // Group by type
  const grouped = React.useMemo(() => {
    const map = new Map<ConflictIssueType, ConflictIssue[]>()
    issues.forEach(issue => {
      const arr = map.get(issue.type) ?? []
      arr.push(issue)
      map.set(issue.type, arr)
    })
    return map
  }, [issues])

  const errorCount = issues.filter(i => i.severity === 'error').length
  const warnCount = issues.filter(i => i.severity === 'warning').length

  function handleNodeClick(nodeId: string | null) {
    if (!nodeId) return
    navigateTo(nodeId)
    setConflictsPanelOpen(false)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#e8ecf4' }}>Conflict Detector</span>
            {errorCount > 0 && (
              <span style={{
                background: '#d04040', color: '#fff', fontSize: 11, fontWeight: 700,
                borderRadius: 10, padding: '1px 7px'
              }}>{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
            )}
            {warnCount > 0 && (
              <span style={{
                background: '#d4a040', color: '#fff', fontSize: 11, fontWeight: 700,
                borderRadius: 10, padding: '1px 7px'
              }}>{warnCount} warning{warnCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={rescan} style={{ fontSize: 12, padding: '4px 12px' }}>
              Re-scan
            </button>
            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {issues.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              color: '#40a060', fontSize: 15
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              No issues detected — your story looks clean!
            </div>
          ) : (
            Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type} style={{ marginBottom: 20 }}>
                <div className="section-header" style={{ marginBottom: 8 }}>
                  <span className="section-title">{TYPE_LABELS[type]}</span>
                  <span style={{ fontSize: 11, color: '#9aa5bb', marginLeft: 6 }}>({items.length})</span>
                </div>
                {items.map(issue => (
                  <div key={issue.id} style={{
                    background: '#1a2032',
                    border: `1px solid ${SEVERITY_COLOR[issue.severity]}33`,
                    borderRadius: 6,
                    padding: '10px 12px',
                    marginBottom: 6,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}>
                    <span style={{
                      color: SEVERITY_COLOR[issue.severity],
                      fontSize: 14,
                      flexShrink: 0,
                      marginTop: 1,
                    }}>
                      {SEVERITY_ICON[issue.severity]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#e8ecf4', marginBottom: 4, lineHeight: 1.4 }}>
                        {issue.description}
                      </div>
                      <div style={{ fontSize: 12, color: '#9aa5bb', marginBottom: issue.nodeId ? 6 : 0 }}>
                        {issue.suggestion}
                      </div>
                      {issue.nodeId && (
                        <button
                          className="chip"
                          onClick={() => handleNodeClick(issue.nodeId)}
                          style={{ cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}
                        >
                          Go to {issue.nodeId}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
