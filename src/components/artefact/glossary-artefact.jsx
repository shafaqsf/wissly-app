import CitationAnchor from './citation-anchor';
import { renderInline } from './prose';

/* One term, one definition, one anchor. A description list says that
   relationship in markup, so a screen reader announces the pair rather than
   two paragraphs that happen to sit next to each other. */
export default function GlossaryArtefact({ artefact }) {
  const { term, definition } = artefact.payload;

  return (
    <dl className="flex max-w-measure flex-col gap-1">
      <dt className="font-display text-title font-semibold">{term}</dt>
      <dd className="text-body">
        {renderInline(definition)}
        <CitationAnchor
          ordinal={artefact.section_ordinal}
          anchor={artefact.anchor}
          passage={artefact.passage}
        />
      </dd>
    </dl>
  );
}
