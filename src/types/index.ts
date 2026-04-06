// ── Core Data Types ────────────────────────────────────────────────────────

export type NodeType = 'scene' | 'decision' | 'grok' | 'death' | 'ending'
export type NodeStatus = 'todo' | 'inprog' | 'done'
export type BlockType = 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'All'
export type TransitionType = 'fade' | 'cut' | 'slide-left' | 'slide-right'
export type DialoguePosition = 'left' | 'center' | 'right'
export type AssetType = 'image' | 'audio'
export type VariableType = 'string' | 'boolean' | 'number'
export type VariableOperation = 'set' | 'add' | 'subtract' | 'toggle'

export interface Branch {
  option: string
  desc: string
  leads: string[]
  effects: string[]
  condition: string | null
}

export interface DialogueLine {
  id: string
  speaker: string | null
  text: string
  characterPose: string | null
  position: DialoguePosition
  sfx: string | null
}

export interface Sprite {
  id: string
  label: string
  assetId: string
}

export interface Character {
  id: string
  name: string
  color: string
  sprites: Sprite[]
}

export interface Asset {
  id: string
  name: string
  type: AssetType
  filename: string
  path: string
}

export interface Variable {
  id: string
  name: string
  type: VariableType
  defaultValue: string | boolean | number
}

export interface VariableEffect {
  variableId: string
  operation: VariableOperation
  value: string | boolean | number
}

export interface StoryNode {
  id: string
  title: string
  type: NodeType
  status: NodeStatus
  day: number | null
  block: BlockType | null
  path: string
  x: number
  y: number
  summary: string
  trigger: string
  chars: string[]
  branches: Branch[]
  dialogue: string
  grokHandoff: string
  consequences: string
  background: string | null
  music: string | null
  sfx: string | null
  transition: TransitionType
  dialogueLines: DialogueLine[]
  variables: VariableEffect[]
  // POV system
  isPov: boolean
  povCharacter: string | null
}

export interface Edge {
  id: string
  from: string
  to: string
  label: string
  desc: string
  isDeath: boolean
}

// ── Playthrough Simulator ─────────────────────────────────────────────────

export interface PlaythroughStep {
  nodeId: string
  nodeTitle: string
  choiceMade: string | null   // branch.option or null if sequential
  choiceDesc: string | null
  effectsApplied: string[]    // human-readable e.g. "loyalty +1"
  varStateAfter: VariableState
}

export interface Playthrough {
  id: string
  name: string
  startNodeId: string
  steps: PlaythroughStep[]
  endNodeId: string | null
  endType: 'ending' | 'death' | 'stopped'
  createdAt: number
}

// ── Writer's Room ─────────────────────────────────────────────────────────

export interface WriterRoomSection {
  id: string
  title: string
  content: string
  order: number
}

// ── Conflict Detector (UI-only, not persisted) ────────────────────────────

export type ConflictIssueType =
  | 'orphan'
  | 'dead-end'
  | 'broken-connection'
  | 'empty-decision'
  | 'undefined-variable'
  | 'unwritten'
  | 'circular-trap'

export interface ConflictIssue {
  id: string
  type: ConflictIssueType
  severity: 'error' | 'warning' | 'info'
  nodeId: string | null
  description: string
  suggestion: string
}

// ── Project ───────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  nodes: StoryNode[]
  edges: Edge[]
  characters: Character[]
  variables: Variable[]
  assets: Asset[]
  projectPath: string | null
  lastSaved: number | null
  // New persisted fields:
  playthroughs: Playthrough[]
  writerRoom: WriterRoomSection[]
}

// ── App Mode ──────────────────────────────────────────────────────────────

export type AppMode = 'graph' | 'scene' | 'play'

// ── Canvas State ──────────────────────────────────────────────────────────

export interface CanvasTransform {
  x: number
  y: number
  scale: number
}

// ── Undo/Redo ─────────────────────────────────────────────────────────────

export type UndoActionType =
  | 'node_created'
  | 'node_deleted'
  | 'node_moved'
  | 'edge_created'
  | 'edge_deleted'
  | 'field_edited'
  | 'layout_changed'

export interface UndoAction {
  type: UndoActionType
  before: Partial<Project>
  after: Partial<Project>
}

// ── Export ────────────────────────────────────────────────────────────────

export interface ExportMeta {
  app: string
  version: string
  exported: string
  projectName: string
}

export interface ExportData {
  meta: ExportMeta
  nodes: StoryNode[]
  edges: Edge[]
  characters: Character[]
  variables: Variable[]
  assets: Asset[]
  playthroughs?: Playthrough[]
  writerRoom?: WriterRoomSection[]
}

// ── Variable Runtime ──────────────────────────────────────────────────────

export type VariableState = Record<string, string | boolean | number>

// ── ElectronAPI (for window global) ──────────────────────────────────────

export interface ElectronAPI {
  openFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>
  saveFile: (
    filters: { name: string; extensions: string[] }[],
    defaultPath?: string
  ) => Promise<string | null>
  readFile: (path: string) => Promise<string | null>
  readFileBase64: (path: string) => Promise<string | null>
  writeFile: (path: string, content: string) => Promise<boolean>
  copyAsset: (src: string, destDir: string) => Promise<string | null>
  exists: (path: string) => Promise<boolean>
  openExternal: (url: string) => Promise<void>
  showItemInFolder: (path: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
