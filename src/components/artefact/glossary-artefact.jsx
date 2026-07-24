import CitationAnchor from './citation-anchor';
import { renderInline } from './prose';

/* Term, definition, source. A description list says that relationship in
   markup, so a screen reader announces the pair rather than two paragraphs
   that happen to sit next to each other. */
export default function GlossaryArtefact({ artefact }) {
  const { entries } = artefact.payload;
  const sources = artefact.sources ?? [];

  return (
    <dl className="flex flex-col gap-6">
      {entries.map((entry) => (
        <div key={entry.term} className="flex max-w-measure flex-col gap-1">
          <dt className="font-display text-title font-semibold">{entry.term}</dt>
          <dd className="text-body">
            {renderInline(entry.definition, sources)}
            <CitationAnchor
              source={sources.find((item) => item.number === entry.source)}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
