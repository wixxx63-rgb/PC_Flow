import React, { useState } from 'react'
import { useStore } from './store'
import Toolbar from './components/Toolbar'
import GraphCanvas from './components/GraphMode/GraphCanvas'
import DetailPanel from './components/GraphMode/DetailPanel'
import NodeList from './components/NodeList'
import SceneEditor from './components/SceneMode/SceneEditor'
import PlayEngine from './components/PlayMode/PlayEngine'
import TimelineView from './components/TimelineView'
import SimulatorPanel from './components/SimulatorPanel'
import ConflictsPanel from './components/ConflictsPanel'
import WritersRoom from './components/WritersRoom'
import StatisticsPanel from './components/StatisticsPanel'
import FindReplace from './components/FindReplace'

export default function App() {
  const {
    mode, selectedNodeId,
    timelineVisible, simulatorOpen, conflictsPanelOpen,
    statisticsOpen, writersRoomOpen, findBarOpen,
  } = useStore(s => ({
    mode: s.mode,
    selectedNodeId: s.selectedNodeId,
    timelineVisible: s.timelineVisible,
    simulatorOpen: s.simulatorOpen,
    conflictsPanelOpen: s.conflictsPanelOpen,
    statisticsOpen: s.statisticsOpen,
    writersRoomOpen: s.writersRoomOpen,
    findBarOpen: s.findBarOpen,
  }))

  const setConflictsPanelOpen = useStore(s => s.setConflictsPanelOpen)
  const setStatisticsOpen = useStore(s => s.setStatisticsOpen)
  const setWritersRoomOpen = useStore(s => s.setWritersRoomOpen)
  const setSimulatorOpen = useStore(s => s.setSimulatorOpen)

  const [nodeListCollapsed, setNodeListCollapsed] = useState(() => {
    try { return localStorage.getItem('nf:nodeListCollapsed') === '1' } catch { return false }
  })

  function toggleNodeList() {
    setNodeListCollapsed(v => {
      const next = !v
      try { localStorage.setItem('nf:nodeListCollapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#0f1117'
    }}>
      {/* Toolbar — always visible */}
      <Toolbar />

      {/* Find & Replace bar (graph mode, when open) */}
      {mode === 'graph' && findBarOpen && <FindReplace />}

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Node list sidebar — hide when timeline or simulator are active */}
        {mode === 'graph' && !timelineVisible && !simulatorOpen && (
          <NodeList
            collapsed={nodeListCollapsed}
            onToggle={toggleNodeList}
          />
        )}

        {/* Graph mode content */}
        {mode === 'graph' && (
          <>
            {/* Timeline view replaces canvas */}
            {timelineVisible && <TimelineView />}

            {/* Simulator panel replaces canvas */}
            {!timelineVisible && simulatorOpen && (
              <SimulatorPanel onClose={() => setSimulatorOpen(false)} />
            )}

            {/* Normal graph canvas */}
            {!timelineVisible && !simulatorOpen && (
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <GraphCanvas />
                {selectedNodeId && <DetailPanel />}
              </div>
            )}

            {/* Writer's Room panel (slides in over graph) */}
            {writersRoomOpen && (
              <WritersRoom onClose={() => setWritersRoomOpen(false)} />
            )}
          </>
        )}

        {/* Scene editor */}
        {mode === 'scene' && <SceneEditor />}
      </div>

      {/* Play mode overlays everything */}
      {mode === 'play' && <PlayEngine />}

      {/* Modals */}
      {conflictsPanelOpen && (
        <ConflictsPanel onClose={() => setConflictsPanelOpen(false)} />
      )}
      {statisticsOpen && (
        <StatisticsPanel onClose={() => setStatisticsOpen(false)} />
      )}
    </div>
  )
}
