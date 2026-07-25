'use client';

import { useId, useState } from 'react';

import { CLOZE_BLANK } from '@/lib/agent/formats';

/* The cloze editor: the sentence, and the word taken out of it marked **in
   place**.

   A cloze written as two fields — "sentence" and "answer" — is two things the
   learner has to keep in agreement by hand, and the one rule the format has
   (the answer is a word that was in the sentence) is exactly the one nobody
   checks. So the sentence is written once and the word is chosen out of it:
   click a word and it becomes the blank, click the blank and it comes back.

   `text` and `answer` leave as hidden fields, because the payload the database
   stores is still the two of them. */
export default function ClozeEditor({ text = '', answer = '', onChange }) {
  const id = useId();
  // The sentence as written, with the blank filled back in — a learner edits
  // the sentence they wrote, never one with a gap in the middle of it.
  const [sentence, setSentence] = useState(
    text ? text.replace(CLOZE_BLANK, answer) : '',
  );
  const [chosen, setChosen] = useState(answer);

  const words = sentence.split(/(\s+)/);

  function choose(word) {
    const bare = strip(word);
    const next = bare === chosen ? '' : bare;
    setChosen(next);
    onChange?.({ text: blanked(sentence, next), answer: next });
  }

  function rewrite(value) {
    setSentence(value);
    // A word that is no longer in the sentence cannot be the blank in it.
    const next = value.includes(chosen) ? chosen : '';
    setChosen(next);
    onChange?.({ text: blanked(value, next), answer: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-sentence`} className="font-mono text-label uppercase text-ink-muted">
          The sentence
        </label>
        <textarea
          id={`${id}-sentence`}
          name="sentence"
          rows={3}
          value={sentence}
          onChange={(event) => rewrite(event.target.value)}
          className="max-w-measure rounded-control border border-rule bg-paper p-3 text-body text-ink"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-mono text-label uppercase text-ink-muted">
          The word to take out
        </legend>
        <p className="max-w-measure text-body leading-loose">
          {words.map((word, index) =>
            word.trim() === '' ? (
              <span key={`gap-${index}`}>{word}</span>
            ) : (
              <button
                key={`word-${index}`}
                type="button"
                onClick={() => choose(word)}
                aria-pressed={strip(word) === chosen && chosen !== ''}
                className="rounded-control px-1 underline-offset-4 hover:underline aria-pressed:border-b-2 aria-pressed:border-b-ink aria-pressed:font-semibold"
              >
                {word}
              </button>
            ),
          )}
        </p>
        {chosen ? (
          <p className="font-mono text-caption text-ink-muted">
            “{chosen}” is taken out. The learner sees {CLOZE_BLANK} in its place.
          </p>
        ) : (
          <p className="font-mono text-caption text-ink-muted">
            Click the word the learner should have to remember.
          </p>
        )}
      </fieldset>

      <input type="hidden" name="text" value={blanked(sentence, chosen)} />
      <input type="hidden" name="answer" value={chosen} />
    </div>
  );
}

/** Punctuation is not part of the word anybody is being asked to recall. */
function strip(word) {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function blanked(sentence, word) {
  if (!word) return sentence;
  return sentence.replace(word, CLOZE_BLANK);
}
