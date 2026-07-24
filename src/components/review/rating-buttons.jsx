'use client';

import { buttonClass } from '@/components/artefact/control';

/* FSRS wants a grade from 1 to 4. A learner does not think in grades, so the
   buttons say what happened — "Not at all", "Instantly" — and the number stays
   inside the scheduler where it belongs. */
export const RATINGS = [
  { grade: 1, label: 'Not at all' },
  { grade: 2, label: 'With effort' },
  { grade: 3, label: 'Comfortably' },
  { grade: 4, label: 'Instantly' },
];

export default function RatingButtons({ onRate }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-rule pt-6">
      <legend className="mb-3 font-mono text-label uppercase text-ink-muted">
        How well did you recall that?
      </legend>
      <div className="flex flex-wrap gap-2">
        {RATINGS.map((rating) => (
          <button
            key={rating.grade}
            type="button"
            onClick={() => onRate(rating.grade)}
            className={buttonClass}
          >
            {rating.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
