import ConceptMastery from '@/components/progress/concept-mastery';
import { listConceptMastery } from '@/lib/data/concepts';
import { listSubjects } from '@/lib/data/subjects';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Progress — wissly',
};

/* Progress is grain and nothing else. The field on this page is the only one
   the viewport gets, so the subject picker is words rather than a second
   field per subject. */
export default async function ProgressPage({ searchParams }) {
  const supabase = await createClient();
  const params = await searchParams;

  const subjects = await listSubjects(supabase);
  const selected =
    subjects.find((subject) => subject.id === params?.subject) ?? subjects[0] ?? null;

  const concepts = selected
    ? await listConceptMastery(supabase, { subjectId: selected.id })
    : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label uppercase text-ink-muted">
          What you know
        </p>
        <h1 className="font-display text-display-l font-bold">Progress</h1>
      </header>

      {subjects.length > 1 ? (
        <nav aria-label="Subjects" className="flex flex-wrap gap-x-6 gap-y-2">
          {subjects.map((subject) => (
            <a
              key={subject.id}
              href={`/progress?subject=${subject.id}`}
              aria-current={subject.id === selected?.id ? 'page' : undefined}
              className="inline-flex min-h-11 items-center font-mono text-label uppercase text-ink-muted aria-[current=page]:text-ink"
            >
              {subject.title}
            </a>
          ))}
        </nav>
      ) : null}

      <ConceptMastery
        subject={selected?.title ?? 'Nothing yet'}
        concepts={concepts}
      />
    </div>
  );
}
