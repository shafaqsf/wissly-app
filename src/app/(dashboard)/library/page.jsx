import Artefact from '@/components/artefact/artefact';
import AddMaterialForm from '@/components/material/add-material-form';
import { addMaterialAction } from '@/lib/actions/material';
import { listArtefacts } from '@/lib/data/artefacts';
import { listSources } from '@/lib/data/sources';
import { listSubjects } from '@/lib/data/subjects';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Library — wissly',
};

/* Everything the learner has handed over, and everything read rather than
   answered that came out of it. The recall formats are not here; they are in
   the queue, where answering them is the point. */
export default async function LibraryPage() {
  const supabase = await createClient();

  const [subjects, sources, artefacts] = await Promise.all([
    listSubjects(supabase),
    listSources(supabase),
    listArtefacts(supabase),
  ]);

  return (
    <div className="flex flex-col gap-16">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">
          Your material
        </p>
        <h1 className="font-display text-display-l font-bold">Library</h1>
      </header>

      <section aria-label="Add material" className="flex flex-col gap-6">
        <h2 className="font-display text-heading font-semibold">Add material</h2>
        <AddMaterialForm action={addMaterialAction} subjects={subjects} />
      </section>

      <section aria-label="Sources" className="flex flex-col gap-4">
        <h2 className="font-display text-heading font-semibold">Sources</h2>

        {sources.length === 0 ? (
          <p className="max-w-measure text-body">
            Nothing here yet. Paste a page of your notes above and wissly will
            read it and write you something to answer.
          </p>
        ) : (
          <ul className="flex flex-col border-t border-rule">
            {sources.map((source) => (
              <li
                key={source.id}
                className="flex items-baseline justify-between gap-4 border-b border-rule py-3"
              >
                <span className="text-body">{source.title}</span>
                <span className="font-mono text-caption uppercase text-ink-muted">
                  {source.kind}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {artefacts.length > 0 ? (
        <section aria-label="Reading" className="flex flex-col gap-16">
          <h2 className="font-display text-heading font-semibold">Reading</h2>
          {artefacts.map((artefact) => (
            <Artefact key={artefact.id} artefact={artefact} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
