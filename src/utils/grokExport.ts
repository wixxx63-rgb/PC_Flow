import type { Project, StoryNode, BlockType } from '../types'

const BLOCK_ORDER: Record<string, number> = {
  Morning: 0, Afternoon: 1, Evening: 2, Night: 3, All: 4
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>')
}

export function buildGrokHTML(project: Project): string {
  // Collect grok nodes
  const grokNodes = project.nodes.filter(n => n.type === 'grok' || n.grokHandoff.trim())

  if (grokNodes.length === 0) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Grok Export — ${escapeHtml(project.name)}</title></head>
<body style="font-family:sans-serif;padding:40px;color:#333">
<h1>${escapeHtml(project.name)} — Grok Scenes</h1>
<p style="color:#666">No grok-type nodes or nodes with grok handoff text found in this project.</p>
</body></html>`
  }

  // Sort: by day (null last), then by block order
  const sorted = [...grokNodes].sort((a, b) => {
    const dayA = a.day ?? Infinity
    const dayB = b.day ?? Infinity
    if (dayA !== dayB) return dayA - dayB
    const blockA = BLOCK_ORDER[a.block ?? ''] ?? 99
    const blockB = BLOCK_ORDER[b.block ?? ''] ?? 99
    return blockA - blockB
  })

  // Group by day
  const byDay = new Map<number | null, StoryNode[]>()
  sorted.forEach(n => {
    const day = n.day
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(n)
  })

  const sections: string[] = []
  byDay.forEach((nodes, day) => {
    const dayLabel = day != null ? `Day ${day}` : 'Unscheduled'
    const cards = nodes.map(n => {
      const blockBadge = n.block
        ? `<span style="display:inline-block;background:#4a3080;color:#d0b0ff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px">${escapeHtml(n.block)}</span>`
        : ''
      const typeBadge = n.type === 'grok'
        ? `<span style="display:inline-block;background:#6030a0;color:#e0c0ff;font-size:11px;padding:2px 8px;border-radius:10px;margin-right:8px">grok</span>`
        : `<span style="display:inline-block;background:#2a3448;color:#9aa5bb;font-size:11px;padding:2px 8px;border-radius:10px;margin-right:8px">${escapeHtml(n.type)}</span>`
      const summary = n.summary.trim()
        ? `<div style="color:#555;font-size:13px;margin:8px 0;line-height:1.5">${escapeHtml(n.summary)}</div>`
        : ''
      const handoff = n.grokHandoff.trim()
        ? `<div style="background:#f5f0ff;border-left:4px solid #9060d0;padding:10px 14px;margin-top:10px;border-radius:0 6px 6px 0">
             <div style="font-size:11px;color:#9060d0;font-weight:700;margin-bottom:4px;letter-spacing:0.05em">GROK HANDOFF</div>
             <div style="font-size:13px;color:#333;line-height:1.6">${escapeHtml(n.grokHandoff.trim())}</div>
           </div>`
        : ''
      return `<div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06)">
  <div style="display:flex;align-items:center;margin-bottom:6px">
    ${typeBadge}
    <strong style="font-size:15px;color:#111">${escapeHtml(n.title)}</strong>
    ${blockBadge}
    <span style="margin-left:auto;font-size:11px;color:#aaa;font-family:monospace">${escapeHtml(n.id)}</span>
  </div>
  ${summary}
  ${handoff}
</div>`
    }).join('\n')

    sections.push(`<section style="margin-bottom:32px">
  <h2 style="font-size:18px;color:#333;border-bottom:2px solid #e0d0ff;padding-bottom:6px;margin-bottom:14px">${dayLabel}</h2>
  ${cards}
</section>`)
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Grok Export — ${escapeHtml(project.name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9f7ff; margin: 0; padding: 32px; color: #222; }
    h1 { font-size: 24px; color: #4a3080; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 32px; }
    @media print { body { padding: 16px; background: white; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(project.name)} — Grok Scenes</h1>
  <div class="subtitle">${grokNodes.length} grok scene${grokNodes.length !== 1 ? 's' : ''} · exported ${new Date().toLocaleString()}</div>
  ${sections.join('\n')}
</body>
</html>`
}
