import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../../store'
import type { Character, VariableState } from '../../types'
import { buildDefaultState, applyEffects, applyBranchEffects, evaluateCondition } from '../../utils/variables'
import { fileUrl } from '../../utils/fileUrl'

// 'main' = protagonist only (isPov false), 'full' = all nodes, or a characterId for that character's POV only
type PlayPerspective = 'main' | 'full' | string

interface PlayState {
  nodeId: string
  lineIndex: number
  varState: VariableState
  transitioning: boolean
  transitionType: string
  showChoices: boolean
  perspective: PlayPerspective
}

export default function PlayEngine() {
  const { project, playFromNodeId, mode } = useStore(s => ({
    project: s.project,
    playFromNodeId: s.playFromNodeId,
    mode: s.mode
  }))
  const setMode = useStore(s => s.setMode)

  const [state, setState] = useState<PlayState | null>(null)
  const [volume, setVolume] = useState(0.8)
  const [showSettings, setShowSettings] = useState(false)
  // perspective selector shown before play starts
  const [perspective, setPerspective] = useState<PlayPerspective>('main')
  const [perspectiveChosen, setPerspectiveChosen] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sfxRef = useRef<HTMLAudioElement | null>(null)

  // Characters with POV nodes
  const povCharacters = project.characters.filter(c =>
    project.nodes.some(n => n.isPov && n.povCharacter === c.id)
  )

  // Reset perspective selector when play mode is entered
  useEffect(() => {
    if (mode === 'play') { setPerspectiveChosen(false); setState(null) }
  }, [mode, playFromNodeId])

  function startPlay(p: PlayPerspective) {
    if (!playFromNodeId) return
    setPerspective(p)
    setPerspectiveChosen(true)

    let startNodeId = playFromNodeId
    // For POV-only: find first node of this character
    if (p !== 'main' && p !== 'full') {
      const firstPov = project.nodes.find(n => n.isPov && n.povCharacter === p)
      if (firstPov) startNodeId = firstPov.id
    }

    const initialVars = buildDefaultState(project.variables)
    const node = project.nodes.find(n => n.id === startNodeId)
    if (!node) return
    const varState = applyEffects(initialVars, node.variables)
    setState({
      nodeId: startNodeId,
      lineIndex: 0,
      varState,
      transitioning: true,
      transitionType: node.transition,
      showChoices: false,
      perspective: p
    })
    setTimeout(() => setState(s => s ? { ...s, transitioning: false } : s), 600)
  }

  // Legacy init: when no perspective chosen yet, wait for user selection
  useEffect(() => {
    if (mode !== 'play' || !playFromNodeId) return
    // Don't auto-start; show perspective selector
  }, [mode, playFromNodeId, project.variables])

  const currentNode = state ? project.nodes.find(n => n.id === state.nodeId) : null

  // Play music when node changes
  useEffect(() => {
    if (!currentNode) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (currentNode.music) {
      const asset = project.assets.find(a => a.id === currentNode.music)
      if (asset) {
        const audio = new Audio(fileUrl(asset.path))
        audio.loop = true
        audio.volume = volume
        audio.play().catch(() => {})
        audioRef.current = audio
      }
    }
    return () => { audioRef.current?.pause() }
  }, [state?.nodeId])

  // Update volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  /** Check if a given nodeId is valid to visit for this perspective */
  function isNodeAllowed(nodeId: string, persp: PlayPerspective): boolean {
    const n = project.nodes.find(nd => nd.id === nodeId)
    if (!n) return false
    if (persp === 'full') return true
    if (persp === 'main') return !n.isPov
    // character POV: only that character's POV nodes
    return n.isPov && n.povCharacter === persp
  }

  const advance = useCallback(() => {
    if (!state || !currentNode) return
    if (state.showChoices) return

    const lines = currentNode.dialogueLines
    const nextIndex = state.lineIndex + 1

    if (nextIndex < lines.length) {
      const line = lines[nextIndex]
      if (line.sfx) {
        const asset = project.assets.find(a => a.id === line.sfx)
        if (asset) {
          sfxRef.current = new Audio(fileUrl(asset.path))
          sfxRef.current.volume = volume
          sfxRef.current.play().catch(() => {})
        }
      }
      setState(s => s ? { ...s, lineIndex: nextIndex } : s)
      return
    }

    // End of lines — check outgoing edges
    const outgoing = project.edges.filter(e => e.from === state.nodeId)
    // For POV perspective: choices are not shown, only sequential
    const choiceEdges = state.perspective === 'main' ? outgoing.filter(e => e.label) : []
    const sequentialEdges = outgoing.filter(e => !e.label)

    // For main/full perspective: check branches
    const validBranches = (state.perspective === 'main' || state.perspective === 'full')
      ? currentNode.branches.filter(b => evaluateCondition(b.condition, state.varState, project.variables))
      : []

    if (validBranches.length > 0 || choiceEdges.length > 0) {
      setState(s => s ? { ...s, showChoices: true } : s)
      return
    }

    // Find next allowed sequential node
    for (const e of sequentialEdges) {
      if (isNodeAllowed(e.to, state.perspective)) {
        gotoNode(e.to, state.varState, state.perspective)
        return
      }
      // For POV-only: skip non-POV nodes transparently to find next POV
      if (state.perspective !== 'main' && state.perspective !== 'full') {
        let cur: string | null = e.to
        while (cur) {
          if (isNodeAllowed(cur, state.perspective)) {
            gotoNode(cur, state.varState, state.perspective)
            return
          }
          const nextEdge = project.edges.find(ed => ed.from === cur && !ed.label)
          cur = nextEdge?.to ?? null
        }
      }
    }

    // End of story
    setState(s => s ? { ...s, showChoices: true } : s)
  }, [state, currentNode, project])

  function gotoNode(nodeId: string, currentVars: VariableState, persp?: PlayPerspective) {
    const node = project.nodes.find(n => n.id === nodeId)
    if (!node) return
    const newVars = applyEffects(currentVars, node.variables)
    setState(s => ({
      nodeId,
      lineIndex: 0,
      varState: newVars,
      transitioning: true,
      transitionType: node.transition,
      showChoices: false,
      perspective: persp ?? s?.perspective ?? 'main'
    }))
    setTimeout(() => setState(s => s ? { ...s, transitioning: false } : s), 600)
  }

  function handleChoice(branchOption: string) {
    if (!state || !currentNode) return
    const branch = currentNode.branches.find(b => b.option === branchOption)
    if (!branch) return

    let newVars = applyBranchEffects(state.varState, branch.effects, project.variables)

    const target = branch.leads[0]
    if (!target) return

    const targetNode = project.nodes.find(n => n.id === target)
    if (targetNode) {
      newVars = applyEffects(newVars, targetNode.variables)
      setState(s => ({
        nodeId: target,
        lineIndex: 0,
        varState: newVars,
        transitioning: true,
        transitionType: targetNode.transition,
        showChoices: false,
        perspective: s?.perspective ?? 'main'
      }))
      setTimeout(() => setState(s => s ? { ...s, transitioning: false } : s), 600)
    }
  }

  // Keyboard handler
  useEffect(() => {
    if (mode !== 'play') return
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, advance])

  // Show perspective selector before play begins
  if (mode === 'play' && !perspectiveChosen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#060810', zIndex: 50,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#e8ecf4', marginBottom: 8 }}>
          {project.name}
        </div>
        <div style={{ fontSize: 13, color: '#9aa5bb', marginBottom: 16 }}>Choose your perspective</div>

        {/* Protagonist / main path */}
        <button
          style={{
            background: 'rgba(10,32,68,0.9)', border: '1px solid #4a80d4',
            borderRadius: 8, padding: '14px 28px', color: '#e8ecf4',
            fontSize: 15, cursor: 'pointer', minWidth: 280, textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0a3060')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(10,32,68,0.9)')}
          onClick={() => startPlay('main')}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Protagonist</div>
          <div style={{ fontSize: 12, color: '#9aa5bb' }}>Main path only</div>
        </button>

        {/* Per-character POV */}
        {povCharacters.map(c => (
          <button
            key={c.id}
            style={{
              background: c.color + '18', border: `1px solid ${c.color}80`,
              borderRadius: 8, padding: '14px 28px', color: '#e8ecf4',
              fontSize: 15, cursor: 'pointer', minWidth: 280, textAlign: 'left',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = c.color + '30')}
            onMouseLeave={e => (e.currentTarget.style.background = c.color + '18')}
            onClick={() => startPlay(c.id)}
          >
            <div style={{ fontWeight: 700, marginBottom: 4, color: c.color }}>{c.name}</div>
            <div style={{ fontSize: 12, color: '#9aa5bb' }}>POV scenes only</div>
          </button>
        ))}

        {/* Full story */}
        <button
          style={{
            background: 'rgba(10,18,40,0.6)', border: '1px solid #3a4a68',
            borderRadius: 8, padding: '14px 28px', color: '#e8ecf4',
            fontSize: 15, cursor: 'pointer', minWidth: 280, textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(20,30,60,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(10,18,40,0.6)')}
          onClick={() => startPlay('full')}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Full story</div>
          <div style={{ fontSize: 12, color: '#9aa5bb' }}>All nodes — main path and all POV perspectives</div>
        </button>

        <button
          className="btn btn-ghost"
          style={{ marginTop: 8, fontSize: 12 }}
          onClick={() => setMode('graph')}
        >◀ Back to editor</button>
      </div>
    )
  }

  if (mode !== 'play' || !state || !currentNode) return null

  const currentLine = currentNode.dialogueLines[state.lineIndex] ?? null
  const speaker = currentLine?.speaker ? project.characters.find(c => c.id === currentLine.speaker) : null
  const bgAsset = currentNode.background ? project.assets.find(a => a.id === currentNode.background) : null
  // POV indicator: show which character's perspective is active
  const povIndicatorChar = currentNode.isPov && currentNode.povCharacter
    ? project.characters.find(c => c.id === currentNode.povCharacter)
    : null

  // Character positions
  const positions = ['left', 'center', 'right'] as const
  const charAtPosition: Record<string, Character | null> = { left: null, center: null, right: null }

  if (currentLine?.speaker) {
    const spChar = project.characters.find(c => c.id === currentLine.speaker)
    if (spChar) charAtPosition[currentLine.position] = spChar
  }

  currentNode.chars.forEach(id => {
    const c = project.characters.find(ch => ch.id === id)
    if (!c) return
    if (!Object.values(charAtPosition).includes(c)) {
      for (const pos of positions) {
        if (!charAtPosition[pos]) { charAtPosition[pos] = c; break }
      }
    }
  })

  // Valid choices
  const validChoices = currentNode.branches.filter(b =>
    evaluateCondition(b.condition, state.varState, project.variables)
  )

  const isEnd = state.showChoices && validChoices.length === 0 &&
    project.edges.filter(e => e.from === state.nodeId && !e.label).length === 0

  const transitionStyle: React.CSSProperties = state.transitioning
    ? { opacity: 0, transform: getTransitionTransform(state.transitionType) }
    : { opacity: 1, transform: 'none', transition: 'opacity 0.5s ease, transform 0.5s ease' }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 50,
        cursor: 'pointer',
        ...transitionStyle
      }}
      onClick={() => !state.showChoices && advance()}
    >
      {/* Background */}
      {bgAsset ? (
        <img
          src={fileUrl(bgAsset.path)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          alt=""
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, #050810, #0a1020)'
        }} />
      )}

      {/* Characters */}
      <div style={{
        position: 'absolute',
        bottom: 160,
        left: 0, right: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        padding: '0 60px',
        pointerEvents: 'none'
      }}>
        {positions.map(pos => {
          const char = charAtPosition[pos]
          if (!char) return <div key={pos} style={{ flex: 1 }} />
          const isActive = currentLine?.speaker === char.id
          const poseId = currentLine?.speaker === char.id ? currentLine.characterPose : null
          const sprite = poseId ? char.sprites.find(s => s.id === poseId) : char.sprites[0]
          const spriteAsset = sprite ? project.assets.find(a => a.id === sprite.assetId) : null

          return (
            <div key={pos} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                opacity: isActive ? 1 : 0.6,
                filter: isActive ? 'none' : 'brightness(0.5)',
                transition: 'opacity 0.3s, filter 0.3s'
              }}>
                {spriteAsset ? (
                  <img
                    src={fileUrl(spriteAsset.path)}
                    style={{ maxHeight: '60vh', objectFit: 'contain' }}
                    alt={char.name}
                  />
                ) : (
                  <div style={{
                    width: 120, height: 300,
                    background: char.color + '22',
                    border: `2px solid ${char.color}`,
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: char.color, fontSize: 14, fontWeight: 700
                  }}>{char.name[0]}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dialogue box */}
      {currentLine && !state.showChoices && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          background: 'rgba(8, 12, 24, 0.92)',
          borderTop: '1px solid #2a3448',
          padding: '18px 60px 24px',
          minHeight: 150,
          backdropFilter: 'blur(4px)'
        }}>
          {speaker && (
            <div style={{ color: speaker.color, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              {speaker.name}
            </div>
          )}
          <div style={{
            color: speaker ? speaker.color : '#e8ecf4',
            fontSize: 16,
            lineHeight: 1.7,
            maxWidth: 800
          }}>
            {currentLine.text}
          </div>
          <div style={{ position: 'absolute', bottom: 10, right: 20, color: '#3a4a68', fontSize: 11 }}>
            Click or Space to continue
          </div>
        </div>
      )}

      {/* No dialogue */}
      {!currentLine && !state.showChoices && (
        <div style={{
          position: 'absolute', bottom: 24, right: 24,
          color: '#3a4a68', fontSize: 12
        }}>Click to continue</div>
      )}

      {/* Choices */}
      {state.showChoices && !isEnd && (
        <div style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minWidth: 400,
          maxWidth: 600
        }} onClick={e => e.stopPropagation()}>
          {validChoices.map(branch => (
            <button
              key={branch.option}
              style={{
                background: 'rgba(10,18,40,0.95)',
                border: '1px solid #3a4a68',
                borderRadius: 8,
                padding: '14px 20px',
                color: '#e8ecf4',
                fontSize: 15,
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
                textAlign: 'left',
                backdropFilter: 'blur(4px)'
              }}
              onMouseEnter={e => {
                ;(e.target as HTMLElement).style.borderColor = '#4a80d4'
                ;(e.target as HTMLElement).style.background = 'rgba(20,40,80,0.95)'
              }}
              onMouseLeave={e => {
                ;(e.target as HTMLElement).style.borderColor = '#3a4a68'
                ;(e.target as HTMLElement).style.background = 'rgba(10,18,40,0.95)'
              }}
              onClick={() => handleChoice(branch.option)}
            >
              <span style={{ color: '#d4a040', marginRight: 10, fontWeight: 700 }}>{branch.option}</span>
              {branch.desc}
            </button>
          ))}
        </div>
      )}

      {/* End screen */}
      {isEnd && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)'
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#e8ecf4', marginBottom: 8 }}>
            {currentNode.type === 'ending' ? 'The End' : currentNode.type === 'death' ? 'Game Over' : 'End'}
          </div>
          {currentNode.title && (
            <div style={{ fontSize: 18, color: '#9aa5bb', marginBottom: 32 }}>{currentNode.title}</div>
          )}
          <button
            className="btn btn-primary"
            style={{ fontSize: 14, padding: '10px 24px' }}
            onClick={() => setMode('graph')}
          >Back to Editor</button>
        </div>
      )}

      {/* POV indicator badge */}
      {povIndicatorChar && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: povIndicatorChar.color + '22',
          border: `1px solid ${povIndicatorChar.color}80`,
          borderRadius: 20, padding: '4px 14px',
          fontSize: 12, fontWeight: 700, color: povIndicatorChar.color,
          pointerEvents: 'none'
        }}>
          {povIndicatorChar.name}'s POV
        </div>
      )}

      {/* HUD */}
      <div style={{ position: 'absolute', top: 12, left: 12 }} onClick={e => e.stopPropagation()}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMode('graph')}
        >◀ Back</button>
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12 }} onClick={e => e.stopPropagation()}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowSettings(v => !v)}
        >⚙ Settings</button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          style={{
            position: 'absolute', top: 48, right: 12,
            background: 'rgba(15,20,40,0.97)',
            border: '1px solid #3a4a68',
            borderRadius: 8,
            padding: '14px 16px',
            minWidth: 200,
            zIndex: 60
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Settings</div>
          <div style={{ marginBottom: 10 }}>
            <label className="field-label">Volume</label>
            <input type="range" min={0} max={1} step={0.05} value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#4a80d4' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function getTransitionTransform(transition: string): string {
  switch (transition) {
    case 'slide-left': return 'translateX(-30px)'
    case 'slide-right': return 'translateX(30px)'
    default: return 'none'
  }
}
