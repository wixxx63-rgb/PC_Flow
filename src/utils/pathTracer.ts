import type { StoryNode, Edge } from '../types'

/** All node IDs reachable forward from startId (BFS through edges + branch.leads) */
export function traceForward(startId: string, nodes: StoryNode[], edges: Edge[]): Set<string> {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const visited = new Set<string>()
  const queue = [startId]
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    // Forward through edges
    edges.forEach(e => {
      if (e.from === id && !visited.has(e.to)) queue.push(e.to)
    })
    // Forward through branch.leads
    const node = nodeMap.get(id)
    node?.branches.forEach(b => {
      b.leads.forEach(lid => { if (!visited.has(lid)) queue.push(lid) })
    })
  }
  return visited
}

/** All node IDs that can reach targetId (BFS backward through edges) */
export function traceBackward(targetId: string, _nodes: StoryNode[], edges: Edge[]): Set<string> {
  const visited = new Set<string>()
  const queue = [targetId]
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    edges.forEach(e => {
      if (e.to === id && !visited.has(e.from)) queue.push(e.from)
    })
  }
  return visited
}

/** All edge IDs where both endpoints are in the given node set */
export function traceEdges(nodeIds: Set<string>, edges: Edge[]): Set<string> {
  const result = new Set<string>()
  edges.forEach(e => {
    if (nodeIds.has(e.from) && nodeIds.has(e.to)) result.add(e.id)
  })
  return result
}
