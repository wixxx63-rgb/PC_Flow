import { v4 as uuidv4 } from 'uuid'
import type { Project, ConflictIssue } from '../types'

export function detectConflicts(project: Project): ConflictIssue[] {
  const { nodes, edges, variables } = project
  const issues: ConflictIssue[] = []
  const nodeIds = new Set(nodes.map(n => n.id))

  // ── Heuristic start node: highest out-degree among nodes with no incoming ──
  const hasIncoming = new Set(edges.map(e => e.to))
  const rootCandidates = nodes.filter(n => !hasIncoming.has(n.id))
  const startNode = rootCandidates.reduce(
    (best, n) => {
      const outDeg = edges.filter(e => e.from === n.id).length
      return outDeg > (best ? edges.filter(e => e.from === best.id).length : -1) ? n : best
    },
    null as (typeof nodes[0]) | null
  )

  // ── 1. Orphaned nodes ──────────────────────────────────────────────────
  nodes.forEach(n => {
    if (hasIncoming.has(n.id)) return
    if (n.type === 'ending' || n.type === 'death') return
    if (startNode && n.id === startNode.id) return
    // POV nodes inserted correctly always have an incoming edge — if one doesn't
    // it's genuinely disconnected and should be flagged just like any other node.
    issues.push({
      id: uuidv4(),
      type: 'orphan',
      severity: 'warning',
      nodeId: n.id,
      description: `"${n.title}" (${n.id}) has no incoming edges — the player can never reach it.`,
      suggestion: 'Connect this node from another scene or mark it as an entry point.'
    })
  })

  // ── 2. Dead ends ───────────────────────────────────────────────────────
  nodes.forEach(n => {
    if (n.type === 'ending' || n.type === 'death') return
    const outgoing = edges.filter(e => e.from === n.id)
    const hasBranchLeads = n.branches.some(b => b.leads.length > 0)
    // A POV node is correctly structured as long as it has one outgoing sequential edge
    // (leading to the next node in the story). Only flag if completely disconnected.
    if (outgoing.length === 0 && !hasBranchLeads) {
      if (n.isPov) {
        // POV node with no outgoing edge: flag as informational, not error
        issues.push({
          id: uuidv4(),
          type: 'dead-end',
          severity: 'info',
          nodeId: n.id,
          description: `POV scene "${n.title}" (${n.id}) has no outgoing connection.`,
          suggestion: 'Connect this POV scene to the next scene in the story.'
        })
      } else {
        issues.push({
          id: uuidv4(),
          type: 'dead-end',
          severity: 'error',
          nodeId: n.id,
          description: `"${n.title}" (${n.id}) has no outgoing edges — the story stops unexpectedly here.`,
          suggestion: 'Add a connection to the next scene, or change the node type to "ending" or "death".'
        })
      }
    }
  })

  // ── 3. Broken connections ──────────────────────────────────────────────
  edges.forEach(e => {
    if (!nodeIds.has(e.from)) {
      issues.push({
        id: uuidv4(),
        type: 'broken-connection',
        severity: 'error',
        nodeId: null,
        description: `Edge references missing source node "${e.from}".`,
        suggestion: `Delete this orphaned edge or recreate node "${e.from}".`
      })
    }
    if (!nodeIds.has(e.to)) {
      issues.push({
        id: uuidv4(),
        type: 'broken-connection',
        severity: 'error',
        nodeId: e.from,
        description: `Edge from "${e.from}" points to missing node "${e.to}".`,
        suggestion: `Remove this edge or create node "${e.to}".`
      })
    }
  })
  nodes.forEach(n => {
    n.branches.forEach(b => {
      b.leads.forEach(lid => {
        if (!nodeIds.has(lid)) {
          issues.push({
            id: uuidv4(),
            type: 'broken-connection',
            severity: 'error',
            nodeId: n.id,
            description: `Branch "${b.option}" in "${n.title}" (${n.id}) leads to missing node "${lid}".`,
            suggestion: `Create node "${lid}" or remove it from the branch leads.`
          })
        }
      })
    })
  })

  // ── 4. Empty decisions ─────────────────────────────────────────────────
  nodes.forEach(n => {
    if (n.type !== 'decision') return
    if (n.branches.length < 2) {
      issues.push({
        id: uuidv4(),
        type: 'empty-decision',
        severity: 'warning',
        nodeId: n.id,
        description: `Decision node "${n.title}" (${n.id}) has only ${n.branches.length} branch(es) — not a real choice.`,
        suggestion: 'Add at least 2 branches, or change the node type to "scene".'
      })
    }
  })

  // ── 5. Undefined variables ─────────────────────────────────────────────
  const varNames = new Set(variables.map(v => v.name))

  function extractVarNames(str: string): string[] {
    const names: string[] = []
    // condition: "name=value", "name>value", etc.
    const condMatch = str.match(/^(\w+)\s*[=><!/]+/)
    if (condMatch) names.push(condMatch[1])
    // effect: "name+1", "name-1", "name=val", "name:val"
    const effMatch = str.match(/^(\w+)[+\-=:]/)
    if (effMatch && !names.includes(effMatch[1])) names.push(effMatch[1])
    // bare name
    if (!condMatch && !effMatch && /^\w+$/.test(str.trim())) names.push(str.trim())
    return names
  }

  nodes.forEach(n => {
    const check = (str: string, context: string) => {
      if (!str) return
      extractVarNames(str).forEach(name => {
        if (!varNames.has(name)) {
          issues.push({
            id: uuidv4(),
            type: 'undefined-variable',
            severity: 'warning',
            nodeId: n.id,
            description: `"${n.title}" (${n.id}) ${context} references undefined variable "${name}".`,
            suggestion: `Define variable "${name}" in the Variable Manager.`
          })
        }
      })
    }
    n.branches.forEach(b => {
      if (b.condition) check(b.condition, 'branch condition')
      b.effects.forEach(e => check(e, 'branch effect'))
    })
  })

  // ── 6. Unwritten scenes ────────────────────────────────────────────────
  nodes.forEach(n => {
    if (n.status !== 'todo') return
    const empty = !n.summary.trim() && n.dialogueLines.length === 0 && !n.grokHandoff.trim()
    if (empty) {
      issues.push({
        id: uuidv4(),
        type: 'unwritten',
        severity: 'info',
        nodeId: n.id,
        description: `"${n.title}" (${n.id}) is marked Todo with no content written.`,
        suggestion: 'Add a summary, dialogue lines, or grok handoff to this scene.'
      })
    }
  })

  // ── 7. Circular traps (SCCs with no exit) ─────────────────────────────
  // Kosaraju's algorithm
  const adjForward = new Map<string, string[]>()
  const adjBackward = new Map<string, string[]>()
  nodes.forEach(n => { adjForward.set(n.id, []); adjBackward.set(n.id, []) })
  edges.forEach(e => {
    if (nodeIds.has(e.from) && nodeIds.has(e.to)) {
      adjForward.get(e.from)!.push(e.to)
      adjBackward.get(e.to)!.push(e.from)
    }
  })

  const visited1 = new Set<string>()
  const finishOrder: string[] = []

  function dfs1(id: string) {
    if (visited1.has(id)) return
    visited1.add(id)
    adjForward.get(id)?.forEach(dfs1)
    finishOrder.push(id)
  }
  nodes.forEach(n => dfs1(n.id))

  const visited2 = new Set<string>()
  const sccs: string[][] = []

  function dfs2(id: string, component: string[]) {
    if (visited2.has(id)) return
    visited2.add(id)
    component.push(id)
    adjBackward.get(id)?.forEach(nid => dfs2(nid, component))
  }

  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const id = finishOrder[i]
    if (!visited2.has(id)) {
      const comp: string[] = []
      dfs2(id, comp)
      sccs.push(comp)
    }
  }

  sccs.forEach(comp => {
    if (comp.length < 2) return
    // Check if any edge leaves the SCC
    const compSet = new Set(comp)
    const hasExit = comp.some(id =>
      adjForward.get(id)?.some(nid => !compSet.has(nid))
    )
    if (!hasExit) {
      comp.forEach(id => {
        const n = nodes.find(nd => nd.id === id)
        issues.push({
          id: uuidv4(),
          type: 'circular-trap',
          severity: 'error',
          nodeId: id,
          description: `"${n?.title ?? id}" (${id}) is part of a closed loop with no exit — the player would be trapped.`,
          suggestion: 'Add an edge leading out of this loop to an ending or another scene.'
        })
      })
    }
  })

  return issues
}
