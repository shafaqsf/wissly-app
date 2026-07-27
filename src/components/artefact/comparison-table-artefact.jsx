import CitationAnchor, { sectionHref } from './citation-anchor';
import { renderInline } from './prose';

/* Two to four things, compared across a shared set of dimensions. Read, not
   answered — see the note on READING_FORMATS in src/lib/agent/formats.js. A
   table is one of the two things the design allows to break the 66-character
   measure ("Tables and graphs may break out of it; running text never
   does"); a grid this shape cannot be read at
   one column wide.

   `cells` arrives flat, one entry per (item, dimension) pair rather than
   nested by row — see the payload's own note in formats.js — so the lookup
   happens once here rather than being repeated by every caller. */
export default function ComparisonTableArtefact({ artefact }) {
  const { items, dimensions, cells } = artefact.payload;

  function cellAt(itemIndex, dimensionIndex) {
    return cells.find(
      (cell) => cell.item_index === itemIndex && cell.dimension_index === dimensionIndex,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" className="border-b border-rule px-3 py-2">
                <span className="sr-only">Dimension</span>
              </th>
              {items.map((item) => (
                <th
                  key={item}
                  scope="col"
                  className="border-b border-rule px-3 py-2 font-display text-title font-semibold"
                >
                  {item}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dimension, dimensionIndex) => (
              <tr key={dimension}>
                <th
                  scope="row"
                  className="border-b border-rule px-3 py-2 align-top font-mono text-label uppercase text-ink-muted"
                >
                  {dimension}
                </th>
                {items.map((item, itemIndex) => {
                  const cell = cellAt(itemIndex, dimensionIndex);

                  return (
                    <td key={item} className="max-w-72 border-b border-rule px-3 py-2 align-top">
                      {cell ? (
                        <>
                          <p className="text-body-s text-ink">{renderInline(cell.value)}</p>
                          <p className="mt-1 text-caption text-ink-muted">
                            {renderInline(cell.rationale)}
                          </p>
                        </>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="max-w-measure text-body-s text-ink-muted">
        Compared from
        <CitationAnchor
          ordinal={artefact.section_ordinal}
          anchor={artefact.anchor}
          passage={artefact.passage}
          href={sectionHref(artefact)}
        />
      </p>
    </div>
  );
}
