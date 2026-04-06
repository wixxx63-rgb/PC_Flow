import type { Variable, VariableEffect, VariableState } from '../types'

export function buildDefaultState(variables: Variable[]): VariableState {
  const state: VariableState = {}
  variables.forEach(v => { state[v.id] = v.defaultValue })
  return state
}

export function applyEffects(state: VariableState, effects: VariableEffect[]): VariableState {
  const next = { ...state }
  effects.forEach(e => {
    switch (e.operation) {
      case 'set':
        next[e.variableId] = e.value
        break
      case 'add':
        next[e.variableId] = (Number(next[e.variableId]) || 0) + Number(e.value)
        break
      case 'subtract':
        next[e.variableId] = (Number(next[e.variableId]) || 0) - Number(e.value)
        break
      case 'toggle':
        next[e.variableId] = !next[e.variableId]
        break
    }
  })
  return next
}

export function applyBranchEffects(state: VariableState, effects: string[], variables: Variable[]): VariableState {
  const next = { ...state }
  effects.forEach(effect => {
    // Parse patterns: "loyalty+1", "loyalty=high", "PATH_C:open", "knows_secret=true"
    const addMatch = effect.match(/^(\w+)\+(\d+)$/)
    const subMatch = effect.match(/^(\w+)-(\d+)$/)
    const eqMatch = effect.match(/^(\w+)[=:](.+)$/)
    if (addMatch) {
      const [, name, val] = addMatch
      const varId = findVarId(name, variables)
      if (varId) next[varId] = (Number(next[varId]) || 0) + Number(val)
    } else if (subMatch) {
      const [, name, val] = subMatch
      const varId = findVarId(name, variables)
      if (varId) next[varId] = (Number(next[varId]) || 0) - Number(val)
    } else if (eqMatch) {
      const [, name, val] = eqMatch
      const varId = findVarId(name, variables)
      if (varId) {
        if (val === 'true') next[varId] = true
        else if (val === 'false') next[varId] = false
        else if (!isNaN(Number(val))) next[varId] = Number(val)
        else next[varId] = val
      }
    }
  })
  return next
}

function findVarId(name: string, variables: Variable[]): string | null {
  // Match by variable name (for branch effect strings like "loyalty+1")
  const v = variables.find(v => v.name === name)
  return v ? v.id : null
}

export function evaluateCondition(condition: string | null, state: VariableState, variables: Variable[]): boolean {
  if (!condition) return true
  // Build name→value map
  const byName: Record<string, string | boolean | number> = {}
  variables.forEach(v => { byName[v.name] = state[v.id] ?? v.defaultValue })

  // Simple conditions: "loyalty=high", "day>3", "knows_secret=true"
  const eqMatch = condition.match(/^(\w+)\s*=\s*(.+)$/)
  const gtMatch = condition.match(/^(\w+)\s*>\s*(.+)$/)
  const ltMatch = condition.match(/^(\w+)\s*<\s*(.+)$/)
  const neMatch = condition.match(/^(\w+)\s*!=\s*(.+)$/)

  const parseVal = (s: string): string | boolean | number => {
    if (s === 'true') return true
    if (s === 'false') return false
    if (!isNaN(Number(s))) return Number(s)
    return s.trim()
  }

  if (eqMatch) {
    const val = byName[eqMatch[1]]
    return val == parseVal(eqMatch[2])
  }
  if (gtMatch) {
    return Number(byName[gtMatch[1]]) > Number(gtMatch[2])
  }
  if (ltMatch) {
    return Number(byName[ltMatch[1]]) < Number(ltMatch[2])
  }
  if (neMatch) {
    const val = byName[neMatch[1]]
    return val != parseVal(neMatch[2])
  }
  // Treat as truthy variable name
  return !!byName[condition.trim()]
}
