import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'

/* The concept map's layout. A course's concepts and the edges between them,
 * turned into an (x, y) per node inside a fixed canvas.
 *
 * `d3-force` was already the smallest well-maintained option available —
 * `package.json` carried no graph-drawing dependency before this, so this is
 * a small addition rather than a swap. It is a pure layout library with no
 * DOM dependency of its own; the drawing happens in
 * `src/components/course/concept-map.jsx`, which reuses the product's own
 * `.grain-mark` styling for nodes rather than inventing a second visual
 * language for state.
 */

/** Space reserved per node so two labels never sit on top of each other. */
const NODE_RADIUS = 28

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return (min + max) / 2
  return Math.min(Math.max(value, min), max)
}

/**
 * Lay out a concept graph. The simulation is stepped a fixed number of times
 * and then stopped rather than left to animate on its own — docs/DESIGN.md
 * forbids a page that plays without being asked, and a map still visibly
 * settling every time the page opens would be exactly that. `iterations` is
 * generous enough to have converged well
 * before it runs out, for the sizes a course's concept list realistically
 * reaches.
 *
 * @param {object} params
 * @param {Array<{id: string}>} [params.nodes]
 * @param {Array<{source: string, target: string}>} [params.edges]
 * @param {number} [params.width]
 * @param {number} [params.height]
 * @param {number} [params.iterations]
 * @returns {Array<object>} each input node plus `x` and `y`
 */
export function layoutConceptGraph({
  nodes = [],
  edges = [],
  width = 800,
  height = 600,
  iterations = 300,
} = {}) {
  if (nodes.length === 0) return []

  const simNodes = nodes.map((node) => ({ ...node }))
  const ids = new Set(simNodes.map((node) => node.id))
  const simLinks = edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => ({ ...edge }))

  const simulation = forceSimulation(simNodes)
    .force('charge', forceManyBody().strength(-180))
    .force(
      'link',
      forceLink(simLinks)
        .id((node) => node.id)
        .distance(110)
        .strength(0.5),
    )
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(NODE_RADIUS))
    .stop()

  for (let i = 0; i < iterations; i += 1) simulation.tick()

  const margin = NODE_RADIUS
  return simNodes.map((node) => ({
    ...node,
    x: clamp(node.x, margin, width - margin),
    y: clamp(node.y, margin, height - margin),
  }))
}
