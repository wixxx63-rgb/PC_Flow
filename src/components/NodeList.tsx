import React, { useState } from 'react'
import { useStore } from '../store'
import type { StoryNode } from '../types'

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export default function NodeList({ collapsed, onToggle }: Props) {
  const { project, selectedNodeId, searchQuery } = useStore(s => ({
    project: s.project,
    selectedNodeId: s.selectedNodeId,
    searchQuery: s.searchQuery
  }))
  const navigateTo = useStore(s => s.navigateTo)
  const setCanvasTransform = useStore(s => s.setCanvasTransform)

  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())

  let nodes = project.nodes

  // Apply search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    nodes = nodes.filter(n =>
      n.id.toLowerCase().includes(q) ||
      n.title.toLowerCase().includes(q) ||
      n.summary.toLowerCase().includes(q) ||
      n.chars.some(id => {
        const c = project.characters.find(ch => ch.id === id)
        return c?.name.toLowerCase().includes(q)
      })
    )
  }

  if (statusFilter.length) nodes = nodes.filter(n => statusFilter.includes(n.status))

  // Group by path
  const grouped = new Map<string, StoryNode[]>()
  nodes.forEach(n => {
    const key = n.path || '(no path)'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(n)
  })
  const sortedGroups = [...grouped.keys()].sort()

  function jumpToNode(node: StoryNode) {
    navigateTo(node.id)
    // Pan canvas to node
    setCanvasTransform({ x: -node.x + 300, y: -node.y + 200, scale: 1 })
  }

  const STATUS_COLORS: Record<string, string> = {
    todo: '#3a4a68',
    inprog: '#d4a040',
    done: '#40a060'
  }

  if (collapsed) {
    return (
      <div style={{
        width: 28,
        background: '#161b27',
        borderRight: '1px solid #2a3448',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8
      }}>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px', fontSize: 14, width: 24 }}
          onClick={onToggle}
          title="Expand node list"
        >›</button>
      </div>
    )
  }

  return (
    <div style={{
      width: 240,
      background: '#161b27',
      borderRight: '1px solid #2a3448',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #2a3448', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e8ecf4' }}>
          Nodes ({nodes.length})
        </span>
        <button className="btn btn-ghost" style={{ padding: '2px 4px', fontSize: 12 }} onClick={onToggle}>‹</button>
      </div>

      {/* Filters */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #2a3448' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['todo', 'inprog', 'done'] as const).map(s => (
            <button
              key={s}
              className="btn"
              style={{
                fontSize: 10, padding: '2px 6px',
                background: statusFilter.includes(s) ? '#2d3750' : 'transparent',
                border: `1px solid ${statusFilter.includes(s) ? STATUS_COLORS[s] : '#2a3448'}`,
                color: STATUS_COLORS[s]
              }}
              onClick={() => setStatusFilter(f => f.includes(s) ? f.filter(x => x !== s) : [...f, s])}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedGroups.map(pathKey => {
          const pathNodes = grouped.get(pathKey)!
          const isCollapsed = collapsedPaths.has(pathKey)
          return (
            <div key={pathKey}>
              <div
                style={{
                  padding: '5px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#5e6e8a',
                  background: '#131820',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={() => setCollapsedPaths(s => {
                  const next = new Set(s)
                  if (next.has(pathKey)) next.delete(pathKey)
                  else next.add(pathKey)
                  return next
                })}
              >
                <span>{isCollapsed ? '›' : '⌄'}</span>
                {pathKey}
              </div>
              {!isCollapsed && pathNodes.map(node => {
                const isSelected = node.id === selectedNodeId
                return (
                  <div
                    key={node.id}
                    onClick={() => jumpToNode(node)}
                    style={{
                      padding: '6px 12px',
                      cursor: 'pointer',
                      background: isSelected ? '#252d42' : 'transparent',
                      borderLeft: `2px solid ${isSelected ? '#4a80d4' : 'transparent'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#1e2435' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: STATUS_COLORS[node.status],
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#e8ecf4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {node.title}
                      </div>
                      <div style={{ fontSize: 10, color: '#5e6e8a', marginTop: 1 }}>
                        {node.id}
                        {node.day != null && ` · Day ${node.day}`}
                      </div>
                    </div>
                    <span className={`badge badge-${node.type}`} style={{ fontSize: 9, padding: '1px 5px', flexShrink: 0 }}>
                      {node.type.slice(0, 3)}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
        {nodes.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: '#5e6e8a' }}>
            {searchQuery ? 'No matches' : 'No nodes yet'}
          </div>
        )}
      </div>
    </div>
  )
}
