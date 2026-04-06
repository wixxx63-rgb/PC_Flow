import React, { useMemo } from 'react'
import { useStore } from '../store'

function countWords(text: string): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0
}

function ProgressBar({ value, color = '#4a80d4' }: { value: number; color?: string }) {
  return (
    <div style={{ height: 6, background: '#2a3448', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 3, transition: 'width .3s' }} />
    </div>
  )
}

export default function StatisticsPanel() {
  const { project, setStatisticsOpen } = useStore(s => ({
    project: s.project,
    setStatisticsOpen: s.setStatisticsOpen
  }))

  const stats = useMemo(() => {
    const nodes = project.nodes
    const total = nodes.length

    const byStatus = { todo: 0, inprog: 0, done: 0 }
    nodes.forEach(n => { byStatus[n.status] = (byStatus[n.status] ?? 0) + 1 })

    const totalDialogueLines = nodes.reduce((s, n) => s + n.dialogueLines.length, 0)

    let wordCount = 0
    nodes.forEach(n => {
      wordCount += countWords(n.summary) + countWords(n.dialogue) +
        countWords(n.grokHandoff) + countWords(n.consequences) + countWords(n.trigger)
      n.dialogueLines.forEach(l => { wordCount += countWords(l.text) })
    })

    // By path
    const pathMap: Record<string, { total: number; done: number }> = {}
    nodes.forEach(n => {
      const p = n.path || '(no path)'
      if (!pathMap[p]) pathMap[p] = { total: 0, done: 0 }
      pathMap[p].total++
      if (n.status === 'done') pathMap[p].done++
    })

    // By type
    const typeMap: Record<string, number> = {}
    nodes.forEach(n => { typeMap[n.type] = (typeMap[n.type] ?? 0) + 1 })

    // Writing progress
    const withDialogue = nodes.filter(n => n.dialogueLines.length > 0).length
    const summaryOnly = nodes.filter(n => n.dialogueLines.length === 0 && n.summary.trim()).length
    const empty = nodes.filter(n => n.dialogueLines.length === 0 && !n.summary.trim() && !n.grokHandoff.trim()).length

    // Characters by scene count
    const charScenes: Record<string, number> = {}
    nodes.forEach(n => { n.chars.forEach(cid => { charScenes[cid] = (charScenes[cid] ?? 0) + 1 }) })
    const charList = project.characters
      .map(c => ({ ...c, scenes: charScenes[c.id] ?? 0 }))
      .sort((a, b) => b.scenes - a.scenes)

    return { total, byStatus, totalDialogueLines, wordCount, pathMap, typeMap, withDialogue, summaryOnly, empty, charList }
  }, [project])

  const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#5e6e8a', textTransform: 'uppercase',
      letterSpacing: '0.08em', marginTop: 20, marginBottom: 10, borderBottom: '1px solid #2a3448',
      paddingBottom: 4 }}>
      {children}
    </div>
  )

  const Row = ({ label, value, pctVal, color }: { label: string; value: string | number; pctVal?: number; color?: string }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#9aa5bb' }}>{label}</span>
        <span style={{ fontSize: 13, color: '#e8ecf4', fontWeight: 600 }}>
          {value}{pctVal !== undefined ? ` (${pctVal}%)` : ''}
        </span>
      </div>
      {pctVal !== undefined && <ProgressBar value={pctVal} color={color} />}
    </div>
  )

  return (
    <div className="overlay" onClick={() => setStatisticsOpen(false)}>
      <div className="modal" style={{ minWidth: 480, maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div className="modal-title">Statistics</div>
          <button className="btn btn-ghost" style={{ padding: '3px 8px' }} onClick={() => setStatisticsOpen(false)}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SectionTitle>Overall</SectionTitle>
          <Row label="Total nodes" value={stats.total} />
          <Row label="Total dialogue lines" value={stats.totalDialogueLines} />
          <Row label="Estimated word count" value={stats.wordCount.toLocaleString()} />
          <Row label="Overall completion" value={stats.byStatus.done}
            pctVal={pct(stats.byStatus.done, stats.total)} color="#40a060" />

          <SectionTitle>By Status</SectionTitle>
          <Row label="Done" value={stats.byStatus.done} pctVal={pct(stats.byStatus.done, stats.total)} color="#40a060" />
          <Row label="In Progress" value={stats.byStatus.inprog} pctVal={pct(stats.byStatus.inprog, stats.total)} color="#d4a040" />
          <Row label="Todo" value={stats.byStatus.todo} pctVal={pct(stats.byStatus.todo, stats.total)} color="#3a4a68" />

          <SectionTitle>By Path</SectionTitle>
          {Object.entries(stats.pathMap).map(([path, data]) => (
            <Row key={path} label={path} value={`${data.done}/${data.total}`}
              pctVal={pct(data.done, data.total)} color="#4a80d4" />
          ))}
          {Object.keys(stats.pathMap).length === 0 && (
            <p style={{ fontSize: 12, color: '#5e6e8a' }}>No path values assigned.</p>
          )}

          <SectionTitle>By Type</SectionTitle>
          {['scene', 'decision', 'grok', 'death', 'ending'].map(type => (
            stats.typeMap[type] ? (
              <Row key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}
                value={stats.typeMap[type]} />
            ) : null
          ))}

          <SectionTitle>Writing Progress</SectionTitle>
          <Row label="Nodes with dialogue" value={stats.withDialogue}
            pctVal={pct(stats.withDialogue, stats.total)} color="#4a80d4" />
          <Row label="Summary only (no dialogue)" value={stats.summaryOnly}
            pctVal={pct(stats.summaryOnly, stats.total)} color="#d4a040" />
          <Row label="Completely empty" value={stats.empty}
            pctVal={pct(stats.empty, stats.total)} color="#d04040" />

          <SectionTitle>Characters by Scene Count</SectionTitle>
          {stats.charList.length === 0 && (
            <p style={{ fontSize: 12, color: '#5e6e8a' }}>No characters defined.</p>
          )}
          {stats.charList.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: c.color || '#9aa5bb' }}>{c.name}</span>
              <span style={{ fontSize: 13, color: '#e8ecf4' }}>{c.scenes} scene{c.scenes !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
