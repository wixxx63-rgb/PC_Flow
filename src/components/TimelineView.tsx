import React from 'react'
import { useStore } from '../store'
import type { BlockType } from '../types'

const BLOCKS: (BlockType | 'Unblocked')[] = ['Morning', 'Afternoon', 'Evening', 'Night', 'Unblocked']

const TYPE_COLORS: Record<string, string> = {
  scene: '#4a80d4', decision: '#d4a040', grok: '#9060d0', death: '#d04040', ending: '#40a060'
}
const STATUS_COLORS: Record<string, string> = {
  todo: '#3a4a68', inprog: '#d4a040', done: '#40a060'
}

export default function TimelineView() {
  const { project, setTimelineVisible, navigateTo, setCanvasTransform } = useStore(s => ({
    project: s.project,
    setTimelineVisible: s.setTimelineVisible,
    navigateTo: s.navigateTo,
    setCanvasTransform: s.setCanvasTransform
  }))

  const nodes = project.nodes

  // Compute day range
  const daysWithNodes = nodes.map(n => n.day).filter((d): d is number => d != null && d > 0)
  const maxDay = daysWithNodes.length ? Math.max(...daysWithNodes) : 0
  const days = Array.from({ length: maxDay }, (_, i) => i + 1)

  function getNodes(day: number | null, block: BlockType | 'Unblocked') {
    return nodes.filter(n => {
      if (day === null) return n.day == null || n.day === 0
      if (n.day !== day) return false
      if (block === 'Unblocked') return !n.block
      return n.block === block
    })
  }

  function handleCardClick(nodeId: string) {
    const node = project.nodes.find(n => n.id === nodeId)
    setTimelineVisible(false)
    navigateTo(nodeId)
    if (node) {
      setCanvasTransform({ x: -node.x + 600, y: -node.y + 300, scale: 1 })
    }
  }

  const columns = [...days, null] // null = Unscheduled

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: '#0f1117',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid #2a3448', flexShrink: 0
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#e8ecf4' }}>Timeline View</span>
        <span style={{ fontSize: 12, color: '#5e6e8a' }}>
          {nodes.length} nodes &nbsp;·&nbsp; Shift+click a node on the canvas to trace paths
        </span>
        <button className="btn btn-ghost" style={{ fontSize: 12 }}
          onClick={() => setTimelineVisible(false)}>◀ Back to Graph</button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `80px repeat(${columns.length}, minmax(180px, 1fr))`,
          gridTemplateRows: `36px repeat(${BLOCKS.length}, auto)`,
          minWidth: 80 + columns.length * 180
        }}>
          {/* Top-left corner */}
          <div style={{ background: '#161b27', borderRight: '1px solid #2a3448', borderBottom: '1px solid #2a3448' }} />

          {/* Day headers */}
          {columns.map((day, i) => (
            <div key={i} style={{
              background: '#161b27',
              borderRight: '1px solid #2a3448',
              borderBottom: '1px solid #2a3448',
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: '#9aa5bb',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {day === null ? 'Unscheduled' : `Day ${day}`}
            </div>
          ))}

          {/* Rows */}
          {BLOCKS.map(block => (
            <React.Fragment key={block}>
              {/* Block label */}
              <div style={{
                background: '#161b27',
                borderRight: '1px solid #2a3448',
                borderBottom: '1px solid #2a3448',
                padding: '8px 6px',
                fontSize: 11,
                color: '#5e6e8a',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                minHeight: 80
              }}>
                {block}
              </div>

              {/* Cells */}
              {columns.map((day, ci) => {
                const cellNodes = getNodes(day, block)
                return (
                  <div key={ci} style={{
                    borderRight: '1px solid #2a3448',
                    borderBottom: '1px solid #2a3448',
                    padding: 6,
                    minHeight: 80,
                    background: '#0f1117',
                    verticalAlign: 'top',
                    overflowY: 'auto',
                    maxHeight: 200
                  }}>
                    {cellNodes.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleCardClick(n.id)}
                        style={{
                          background: '#1a2032',
                          border: `1px solid ${TYPE_COLORS[n.type] ?? '#2a3448'}33`,
                          borderLeft: `3px solid ${TYPE_COLORS[n.type] ?? '#2a3448'}`,
                          borderRadius: 4,
                          padding: '4px 8px',
                          marginBottom: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                          transition: 'background .15s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#252d42')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#1a2032')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: STATUS_COLORS[n.status], flexShrink: 0
                          }} />
                          <span style={{ color: '#e8ecf4', fontWeight: 600, flex: 1, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.title}
                          </span>
                        </div>
                        <div style={{ color: '#5e6e8a', fontSize: 10, marginTop: 2 }}>{n.id}</div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
