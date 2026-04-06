import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store'
import { exportJSON, exportXML, importJSON, importXML } from '../utils/exportImport'
import { v4 as uuidv4 } from 'uuid'
import type { Project } from '../types'
import CharacterManager from './CharacterManager'
import VariableManager from './VariableManager'
import HtmlExportModal from './HtmlExportModal'
import CloudSync from './CloudSync'
import { detectConflicts } from '../utils/conflictDetector'
import { buildGrokHTML } from '../utils/grokExport'
import { isElectron, saveTextFile, openTextFile } from '../utils/fs'

export default function Toolbar() {
  const {
    mode, project, isDirty, linkModeActive, sceneNodeId, undoStack, redoStack,
    timelineVisible, simulatorOpen, conflictsPanelOpen, statisticsOpen, writersRoomOpen, findBarOpen,
    povFilter,
  } = useStore(s => ({
    mode: s.mode,
    project: s.project,
    isDirty: s.isDirty,
    linkModeActive: s.linkModeActive,
    sceneNodeId: s.sceneNodeId,
    undoStack: s.undoStack,
    redoStack: s.redoStack,
    timelineVisible: s.timelineVisible,
    simulatorOpen: s.simulatorOpen,
    conflictsPanelOpen: s.conflictsPanelOpen,
    statisticsOpen: s.statisticsOpen,
    writersRoomOpen: s.writersRoomOpen,
    findBarOpen: s.findBarOpen,
    povFilter: s.povFilter,
  }))

  const setMode = useStore(s => s.setMode)
  const setLinkMode = useStore(s => s.setLinkMode)
  const setSearchQuery = useStore(s => s.setSearchQuery)
  const createNodeAt = useStore(s => s.createNodeAt)
  const navigateTo = useStore(s => s.navigateTo)
  const loadProject = useStore(s => s.loadProject)
  const markSaved = useStore(s => s.markSaved)
  const undo = useStore(s => s.undo)
  const redo = useStore(s => s.redo)
  const setTimelineVisible = useStore(s => s.setTimelineVisible)
  const setSimulatorOpen = useStore(s => s.setSimulatorOpen)
  const setConflictsPanelOpen = useStore(s => s.setConflictsPanelOpen)
  const setStatisticsOpen = useStore(s => s.setStatisticsOpen)
  const setWritersRoomOpen = useStore(s => s.setWritersRoomOpen)
  const setFindBarOpen = useStore(s => s.setFindBarOpen)
  const setPovFilter = useStore(s => s.setPovFilter)

  const [showCharManager, setShowCharManager] = useState(false)
  const [showVarManager, setShowVarManager] = useState(false)
  const [showHtmlExport, setShowHtmlExport] = useState(false)
  const [showCloudSync,  setShowCloudSync]  = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [searchVal, setSearchVal] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Characters that have at least one POV node in the graph
  const povCharacters = useMemo(() => {
    const charIds = new Set(project.nodes.filter(n => n.isPov && n.povCharacter).map(n => n.povCharacter!))
    return project.characters.filter(c => charIds.has(c.id))
  }, [project.nodes, project.characters])

  // Conflict badge count (only run when panel is closed to avoid double computation)
  const conflictErrorCount = useMemo(() => {
    if (!conflictsPanelOpen && mode === 'graph') {
      return detectConflicts(project).filter(i => i.severity === 'error').length
    }
    return 0
  }, [project.nodes, project.edges, project.variables, mode, conflictsPanelOpen])

  // Update save indicator (flash "Saving…" briefly during auto-save)
  const [isSaving, setIsSaving] = useState(false)
  useEffect(() => {
    if (!isDirty && project.lastSaved) {
      setIsSaving(true)
      const t = setTimeout(() => {
        setIsSaving(false)
        const mins = Math.round((Date.now() - project.lastSaved!) / 60000)
        setSaveMsg(mins < 1 ? 'Saved · Just now' : `Saved · ${mins}m ago`)
      }, 400)
      return () => clearTimeout(t)
    } else if (isDirty) {
      setIsSaving(false)
      setSaveMsg('● Unsaved changes')
    }
  }, [isDirty, project.lastSaved])

  // Stable ref so the keyboard handler never needs to reinstall when project changes
  const handleSaveRef = useRef<() => void>(() => {})

  // Undo/redo + find keyboard shortcuts — deps are stable Zustand actions only
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSaveRef.current() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); setFindBarOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  async function handleSave() {
    if (!isElectron) {
      // Browser: always download
      const ok = await saveTextFile(`${project.name}.nflow`, exportJSON(project), 'nflow')
      if (ok) markSaved(null)
      return
    }
    let path = project.projectPath
    if (!path) {
      path = await window.electronAPI?.saveFile(
        [{ name: 'Narrative Flow', extensions: ['nflow'] }],
        `${project.name}.nflow`
      )
      if (!path) return
    }
    const data = exportJSON(project)
    const ok = await window.electronAPI?.writeFile(path, data)
    if (ok) markSaved(path)
    else alert('Save failed — could not write file.')
  }
  // Keep ref current every render so keyboard shortcut always uses latest project state
  handleSaveRef.current = handleSave

  async function handleExportJSON() {
    const ok = await saveTextFile(`${project.name}.json`, exportJSON(project), 'json')
    if (ok) alert('Exported successfully.')
  }

  async function handleExportXML() {
    const ok = await saveTextFile(`${project.name}.xml`, exportXML(project), 'xml')
    if (ok) alert('Exported successfully.')
  }

  async function handleGrokExport() {
    const grokCount = project.nodes.filter(n => n.type === 'grok' || n.grokHandoff.trim()).length
    if (grokCount === 0) {
      alert('No grok-type nodes or grok handoff content found in this project.')
      return
    }
    try {
      const html = buildGrokHTML(project)
      const ok = await saveTextFile(`${project.name}-grok-scenes.html`, html, 'html')
      if (!ok) alert('Grok export failed — could not write file.')
    } catch (err: any) {
      alert(`Grok export failed: ${err?.message ?? String(err)}`)
    }
  }

  async function handleImport() {
    const result = await openTextFile(['json', 'xml', 'nflow'], 'Story Files')
    if (!result) return
    const { name: filePath, content } = result

    if (!confirm('Import will replace the current project. Continue?')) return

    const isXML = filePath.endsWith('.xml')
    const data = isXML ? importXML(content) : importJSON(content)
    if (!data) { alert('Invalid file format.'); return }

    const newProject: Project = {
      id: uuidv4(),
      name: data.name ?? 'Imported Story',
      nodes: data.nodes ?? [],
      edges: data.edges ?? [],
      characters: data.characters ?? [],
      variables: data.variables ?? [],
      assets: data.assets ?? [],
      playthroughs: data.playthroughs ?? [],
      writerRoom: data.writerRoom ?? [],
      projectPath: (isElectron && filePath.endsWith('.nflow')) ? filePath : null,
      lastSaved: null
    }
    loadProject(newProject)
  }

  function handleAddNode() {
    const node = createNodeAt(0, 0)
    navigateTo(node.id)
  }

  const sceneNode = mode === 'scene' && sceneNodeId
    ? project.nodes.find(n => n.id === sceneNodeId)
    : null

  return (
    <>
      <div style={{
        height: 'var(--toolbar-height)',
        background: '#161b27',
        borderBottom: '1px solid #2a3448',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        zIndex: 20,
        position: 'relative',
        flexShrink: 0
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#e8ecf4', letterSpacing: '-0.02em', flexShrink: 0 }}>
            Narrative Flow
          </span>

          <div style={{
            width: 1, height: 20,
            background: '#2a3448',
            flexShrink: 0
          }} />

          {/* Mode indicator */}
          <span style={{ fontSize: 12, color: '#9aa5bb', flexShrink: 0 }}>
            {mode === 'graph' && 'Graph'}
            {mode === 'scene' && `Scene: ${sceneNode?.id ?? sceneNodeId}`}
            {mode === 'play' && 'Playing'}
          </span>

          {/* Back to graph */}
          {(mode === 'scene' || mode === 'play') && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '3px 10px', flexShrink: 0 }}
              onClick={() => setMode('graph')}
            >◀ Graph</button>
          )}
        </div>

        {/* Centre (graph mode only) */}
        {mode === 'graph' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={handleAddNode}>+ Node</button>

            <button
              className="btn"
              style={{
                fontSize: 12, padding: '4px 10px',
                background: linkModeActive ? '#302000' : 'transparent',
                border: `1px solid ${linkModeActive ? '#d4a040' : '#2a3448'}`,
                color: linkModeActive ? '#d4a040' : '#9aa5bb'
              }}
              onClick={() => setLinkMode(!linkModeActive)}
            >
              {linkModeActive ? '🔗 Link ON' : '🔗 Link'}
            </button>

            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => window.dispatchEvent(new Event('narrative:autoLayout'))}>
              Auto layout
            </button>

            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setShowCharManager(true)}>Characters</button>

            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setShowVarManager(true)}>Variables</button>

            <div style={{ width: 1, height: 16, background: '#2a3448', flexShrink: 0 }} />

            {/* Timeline */}
            <button
              className="btn"
              style={{
                fontSize: 12, padding: '4px 10px',
                background: timelineVisible ? '#1a3060' : 'transparent',
                border: `1px solid ${timelineVisible ? '#4a80d4' : '#2a3448'}`,
                color: timelineVisible ? '#4a80d4' : '#9aa5bb',
              }}
              onClick={() => setTimelineVisible(!timelineVisible)}
              title="Timeline view"
            >Timeline</button>

            {/* Simulator */}
            <button
              className="btn"
              style={{
                fontSize: 12, padding: '4px 10px',
                background: simulatorOpen ? '#1a3060' : 'transparent',
                border: `1px solid ${simulatorOpen ? '#4a80d4' : '#2a3448'}`,
                color: simulatorOpen ? '#4a80d4' : '#9aa5bb',
              }}
              onClick={() => setSimulatorOpen(!simulatorOpen)}
              title="Playthrough Simulator"
            >Simulate</button>

            {/* Conflicts */}
            <button
              className="btn"
              style={{
                fontSize: 12, padding: '4px 10px',
                background: conflictsPanelOpen ? '#301010' : 'transparent',
                border: `1px solid ${conflictsPanelOpen ? '#d04040' : '#2a3448'}`,
                color: conflictsPanelOpen ? '#d04040' : '#9aa5bb',
                position: 'relative',
              }}
              onClick={() => setConflictsPanelOpen(!conflictsPanelOpen)}
              title="Conflict Detector"
            >
              Conflicts
              {conflictErrorCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  background: '#d04040', color: '#fff',
                  fontSize: 10, fontWeight: 700, borderRadius: 8,
                  padding: '0 4px', lineHeight: '14px',
                  pointerEvents: 'none',
                }}>{conflictErrorCount}</span>
              )}
            </button>

            {/* Stats */}
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setStatisticsOpen(true)}
              title="Statistics">Stats</button>

            {/* Writer's Room */}
            <button
              className="btn"
              style={{
                fontSize: 12, padding: '4px 10px',
                background: writersRoomOpen ? '#102040' : 'transparent',
                border: `1px solid ${writersRoomOpen ? '#4a80d4' : '#2a3448'}`,
                color: writersRoomOpen ? '#4a80d4' : '#9aa5bb',
              }}
              onClick={() => setWritersRoomOpen(!writersRoomOpen)}
              title="Writer's Room"
            >Writer's Room</button>

            {/* Cloud Sync */}
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px', color: '#4a80d4' }}
              onClick={() => setShowCloudSync(true)}
              title="Sync project via GitHub Gist">☁ Sync</button>

            {/* Export HTML */}
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setShowHtmlExport(true)}
              title="Export Playable HTML">HTML Export</button>

            {/* Grok Export */}
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px', color: '#9060d0' }}
              onClick={handleGrokExport}
              title="Export Grok scenes as HTML">Grok Export</button>

            {/* Find */}
            <button
              className="btn"
              style={{
                fontSize: 12, padding: '4px 10px',
                background: findBarOpen ? '#102040' : 'transparent',
                border: `1px solid ${findBarOpen ? '#4a80d4' : '#2a3448'}`,
                color: findBarOpen ? '#4a80d4' : '#9aa5bb',
              }}
              onClick={() => setFindBarOpen(!findBarOpen)}
              title="Find & Replace (Ctrl+F)"
            >Find</button>

            {/* Search — debounced so canvas doesn't redraw on every keystroke */}
            <input
              value={searchVal}
              onChange={e => {
                const val = e.target.value
                setSearchVal(val)
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                searchDebounceRef.current = setTimeout(() => setSearchQuery(val), 150)
              }}
              placeholder="Search…"
              style={{ width: 120, fontSize: 12, padding: '4px 10px' }}
            />

            {/* POV filter — only shown when there are POV nodes */}
            {povCharacters.length > 0 && (
              <>
                <div style={{ width: 1, height: 16, background: '#2a3448', flexShrink: 0 }} />
                <button
                  className="btn"
                  style={{
                    fontSize: 11, padding: '3px 8px',
                    background: povFilter === null ? '#1a3060' : 'transparent',
                    border: `1px solid ${povFilter === null ? '#4a80d4' : '#2a3448'}`,
                    color: povFilter === null ? '#4a80d4' : '#9aa5bb',
                    flexShrink: 0
                  }}
                  onClick={() => setPovFilter(null)}
                  title="Show all nodes"
                >All</button>
                {povCharacters.map(c => (
                  <button
                    key={c.id}
                    className="btn"
                    style={{
                      fontSize: 11, padding: '3px 8px',
                      background: povFilter === c.id ? c.color + '22' : 'transparent',
                      border: `1px solid ${povFilter === c.id ? c.color : '#2a3448'}`,
                      color: povFilter === c.id ? c.color : '#9aa5bb',
                      flexShrink: 0
                    }}
                    onClick={() => setPovFilter(povFilter === c.id ? null : c.id)}
                    title={`Show ${c.name}'s POV thread`}
                  >{c.name}</button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Spacer for non-graph modes */}
        {mode !== 'graph' && <div style={{ flex: 1 }} />}

        {/* Undo/redo */}
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '4px 8px' }}
          disabled={!undoStack.length}
          onClick={undo}
          title="Undo (Ctrl+Z)"
        >↩</button>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '4px 8px' }}
          disabled={!redoStack.length}
          onClick={redo}
          title="Redo (Ctrl+Y)"
        >↪</button>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={handleExportJSON}>JSON</button>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={handleExportXML}>XML</button>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={handleImport}>Import</button>

          <div style={{ width: 1, height: 16, background: '#2a3448' }} />

          <span style={{
            fontSize: 11,
            color: isSaving ? '#4a80d4' : isDirty ? '#d4a040' : '#5e6e8a',
            minWidth: 120,
            textAlign: 'right',
            transition: 'color 0.2s',
          }}>
            {isSaving ? '↑ Saving…' : saveMsg || (isDirty ? '● Unsaved' : 'No changes')}
          </span>

          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={handleSave}
          >Save</button>
        </div>
      </div>

      {showCharManager && <CharacterManager onClose={() => setShowCharManager(false)} />}
      {showVarManager && <VariableManager onClose={() => setShowVarManager(false)} />}
      {showHtmlExport && <HtmlExportModal onClose={() => setShowHtmlExport(false)} />}
      {showCloudSync  && <CloudSync onClose={() => setShowCloudSync(false)} />}
    </>
  )
}
