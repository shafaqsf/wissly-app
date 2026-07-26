'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { masteryState } from '@/lib/mastery';
import { layoutConceptGraph } from '@/lib/graph/layout';

/* The mindmap. Nodes are this course's concepts, drawn exactly as
   `ConceptShelf` draws them — the same mastery mark, in the state
   `masteryState` names, with the term beside it — so a learner reads the
   same legend on both screens rather than a second one invented for this
   page. Edges are a
   plain hairline, `--rule`, the same colour every border in the product
   already uses: nothing here reaches for a hue docs/DESIGN.md has not
   already named.

   The layout is computed once per render from `layoutConceptGraph`, a pure
   function — there is no animation loop, so the page never plays on its own:
   the graph is laid out, not watched settling. */

const WIDTH = 900;
const HEIGHT = 560;

export default function ConceptMap({ courseId, nodes = [], edges = [] }) {
  const positioned = useMemo(
    () => layoutConceptGraph({ nodes, edges, width: WIDTH, height: HEIGHT }),
    [nodes, edges],
  );

  const byId = useMemo(() => new Map(positioned.map((node) => [node.id, node])), [positioned]);

  return (
    <div
      className="relative w-full overflow-auto"
      style={{ minHeight: HEIGHT, width: WIDTH, maxWidth: '100%' }}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        className="absolute inset-0"
        aria-hidden="true"
      >
        {edges.map((edge) => {
          const source = byId.get(edge.source);
          const target = byId.get(edge.target);
          if (!source || !target) return null;

          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="var(--rule)"
              strokeWidth="1"
            >
              {edge.reason ? <title>{edge.reason}</title> : null}
            </line>
          );
        })}
      </svg>

      <ul className="relative" style={{ width: WIDTH, height: HEIGHT }}>
        {positioned.map((node) => {
          const state = masteryState(node.mastery);

          return (
            <li
              key={node.id}
              id={`concept-${node.id}`}
              className="absolute flex w-[140px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center"
              style={{ left: node.x, top: node.y }}
            >
              <span
                aria-hidden="true"
                className={`grain grain-mark ${state.field}`}
                style={{ '--grain': state.grain }}
              />
              <Link
                href={`/courses/${node.subjectId ?? courseId}#concept-${node.id}`}
                className="text-body-s text-ink underline-offset-2 hover:underline"
              >
                {node.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
