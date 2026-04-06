import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Project,
  StoryNode,
  Edge,
  Character,
  Variable,
  Asset,
  AppMode,
  CanvasTransform,
  UndoAction,
  Branch,
  DialogueLine,
  VariableEffect,
  NodeType,
  Playthrough,
  WriterRoomSection
} from '../types'

// ── Default Writer's Room sections ────────────────────────────────────────

function makeDefaultWriterRoom(): WriterRoomSection[] {
  return [
    { id: uuidv4(), title: 'World', content: '', order: 0 },
    { id: uuidv4(), title: 'Characters', content: '', order: 1 },
    { id: uuidv4(), title: 'Timeline', content: '', order: 2 },
    { id: uuidv4(), title: 'Rules', content: '', order: 3 },
    { id: uuidv4(), title: 'Research', content: '', order: 4 },
  ]
}

const DEFAULT_PROJECT: Project = {
  id: uuidv4(),
  name: 'Untitled Story',
  nodes: [],
  edges: [],
  characters: [],
  variables: [],
  assets: [],
  projectPath: null,
  lastSaved: null,
  playthroughs: [],
  writerRoom: makeDefaultWriterRoom()
}

interface AppState {
  // Project data
  project: Project
  isDirty: boolean

  // App mode
  mode: AppMode
  sceneNodeId: string | null
  playFromNodeId: string | null

  // Graph UI state
  selectedNodeId: string | null
  canvasTransform: CanvasTransform
  linkModeActive: boolean
  panelNavHistory: string[]
  searchQuery: string

  // Panel visibility (UI-only)
  timelineVisible: boolean
  findBarOpen: boolean
  conflictsPanelOpen: boolean
  simulatorOpen: boolean
  statisticsOpen: boolean
  writersRoomOpen: boolean
  povFilter: string | null

  // Undo/redo stacks
  undoStack: UndoAction[]
  redoStack: UndoAction[]

  // Auto-save timer
  autoSaveTimer: ReturnType<typeof setTimeout> | null

  // ── Setters ───────────────────────────────────────────────────────────

  setMode: (mode: AppMode, nodeId?: string) => void
  setSelectedNode: (id: string | null) => void
  setCanvasTransform: (t: CanvasTransform) => void
  setLinkMode: (active: boolean) => void
  setSearchQuery: (q: string) => void
  setTimelineVisible: (v: boolean) => void
  setFindBarOpen: (v: boolean) => void
  setConflictsPanelOpen: (v: boolean) => void
  setSimulatorOpen: (v: boolean) => void
  setStatisticsOpen: (v: boolean) => void
  setWritersRoomOpen: (v: boolean) => void
  setPovFilter: (id: string | null) => void

  // ── Project operations ────────────────────────────────────────────────

  loadProject: (p: Project) => void
  setProjectName: (name: string) => void

  // ── Node operations ───────────────────────────────────────────────────

  addNode: (node: StoryNode) => void
  updateNode: (id: string, changes: Partial<StoryNode>) => void
  deleteNode: (id: string) => void
  moveNode: (id: string, x: number, y: number) => void
  createNodeAt: (x: number, y: number, type?: NodeType) => StoryNode
  duplicateNode: (id: string) => StoryNode | null
  createPovNode: (afterNodeId: string, characterId: string) => StoryNode | null

  // ── Edge operations ───────────────────────────────────────────────────

  addEdge: (edge: Edge) => void
  updateEdge: (id: string, changes: Partial<Edge>) => void
  deleteEdge: (id: string) => void
  deleteEdgesForNode: (nodeId: string) => void

  // ── Character operations ──────────────────────────────────────────────

  addCharacter: (character: Character) => void
  updateCharacter: (id: string, changes: Partial<Character>) => void
  deleteCharacter: (id: string) => void

  // ── Variable operations ───────────────────────────────────────────────

  addVariable: (variable: Variable) => void
  updateVariable: (id: string, changes: Partial<Variable>) => void
  deleteVariable: (id: string) => void

  // ── Asset operations ──────────────────────────────────────────────────

  addAsset: (asset: Asset) => void
  deleteAsset: (id: string) => void

  // ── Branch helpers ────────────────────────────────────────────────────

  updateBranches: (nodeId: string, branches: Branch[]) => void

  // ── Dialogue line helpers ─────────────────────────────────────────────

  updateDialogueLines: (nodeId: string, lines: DialogueLine[]) => void
  addDialogueLine: (nodeId: string) => void

  // ── Variable effects helpers ──────────────────────────────────────────

  updateVariableEffects: (nodeId: string, effects: VariableEffect[]) => void

  // ── Playthrough operations ────────────────────────────────────────────

  addPlaythrough: (pt: Playthrough) => void
  deletePlaythrough: (id: string) => void
  renamePlaythrough: (id: string, name: string) => void

  // ── Writer's Room operations ──────────────────────────────────────────

  updateWriterRoomSection: (id: string, changes: Partial<WriterRoomSection>) => void
  addWriterRoomSection: (section: WriterRoomSection) => void
  deleteWriterRoomSection: (id: string) => void
  reorderWriterRoomSections: (sections: WriterRoomSection[]) => void

  // ── Undo/Redo ─────────────────────────────────────────────────────────

  undo: () => void
  redo: () => void
  snapshotForUndo: (type: UndoAction['type']) => void

  // ── Panel navigation ──────────────────────────────────────────────────

  navigateTo: (nodeId: string) => void

  // ── Save ──────────────────────────────────────────────────────────────

  markSaved: (path?: string) => void
  markDirty: () => void
}

function getAutoId(nodes: StoryNode[], baseId?: string): string {
  if (baseId) {
    const nums = nodes
      .map(n => n.id)
      .filter(id => id.startsWith(baseId + '-'))
      .map(id => parseInt(id.slice(baseId.length + 1), 10))
      .filter(n => !isNaN(n))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `${baseId}-${next}`
  }
  const existing = nodes.map(n => n.id).filter(id => /^S\d+$/.test(id)).map(id => parseInt(id.slice(1)))
  const next = existing.length ? Math.max(...existing) + 1 : 1
  return `S${next}`
}

export const useStore = create<AppState>((set, get) => ({
  project: DEFAULT_PROJECT,
  isDirty: false,
  mode: 'graph',
  sceneNodeId: null,
  playFromNodeId: null,
  selectedNodeId: null,
  canvasTransform: { x: 0, y: 0, scale: 1 },
  linkModeActive: false,
  panelNavHistory: [],
  searchQuery: '',
  timelineVisible: false,
  findBarOpen: false,
  conflictsPanelOpen: false,
  simulatorOpen: false,
  statisticsOpen: false,
  writersRoomOpen: false,
  povFilter: null,
  undoStack: [],
  redoStack: [],
  autoSaveTimer: null,

  setMode: (mode, nodeId) => set(s => ({
    mode,
    sceneNodeId: mode === 'scene' ? (nodeId ?? s.sceneNodeId) : s.sceneNodeId,
    playFromNodeId: mode === 'play' ? (nodeId ?? s.playFromNodeId) : s.playFromNodeId
  })),

  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setCanvasTransform: (t) => set({ canvasTransform: t }),
  setLinkMode: (active) => set({ linkModeActive: active }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setTimelineVisible: (v) => set({ timelineVisible: v }),
  setFindBarOpen: (v) => set({ findBarOpen: v }),
  setConflictsPanelOpen: (v) => set({ conflictsPanelOpen: v }),
  setSimulatorOpen: (v) => set({ simulatorOpen: v }),
  setStatisticsOpen: (v) => set({ statisticsOpen: v }),
  setWritersRoomOpen: (v) => set({ writersRoomOpen: v }),
  setPovFilter: (id) => set({ povFilter: id }),

  loadProject: (p) => set({
    project: {
      ...p,
      // Backfill POV fields for nodes from old project files
      nodes: (p.nodes ?? []).map(n => ({
        isPov: false,
        povCharacter: null,
        ...n
      })),
      characters: (p.characters ?? []).map(c => ({
        color: '#888888',
        sprites: [],
        ...c
      })),
      variables: p.variables ?? [],
      assets: p.assets ?? [],
      edges: p.edges ?? [],
      playthroughs: p.playthroughs ?? [],
      writerRoom: (p.writerRoom && p.writerRoom.length > 0)
        ? p.writerRoom
        : makeDefaultWriterRoom()
    },
    isDirty: false,
    selectedNodeId: null,
    mode: 'graph',
    sceneNodeId: null,
    panelNavHistory: [],
    undoStack: [],
    redoStack: [],
    linkModeActive: false,
    timelineVisible: false,
    simulatorOpen: false,
    conflictsPanelOpen: false,
    statisticsOpen: false,
    writersRoomOpen: false,
    findBarOpen: false,
    searchQuery: '',
    povFilter: null,
  }),

  setProjectName: (name) => {
    get().snapshotForUndo('field_edited')
    set(s => ({ project: { ...s.project, name }, isDirty: true }))
  },

  // ── Node ops ──────────────────────────────────────────────────────────

  addNode: (node) => {
    get().snapshotForUndo('node_created')
    set(s => ({
      project: { ...s.project, nodes: [...s.project.nodes, node] },
      isDirty: true
    }))
  },

  updateNode: (id, changes) => {
    set(s => ({
      project: {
        ...s.project,
        nodes: s.project.nodes.map(n => n.id === id ? { ...n, ...changes } : n)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  deleteNode: (id) => {
    const { project, selectedNodeId } = get()
    get().snapshotForUndo('node_deleted')
    const node = project.nodes.find(n => n.id === id)
    const incoming = project.edges.filter(e => e.to === id)
    const outgoing = project.edges.filter(e => e.from === id)
    let edges = project.edges.filter(e => e.from !== id && e.to !== id)
    // Heal the graph: if this is a POV node with exactly one in and one out edge,
    // reconnect predecessor → successor so no orphaned path
    if (node?.isPov && incoming.length === 1 && outgoing.length === 1) {
      edges.push({
        id: uuidv4(),
        from: incoming[0].from,
        to: outgoing[0].to,
        label: '',
        desc: '',
        isDeath: false
      })
    }
    set(s => ({
      project: {
        ...s.project,
        nodes: s.project.nodes.filter(n => n.id !== id),
        edges
      },
      isDirty: true,
      selectedNodeId: selectedNodeId === id ? null : selectedNodeId
    }))
    scheduleAutoSave(get)
  },

  moveNode: (id, x, y) => {
    set(s => ({
      project: {
        ...s.project,
        nodes: s.project.nodes.map(n => n.id === id ? { ...n, x, y } : n)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  createNodeAt: (x, y, type = 'scene') => {
    const { project } = get()
    const id = getAutoId(project.nodes)
    const node: StoryNode = {
      id,
      title: 'New Scene',
      type,
      status: 'todo',
      day: null,
      block: null,
      path: '',
      x,
      y,
      summary: '',
      trigger: '',
      chars: [],
      branches: [],
      dialogue: '',
      grokHandoff: '',
      consequences: '',
      background: null,
      music: null,
      sfx: null,
      transition: 'fade',
      dialogueLines: [],
      variables: [],
      isPov: false,
      povCharacter: null
    }
    get().addNode(node)
    return node
  },

  createPovNode: (afterNodeId, characterId) => {
    const { project } = get()
    const afterNode = project.nodes.find(n => n.id === afterNodeId)
    if (!afterNode) return null
    const char = project.characters.find(c => c.id === characterId)
    if (!char) return null

    // Generate unique ID: CHARNAME-1, CHARNAME-2, ...
    const baseName = char.name.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'POV'
    const existingCount = project.nodes.filter(n => n.isPov && n.povCharacter === characterId).length
    let seq = existingCount + 1
    let newId = `${baseName}-${seq}`
    while (project.nodes.some(n => n.id === newId)) { seq++; newId = `${baseName}-${seq}` }

    // Find the sequential outgoing edge from afterNode
    const seqEdge = project.edges.find(e => e.from === afterNodeId && !e.label)
    const nextNodeId = seqEdge?.to ?? null
    const nextNode = nextNodeId ? project.nodes.find(n => n.id === nextNodeId) : null

    // Position between predecessor and successor (offset up)
    const povX = nextNode ? (afterNode.x + nextNode.x) / 2 : afterNode.x + 220
    const povY = (nextNode ? (afterNode.y + nextNode.y) / 2 : afterNode.y) - 90

    const povNode: StoryNode = {
      id: newId,
      title: `${char.name} — POV`,
      type: 'scene',
      status: 'todo',
      day: afterNode.day,
      block: afterNode.block,
      path: '',
      x: povX,
      y: povY,
      summary: '',
      trigger: '',
      chars: [characterId],
      branches: [],
      dialogue: '',
      grokHandoff: '',
      consequences: '',
      background: null,
      music: null,
      sfx: null,
      transition: 'fade',
      dialogueLines: [],
      variables: [],
      isPov: true,
      povCharacter: characterId
    }

    get().snapshotForUndo('node_created')
    set(s => {
      // Remove existing sequential edge from afterNode
      const edges = s.project.edges.filter(e => e.id !== seqEdge?.id)
      // afterNode → povNode
      edges.push({ id: uuidv4(), from: afterNodeId, to: newId, label: '', desc: '', isDeath: false })
      // povNode → nextNode (if exists)
      if (nextNodeId) {
        edges.push({ id: uuidv4(), from: newId, to: nextNodeId, label: '', desc: '', isDeath: false })
      }
      return {
        project: { ...s.project, nodes: [...s.project.nodes, povNode], edges },
        isDirty: true
      }
    })
    scheduleAutoSave(get)
    return povNode
  },

  duplicateNode: (id) => {
    const { project } = get()
    const original = project.nodes.find(n => n.id === id)
    if (!original) return null
    const newId = getAutoId(project.nodes, id)
    const node: StoryNode = {
      ...original,
      id: newId,
      x: original.x + 40,
      y: original.y + 40,
      dialogueLines: original.dialogueLines.map(l => ({ ...l, id: uuidv4() })),
      branches: original.branches.map(b => ({ ...b }))
    }
    get().addNode(node)
    return node
  },

  // ── Edge ops ──────────────────────────────────────────────────────────

  addEdge: (edge) => {
    get().snapshotForUndo('edge_created')
    set(s => ({
      project: { ...s.project, edges: [...s.project.edges, edge] },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  updateEdge: (id, changes) => {
    set(s => ({
      project: {
        ...s.project,
        edges: s.project.edges.map(e => e.id === id ? { ...e, ...changes } : e)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  deleteEdge: (id) => {
    get().snapshotForUndo('edge_deleted')
    set(s => ({
      project: {
        ...s.project,
        edges: s.project.edges.filter(e => e.id !== id)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  deleteEdgesForNode: (nodeId) => {
    set(s => ({
      project: {
        ...s.project,
        edges: s.project.edges.filter(e => e.from !== nodeId && e.to !== nodeId)
      },
      isDirty: true
    }))
  },

  // ── Character ops ──────────────────────────────────────────────────────

  addCharacter: (character) => {
    set(s => ({
      project: { ...s.project, characters: [...s.project.characters, character] },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  updateCharacter: (id, changes) => {
    set(s => ({
      project: {
        ...s.project,
        characters: s.project.characters.map(c => c.id === id ? { ...c, ...changes } : c)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  deleteCharacter: (id) => {
    set(s => ({
      project: {
        ...s.project,
        characters: s.project.characters.filter(c => c.id !== id)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  // ── Variable ops ──────────────────────────────────────────────────────

  addVariable: (variable) => {
    set(s => ({
      project: { ...s.project, variables: [...s.project.variables, variable] },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  updateVariable: (id, changes) => {
    set(s => ({
      project: {
        ...s.project,
        variables: s.project.variables.map(v => v.id === id ? { ...v, ...changes } : v)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  deleteVariable: (id) => {
    set(s => ({
      project: {
        ...s.project,
        variables: s.project.variables.filter(v => v.id !== id)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  // ── Asset ops ──────────────────────────────────────────────────────────

  addAsset: (asset) => {
    set(s => ({
      project: { ...s.project, assets: [...s.project.assets, asset] },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  deleteAsset: (id) => {
    set(s => ({
      project: { ...s.project, assets: s.project.assets.filter(a => a.id !== id) },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  // ── Branch helpers ─────────────────────────────────────────────────────

  updateBranches: (nodeId, branches) => {
    set(s => ({
      project: {
        ...s.project,
        nodes: s.project.nodes.map(n => n.id === nodeId ? { ...n, branches } : n)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  // ── Dialogue helpers ───────────────────────────────────────────────────

  updateDialogueLines: (nodeId, lines) => {
    set(s => ({
      project: {
        ...s.project,
        nodes: s.project.nodes.map(n => n.id === nodeId ? { ...n, dialogueLines: lines } : n)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  addDialogueLine: (nodeId) => {
    const line: DialogueLine = {
      id: uuidv4(),
      speaker: null,
      text: '',
      characterPose: null,
      position: 'center',
      sfx: null
    }
    const node = get().project.nodes.find(n => n.id === nodeId)
    if (!node) return
    get().updateDialogueLines(nodeId, [...node.dialogueLines, line])
  },

  // ── Variable effects helpers ───────────────────────────────────────────

  updateVariableEffects: (nodeId, effects) => {
    set(s => ({
      project: {
        ...s.project,
        nodes: s.project.nodes.map(n => n.id === nodeId ? { ...n, variables: effects } : n)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  // ── Playthrough ops ────────────────────────────────────────────────────

  addPlaythrough: (pt) => {
    set(s => ({
      project: {
        ...s.project,
        playthroughs: [...s.project.playthroughs, pt]
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  deletePlaythrough: (id) => {
    set(s => ({
      project: {
        ...s.project,
        playthroughs: s.project.playthroughs.filter(p => p.id !== id)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  renamePlaythrough: (id, name) => {
    set(s => ({
      project: {
        ...s.project,
        playthroughs: s.project.playthroughs.map(p => p.id === id ? { ...p, name } : p)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  // ── Writer's Room ops ──────────────────────────────────────────────────

  updateWriterRoomSection: (id, changes) => {
    set(s => ({
      project: {
        ...s.project,
        writerRoom: s.project.writerRoom.map(sec => sec.id === id ? { ...sec, ...changes } : sec)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  addWriterRoomSection: (section) => {
    set(s => ({
      project: {
        ...s.project,
        writerRoom: [...s.project.writerRoom, section]
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  deleteWriterRoomSection: (id) => {
    set(s => ({
      project: {
        ...s.project,
        writerRoom: s.project.writerRoom.filter(sec => sec.id !== id)
      },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  reorderWriterRoomSections: (sections) => {
    set(s => ({
      project: { ...s.project, writerRoom: sections },
      isDirty: true
    }))
    scheduleAutoSave(get)
  },

  // ── Undo/Redo ──────────────────────────────────────────────────────────

  snapshotForUndo: (type) => {
    const { project, undoStack } = get()
    const snapshot: UndoAction = {
      type,
      before: JSON.parse(JSON.stringify({ nodes: project.nodes, edges: project.edges })),
      after: {}
    }
    set({ undoStack: [...undoStack.slice(-49), snapshot], redoStack: [] })
  },

  undo: () => {
    const { undoStack, project } = get()
    if (!undoStack.length) return
    const action = undoStack[undoStack.length - 1]
    const current: UndoAction = {
      ...action,
      after: JSON.parse(JSON.stringify({ nodes: project.nodes, edges: project.edges }))
    }
    set(s => ({
      project: { ...s.project, ...(action.before as any) },
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, current],
      isDirty: true
    }))
  },

  redo: () => {
    const { redoStack, project } = get()
    if (!redoStack.length) return
    const action = redoStack[redoStack.length - 1]
    const current: UndoAction = {
      ...action,
      before: JSON.parse(JSON.stringify({ nodes: project.nodes, edges: project.edges }))
    }
    set(s => ({
      project: { ...s.project, ...(action.after as any) },
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, current],
      isDirty: true
    }))
  },

  // ── Panel navigation ───────────────────────────────────────────────────

  navigateTo: (nodeId) => {
    const { project, panelNavHistory, selectedNodeId } = get()
    const exists = project.nodes.some(n => n.id === nodeId)
    if (!exists) return
    const newHistory = selectedNodeId && selectedNodeId !== nodeId
      ? [...panelNavHistory.slice(-9), selectedNodeId]
      : panelNavHistory
    set({ selectedNodeId: nodeId, panelNavHistory: newHistory })
  },

  // ── Save ───────────────────────────────────────────────────────────────

  markSaved: (path) => set(s => ({
    isDirty: false,
    project: {
      ...s.project,
      lastSaved: Date.now(),
      projectPath: path ?? s.project.projectPath
    }
  })),

  markDirty: () => set({ isDirty: true })
}))

// ── Auto-save helper ───────────────────────────────────────────────────────

let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleAutoSave(get: () => AppState) {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout)
  autoSaveTimeout = setTimeout(() => {
    triggerSave(get())
  }, 30000)
}

async function triggerSave(state: AppState) {
  const { project } = state
  if (!project.projectPath) return
  const data = JSON.stringify(buildExportData(project), null, 2)
  const ok = await window.electronAPI?.writeFile(project.projectPath, data)
  if (ok) state.markSaved()
}

function buildExportData(project: Project) {
  return {
    meta: {
      app: 'Narrative Flow',
      version: '2.0',
      exported: new Date().toISOString(),
      projectName: project.name
    },
    nodes: project.nodes,
    edges: project.edges,
    characters: project.characters,
    variables: project.variables,
    assets: project.assets,
    playthroughs: project.playthroughs,
    writerRoom: project.writerRoom
  }
}
