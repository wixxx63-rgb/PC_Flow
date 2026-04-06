import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import type { Project, ExportData } from '../types'

export function buildExportData(project: Project): ExportData {
  return {
    meta: {
      app: 'Narrative Flow',
      version: '2.0',
      exported: new Date().toISOString(),
      projectName: project.name
    },
    nodes: project.nodes,
    edges: project.edges,
    characters: project.characters,
    variables: project.variables,
    assets: project.assets,
    playthroughs: project.playthroughs,
    writerRoom: project.writerRoom
  }
}

export function exportJSON(project: Project): string {
  return JSON.stringify(buildExportData(project), null, 2)
}

export function exportXML(project: Project): string {
  const data = buildExportData(project)
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    arrayNodeName: 'item',
    suppressBooleanAttributes: false
  })
  return builder.build({ narrativeFlow: data })
}

export function importJSON(json: string): Partial<Project> | null {
  try {
    const data: ExportData = JSON.parse(json)
    if (!data.meta || data.meta.app !== 'Narrative Flow') return null
    return {
      name: data.meta.projectName,
      nodes: (data.nodes ?? []).map(n => ({ isPov: false, povCharacter: null, ...n })),
      edges: data.edges ?? [],
      characters: (data.characters ?? []).map(c => ({ color: '#888888', sprites: [], ...c })),
      variables: data.variables ?? [],
      assets: data.assets ?? [],
      playthroughs: data.playthroughs ?? [],
      writerRoom: data.writerRoom ?? []
    }
  } catch {
    return null
  }
}

export function importXML(xml: string): Partial<Project> | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      parseAttributeValue: true,
      isArray: (name) => {
        const arrays = [
          'nodes', 'edges', 'characters', 'variables', 'assets',
          'branches', 'dialogueLines', 'chars', 'effects', 'leads',
          'sprites', 'variables', 'item'
        ]
        return arrays.includes(name)
      }
    })
    const parsed = parser.parse(xml)
    const data = parsed.narrativeFlow as ExportData
    if (!data?.meta || data.meta.app !== 'Narrative Flow') return null
    return {
      name: data.meta.projectName,
      nodes: (data.nodes ?? []).map((n: any) => ({ isPov: false, povCharacter: null, ...n })),
      edges: data.edges ?? [],
      characters: (data.characters ?? []).map((c: any) => ({ color: '#888888', sprites: [], ...c })),
      variables: data.variables ?? [],
      assets: data.assets ?? [],
      playthroughs: data.playthroughs ?? [],
      writerRoom: data.writerRoom ?? []
    }
  } catch {
    return null
  }
}
