import React from 'react'
import { useStore } from '../../store'
import type { StoryNode, DialogueLine, Asset, Character } from '../../types'
import { fileUrl } from '../../utils/fileUrl'

interface Props {
  node: StoryNode
  currentLine: DialogueLine | null
  assets: Asset[]
  characters: Character[]
}

export default function ScenePreview({ node, currentLine, assets, characters }: Props) {
  const setMode = useStore(s => s.setMode)

  const bgAsset = node.background ? assets.find(a => a.id === node.background) : null

  const speaker = currentLine?.speaker
    ? characters.find(c => c.id === currentLine.speaker)
    : null

  // Characters in scene with their sprites
  const sceneChars = node.chars.map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[]

  function getSpriteAsset(char: Character, poseId: string | null): Asset | null {
    const sprite = poseId
      ? char.sprites.find(s => s.id === poseId)
      : char.sprites[0]
    if (!sprite) return null
    return assets.find(a => a.id === sprite.assetId) ?? null
  }

  const positions = ['left', 'center', 'right'] as const
  const charAtPosition: Record<string, Character | null> = {
    left: null, center: null, right: null
  }

  if (currentLine?.speaker) {
    const spChar = characters.find(c => c.id === currentLine.speaker)
    if (spChar) charAtPosition[currentLine.position] = spChar
  }

  // Also show all scene chars not in dialogue
  sceneChars.forEach(c => {
    if (!Object.values(charAtPosition).includes(c)) {
      for (const pos of positions) {
        if (!charAtPosition[pos]) { charAtPosition[pos] = c; break }
      }
    }
  })

  return (
    <div style={{
      flex: 1,
      position: 'relative',
      background: '#000',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Background */}
      {bgAsset ? (
        <img
          src={fileUrl(bgAsset.path)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          alt="background"
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, #0a0f1a, #1a2035)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ color: '#2a3448', fontSize: 14 }}>No background set</span>
        </div>
      )}

      {/* Characters */}
      <div style={{
        position: 'absolute',
        bottom: 130,
        left: 0, right: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        padding: '0 40px'
      }}>
        {positions.map(pos => {
          const char = charAtPosition[pos]
          if (!char) return <div key={pos} style={{ flex: 1 }} />

          const isActive = currentLine?.speaker === char.id
          const poseId = currentLine?.speaker === char.id ? currentLine.characterPose : null
          const spriteAsset = getSpriteAsset(char, poseId)

          return (
            <div
              key={pos}
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                opacity: isActive ? 1 : 0.6,
                filter: isActive ? 'none' : 'brightness(0.6)',
                transition: 'opacity 0.3s, filter 0.3s'
              }}
            >
              {spriteAsset ? (
                <img
                  src={fileUrl(spriteAsset.path)}
                  style={{ maxHeight: 280, objectFit: 'contain' }}
                  alt={char.name}
                />
              ) : (
                <div style={{
                  width: 80, height: 180,
                  background: char.color + '33',
                  border: `2px solid ${char.color}`,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: char.color,
                  fontSize: 12
                }}>{char.name[0]}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Dialogue box */}
      {currentLine && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          background: 'rgba(10, 15, 30, 0.9)',
          borderTop: '1px solid #2a3448',
          padding: '12px 20px',
          minHeight: 120
        }}>
          {speaker && (
            <div style={{ color: speaker.color, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
              {speaker.name}
            </div>
          )}
          <div style={{
            color: speaker ? speaker.color : '#e8ecf4',
            fontSize: 15,
            lineHeight: 1.6
          }}>
            {currentLine.text || <span style={{ color: '#3a4a68' }}>No text</span>}
          </div>
        </div>
      )}

      {/* Play from here button */}
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: 12 }}
          onClick={() => setMode('play', node.id)}
        >▶ Play from here</button>
      </div>
    </div>
  )
}
