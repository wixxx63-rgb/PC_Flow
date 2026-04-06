import React, { useState, useRef, useEffect } from 'react'

interface EdgePopoverProps {
  x: number
  y: number
  onConfirm: (label: string) => void
  onCancel: () => void
}

export default function EdgePopover({ x, y, onConfirm, onCancel }: EdgePopoverProps) {
  const [label, setLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onConfirm(label)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        background: '#1a2032',
        border: '1px solid #3a4a68',
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        zIndex: 10,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        minWidth: 200
      }}
    >
      <input
        ref={inputRef}
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Edge label (optional)"
        style={{ flex: 1, fontSize: 13 }}
      />
      <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onConfirm(label)}>
        Add
      </button>
      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={onCancel}>
        ✕
      </button>
    </div>
  )
}
