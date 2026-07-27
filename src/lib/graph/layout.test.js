// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { layoutConceptGraph } from './layout.js'

const WIDTH = 800
const HEIGHT = 600

describe('layoutConceptGraph', () => {
  it('positions nothing for an empty graph', () => {
    expect(layoutConceptGraph({ nodes: [], edges: [] })).toEqual([])
  })

  it('gives every node a finite position inside the canvas', () => {
    const nodes = [
      { id: 'c1', name: 'Refraction' },
      { id: 'c2', name: "Snell's law" },
      { id: 'c3', name: 'Dispersion' },
    ]
    const edges = [{ source: 'c1', target: 'c2' }]

    const positioned = layoutConceptGraph({ nodes, edges, width: WIDTH, height: HEIGHT })

    expect(positioned).toHaveLength(3)
    for (const node of positioned) {
      expect(Number.isFinite(node.x)).toBe(true)
      expect(Number.isFinite(node.y)).toBe(true)
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.x).toBeLessThanOrEqual(WIDTH)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeLessThanOrEqual(HEIGHT)
    }
  })

  it('keeps every field the node came in with', () => {
    const nodes = [{ id: 'c1', name: 'Refraction', mastery: 0.5, subjectId: 'sub-1' }]

    const [node] = layoutConceptGraph({ nodes, edges: [] })

    expect(node.name).toBe('Refraction')
    expect(node.mastery).toBe(0.5)
    expect(node.subjectId).toBe('sub-1')
  })

  it('positions a single node, with no edges, without crashing', () => {
    const positioned = layoutConceptGraph({
      nodes: [{ id: 'lonely' }],
      edges: [],
      width: WIDTH,
      height: HEIGHT,
    })

    expect(positioned).toHaveLength(1)
    expect(Number.isFinite(positioned[0].x)).toBe(true)
  })

  it('ignores an edge naming a node that is not in the graph', () => {
    const nodes = [{ id: 'c1' }, { id: 'c2' }]
    const edges = [{ source: 'c1', target: 'ghost' }]

    expect(() => layoutConceptGraph({ nodes, edges, width: WIDTH, height: HEIGHT })).not.toThrow()
  })
})
