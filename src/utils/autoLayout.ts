import type { StoryNode, Edge } from '../types'

interface LayoutResult {
  id: string
  x: number
  y: number
}

export function computeAutoLayout(nodes: StoryNode[], edges: Edge[]): LayoutResult[] {
  if (!nodes.length) return []

  // Build adjacency
  const outEdges = new Map<string, string[]>()
  const inEdges = new Map<string, string[]>()
  nodes.forEach(n => { outEdges.set(n.id, []); inEdges.set(n.id, []) })
  edges.forEach(e => {
    if (outEdges.has(e.from) && inEdges.has(e.to)) {
      outEdges.get(e.from)!.push(e.to)
      inEdges.get(e.to)!.push(e.from)
    }
  })

  // Find roots: nodes with no incoming edges
  let roots = nodes.filter(n => (inEdges.get(n.id) ?? []).length === 0).map(n => n.id)
  if (!roots.length) {
    // Pick node with most outgoing edges
    let maxOut = -1, bestId = nodes[0].id
    nodes.forEach(n => {
      const cnt = (outEdges.get(n.id) ?? []).length
      if (cnt > maxOut) { maxOut = cnt; bestId = n.id }
    })
    roots = [bestId]
  }

  // BFS to assign depth levels
  const depth = new Map<string, number>()
  const queue: [string, number][] = roots.map(id => [id, 0])
  const visited = new Set<string>()

  while (queue.length) {
    const [id, d] = queue.shift()!
    if (!nodes.find(n => n.id === id)) continue
    // Use maximum depth assignment
    const existing = depth.get(id) ?? -1
    if (d > existing) depth.set(id, d)
    if (!visited.has(id)) {
      visited.add(id)
      ;(outEdges.get(id) ?? []).forEach(childId => {
        queue.push([childId, d + 1])
      })
    }
  }

  // Isolated nodes (never visited)
  const isolated = nodes.filter(n => !depth.has(n.id))
  isolated.forEach(n => depth.set(n.id, -1))

  // Group by depth
  const levels = new Map<number, string[]>()
  depth.forEach((d, id) => {
    if (!levels.has(d)) levels.set(d, [])
    levels.get(d)!.push(id)
  })

  // Sort each level by ID for consistency
  levels.forEach(ids => ids.sort())

  const V_SPACING = 240
  const H_SPACING = 280

  const results: LayoutResult[] = []

  // Layout connected nodes
  const sortedDepths = [...levels.keys()].filter(d => d >= 0).sort((a, b) => a - b)
  sortedDepths.forEach(d => {
    const ids = levels.get(d)!
    const totalWidth = (ids.length - 1) * H_SPACING
    ids.forEach((id, i) => {
      results.push({
        id,
        x: i * H_SPACING - totalWidth / 2,
        y: d * V_SPACING
      })
    })
  })

  // Isolated nodes below
  const maxDepth = sortedDepths.length ? Math.max(...sortedDepths) : 0
  const isolatedY = (maxDepth + 2) * V_SPACING
  const isolatedIds = levels.get(-1) ?? []
  const totalIsoWidth = (isolatedIds.length - 1) * H_SPACING
  isolatedIds.forEach((id, i) => {
    results.push({
      id,
      x: i * H_SPACING - totalIsoWidth / 2,
      y: isolatedY
    })
  })

  return results
}
