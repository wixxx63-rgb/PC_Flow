import React, { useRef, useEffect, useCallback } from 'react'
import type { StoryNode, CanvasTransform } from '../../types'

const COLORS = {
  scene: '#4a80d4',
  decision: '#d4a040',
  grok: '#9060d0',
  death: '#d04040',
  ending: '#40a060'
}

const MAP_W = 200
const MAP_H = 130

interface MinimapProps {
  nodes: StoryNode[]
  canvasRef: React.RefObject<HTMLCanvasElement>
  transform: CanvasTransform
  onJump: (worldX: number, worldY: number) => void
}

export default function Minimap({ nodes, canvasRef, transform, onJump }: MinimapProps) {
  const mmRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const mm = mmRef.current
    if (!mm) return
    const ctx = mm.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, MAP_W, MAP_H)
    ctx.fillStyle = '#0f1117cc'
    ctx.fillRect(0, 0, MAP_W, MAP_H)

    if (!nodes.length) return

    // Compute bounds
    const xs = nodes.map(n => n.x)
    const ys = nodes.map(n => n.y)
    const minX = Math.min(...xs) - 100
    const maxX = Math.max(...xs) + 100
    const minY = Math.min(...ys) - 100
    const maxY = Math.max(...ys) + 100
    const worldW = maxX - minX || 1
    const worldH = maxY - minY || 1

    const scaleX = MAP_W / worldW
    const scaleY = MAP_H / worldH
    const scale = Math.min(scaleX, scaleY) * 0.85
    const offsetX = (MAP_W - worldW * scale) / 2 - minX * scale
    const offsetY = (MAP_H - worldH * scale) / 2 - minY * scale

    // Draw nodes as dots
    nodes.forEach(n => {
      const nx = n.x * scale + offsetX
      const ny = n.y * scale + offsetY
      ctx.beginPath()
      ctx.arc(nx, ny, 3, 0, Math.PI * 2)
      ctx.fillStyle = COLORS[n.type]
      ctx.fill()
    })

    // Draw viewport rectangle
    const canvas = canvasRef.current
    if (canvas) {
      const viewW = canvas.width
      const viewH = canvas.height
      const vpX = (-transform.x / transform.scale) * scale + offsetX
      const vpY = (-transform.y / transform.scale) * scale + offsetY
      const vpW = (viewW / transform.scale) * scale
      const vpH = (viewH / transform.scale) * scale
      ctx.strokeStyle = '#4a80d4'
      ctx.lineWidth = 1
      ctx.strokeRect(vpX, vpY, vpW, vpH)
    }
  })

  const handleClick = useCallback((e: React.MouseEvent) => {
    const mm = mmRef.current
    if (!mm || !nodes.length) return
    const rect = mm.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const xs = nodes.map(n => n.x)
    const ys = nodes.map(n => n.y)
    const minX = Math.min(...xs) - 100
    const maxX = Math.max(...xs) + 100
    const minY = Math.min(...ys) - 100
    const maxY = Math.max(...ys) + 100
    const worldW = maxX - minX || 1
    const worldH = maxY - minY || 1
    const scaleX = MAP_W / worldW
    const scaleY = MAP_H / worldH
    const scale = Math.min(scaleX, scaleY) * 0.85
    const offsetX = (MAP_W - worldW * scale) / 2 - minX * scale
    const offsetY = (MAP_H - worldH * scale) / 2 - minY * scale

    const wx = (mx - offsetX) / scale
    const wy = (my - offsetY) / scale
    onJump(wx, wy)
  }, [nodes, onJump])

  return (
    <canvas
      ref={mmRef}
      width={MAP_W}
      height={MAP_H}
      onClick={handleClick}
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        width: MAP_W,
        height: MAP_H,
        border: '1px solid #2a3448',
        borderRadius: 6,
        cursor: 'pointer',
        opacity: 0.9
      }}
    />
  )
}
