import React, { useState, useMemo } from 'react'
import { useStore } from '../../store'
import { traceForward, traceBackward } from '../../utils/pathTracer'

interface Props {
  nodeId: string
  onClose: () => void
}

export default function DependencyMap({ nodeId, onClose }: Props) {
  const { project, navigateTo } = useStore(s => ({
    project: s.project,
    navigateTo: s.navigateTo
  }))

  const [expandUpstream, setExpandUpstream] = useState(true)
  const [expandDownstream, setExpandDownstream] = useState(true)
  const [expandAncestors, setExpandAncestors] = useState(false)
  const [expandDescendants, setExpandDescendants] = useState(false)

  const node = project.nodes.find(n => n.id === nodeId)

  // Collect variable names this node reads (in branch conditions)
  const readsVarNames = useMemo(() => {
    if (!node) return new Set<string>()
    const names = new Set<string>()
    node.branches.forEach(b => {
      if (!b.condition) return
      const m = b.condition.match(/^(\w+)\s*[=><!\s]/)
      if (m) names.add(m[1])
      else if (/^\w+$/.test(b.condition.trim())) names.add(b.condition.trim())
    })
    return names
  }, [node])

  // Collect variable names this node sets (in variable effects)
  const setsVarIds = useMemo(() => {
    if (!node) return new Set<string>()
    return new Set(node.variables.map(ve => ve.variableId))
  }, [node])

  const varNameToId = useMemo(() => {
    const m: Record<string, string> = {}
    project.variables.forEach(v => { m[v.name] = v.id })
    return m
  }, [project.variables])

  // Upstream: nodes that SET a variable this node READS
  const upstreamNodes = useMemo(() => {
    const readIds = new Set([...readsVarNames].map(name => varNameToId[name]).filter(Boolean))
    if (!readIds.size) return []
    return project.nodes.filter(n =>
      n.id !== nodeId &&
      n.variables.some(ve => readIds.has(ve.variableId))
    )
  }, [project.nodes, readsVarNames, varNameToId, nodeId])

  // Downstream: nodes that READ a variable this node SETS
  const downstreamNodes = useMemo(() => {
    if (!setsVarIds.size) return []
    const setsVarNames = new Set([...setsVarIds].map(id => {
      const v = project.variables.find(v => v.id === id)
      return v?.name
    }).filter(Boolean) as string[])
    return project.nodes.filter(n => {
      if (n.id === nodeId) return false
      return n.branches.some(b => {
        if (!b.condition) return false
        const m = b.condition.match(/^(\w+)\s*[=><!\s]/)
        const name = m ? m[1] : (/^\w+$/.test(b.condition.trim()) ? b.condition.trim() : null)
        return name && setsVarNames.has(name)
      })
    })
  }, [project.nodes, project.variables, setsVarIds, nodeId])

  // Structural ancestors (BFS backward)
  const ancestorIds = useMemo(() => {
    const all = traceBackward(nodeId, project.nodes, project.edges)
    all.delete(nodeId)
    return [...all]
  }, [nodeId, project.nodes, project.edges])

  // Structural descendants (BFS forward)
  const descendantIds = useMemo(() => {
    const all = traceForward(nodeId, project.nodes, project.edges)
    all.delete(nodeId)
    return [...all]
  }, [nodeId, project.nodes, project.edges])

  const hasVariables = project.variables.length > 0

  function jumpTo(id: string) {
    navigateTo(id)
    onClose()
  }

  const NodeChip = ({ id }: { id: string }) => {
    const n = project.nodes.find(nd => nd.id === id)
    return (
      <span
        className="chip"
        style={{ cursor: 'pointer', fontSize: 12, margin: '2px' }}
        onClick={() => jumpTo(id)}
        title={n?.title}
      >
        {id}{n ? ` — ${n.title}` : ' (missing)'}
      </span>
    )
  }

  const SectionHeader = ({
    title, count, expanded, onToggle
  }: { title: string; count: number; expanded: boolean; onToggle: () => void }) => (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 0', borderBottom: '1px solid #2a3448', cursor: count > 0 ? 'pointer' : 'default',
        marginBottom: 6 }}
      onClick={() => count > 0 && onToggle()}
    >
      <span style={{ fontWeight: 600, fontSize: 13, color: '#e8ecf4' }}>{title}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#5e6e8a', background: '#1e2435',
          padding: '1px 8px', borderRadius: 10 }}>{count}</span>
        {count > 0 && <span style={{ color: '#5e6e8a', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>}
      </span>
    </div>
  )

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ minWidth: 520, maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="modal-title" style={{ marginBottom: 2 }}>Dependency Map</div>
            <div style={{ fontSize: 12, color: '#5e6e8a' }}>{node?.title ?? nodeId}</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '3px 8px' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Variable Upstream */}
          <div style={{ marginBottom: 16 }}>
            <SectionHeader
              title="Variable Upstream"
              count={upstreamNodes.length}
              expanded={expandUpstream}
              onToggle={() => setExpandUpstream(v => !v)}
            />
            {!hasVariables ? (
              <p style={{ fontSize: 12, color: '#5e6e8a' }}>No variables defined. Add variables in the Variable Manager to enable dependency tracking.</p>
            ) : expandUpstream && (upstreamNodes.length === 0 ? (
              <p style={{ fontSize: 12, color: '#5e6e8a' }}>No nodes set variables that this node reads.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {upstreamNodes.map(n => <NodeChip key={n.id} id={n.id} />)}
              </div>
            ))}
          </div>

          {/* Variable Downstream */}
          <div style={{ marginBottom: 16 }}>
            <SectionHeader
              title="Variable Downstream"
              count={downstreamNodes.length}
              expanded={expandDownstream}
              onToggle={() => setExpandDownstream(v => !v)}
            />
            {!hasVariables ? (
              <p style={{ fontSize: 12, color: '#5e6e8a' }}>No variables defined.</p>
            ) : expandDownstream && (downstreamNodes.length === 0 ? (
              <p style={{ fontSize: 12, color: '#5e6e8a' }}>No nodes read variables that this node sets.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {downstreamNodes.map(n => <NodeChip key={n.id} id={n.id} />)}
              </div>
            ))}
          </div>

          {/* Structural Ancestors */}
          <div style={{ marginBottom: 16 }}>
            <SectionHeader
              title="Structural Ancestors"
              count={ancestorIds.length}
              expanded={expandAncestors}
              onToggle={() => setExpandAncestors(v => !v)}
            />
            {expandAncestors && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {ancestorIds.map(id => <NodeChip key={id} id={id} />)}
              </div>
            )}
            {!expandAncestors && ancestorIds.length > 0 && (
              <p style={{ fontSize: 12, color: '#5e6e8a' }}>
                {ancestorIds.length} node{ancestorIds.length !== 1 ? 's' : ''} can reach this node. Click to expand.
              </p>
            )}
          </div>

          {/* Structural Descendants */}
          <div style={{ marginBottom: 8 }}>
            <SectionHeader
              title="Structural Descendants"
              count={descendantIds.length}
              expanded={expandDescendants}
              onToggle={() => setExpandDescendants(v => !v)}
            />
            {expandDescendants && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {descendantIds.map(id => <NodeChip key={id} id={id} />)}
              </div>
            )}
            {!expandDescendants && descendantIds.length > 0 && (
              <p style={{ fontSize: 12, color: '#5e6e8a' }}>
                {descendantIds.length} node{descendantIds.length !== 1 ? 's' : ''} reachable from this node. Click to expand.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
