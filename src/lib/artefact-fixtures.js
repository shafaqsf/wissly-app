/* One example payload per Stage 1 artefact format.

   The generation layer is being built in parallel and these shapes are not
   yet agreed. Everything in `src/components/artefact/` reads from here and
   from nowhere else, so reconciling with the real schema is one file plus
   whatever the renderers destructure.

   The envelope is the same for every format:

     id        stable identifier
     format    one of the six Stage 1 formats
     conceptId the concept whose mastery this artefact moves
     sources   the passages the claims came from; `number` is what the
               superscript anchor prints, and it is scoped to the artefact
     payload   format-specific, documented beside each fixture below

   Prose is an array of blocks — see `src/components/artefact/prose.jsx` for
   the block kinds and for the `$tex$` and `[[n]]` inline markers.
   Delete this file when the generation layer feeds these components. */

const sources = [
  {
    number: 1,
    id: 'section-12',
    anchor: 'page 12',
    label: 'Lecture notes, Linear maps',
    passage:
      'A non-zero vector v is an eigenvector of a square matrix A when Av is a scalar multiple of v. That scalar is the eigenvalue belonging to v.',
  },
  {
    number: 2,
    id: 'section-13',
    anchor: 'page 13',
    label: 'Lecture notes, The characteristic polynomial',
    passage:
      'The eigenvalues of A are exactly the roots of det(A - λI) = 0, the characteristic polynomial of A.',
  },
];

/* summary — `payload.layers` is ordered shallowest first. Each layer has an
   `id`, a `label` the learner reads on the control, and `blocks`. */
export const summaryFixture = {
  id: 'artefact-summary-eigenvectors',
  format: 'summary',
  conceptId: 'concept-eigenvectors',
  title: 'Eigenvectors and eigenvalues',
  sources,
  payload: {
    layers: [
      {
        id: 'brief',
        label: 'Three sentences',
        blocks: [
          {
            type: 'paragraph',
            text: 'An eigenvector of a matrix keeps its direction when the matrix acts on it. [[1]] Only its length changes, and the factor it changes by is the eigenvalue. Finding them means solving $\\det(A - \\lambda I) = 0$. [[2]]',
          },
        ],
      },
      {
        id: 'paragraph',
        label: 'A paragraph',
        blocks: [
          {
            type: 'paragraph',
            text: 'A square matrix normally turns a vector somewhere else. For a few directions it does not: it only stretches or shrinks the vector it is given. [[1]] Those directions are the eigenvectors, and the stretch factor of each is its eigenvalue. Because $Av = \\lambda v$ can be rewritten as $(A - \\lambda I)v = 0$, a non-zero solution exists exactly when the matrix on the left is singular. [[2]]',
          },
        ],
      },
      {
        id: 'full',
        label: 'Full depth',
        blocks: [
          {
            type: 'paragraph',
            text: 'A square matrix normally turns a vector somewhere else. For a few directions it does not: it only stretches or shrinks the vector it is given. [[1]] Those directions are the eigenvectors of the matrix.',
          },
          { type: 'math', tex: 'A v = \\lambda v', label: 'A v equals lambda v' },
          {
            type: 'paragraph',
            text: 'Rearranging gives $(A - \\lambda I)v = 0$, which has a non-zero solution only when $A - \\lambda I$ is singular. That condition is the characteristic polynomial, and its roots are the eigenvalues. [[2]]',
          },
          {
            type: 'table',
            head: ['Eigenvalue', 'Effect on its eigenvector'],
            rows: [
              ['λ > 1', 'Stretched, same direction'],
              ['0 < λ < 1', 'Shortened, same direction'],
              ['λ < 0', 'Reversed'],
            ],
          },
        ],
      },
    ],
  },
};

/* glossary — `payload.entries`, each a term, a definition in inline prose and
   the `source` number the definition was drawn from. */
export const glossaryFixture = {
  id: 'artefact-glossary-linear-maps',
  format: 'glossary',
  conceptId: 'concept-eigenvectors',
  title: 'Linear maps',
  sources,
  payload: {
    entries: [
      {
        term: 'Eigenvector',
        definition:
          'A non-zero vector whose direction a matrix leaves alone, so that $Av = \\lambda v$.',
        source: 1,
      },
      {
        term: 'Eigenvalue',
        definition:
          'The factor $\\lambda$ by which a matrix scales its eigenvector.',
        source: 1,
      },
      {
        term: 'Characteristic polynomial',
        definition:
          'The polynomial $\\det(A - \\lambda I)$, whose roots are the eigenvalues of A.',
        source: 2,
      },
    ],
  },
};

/* flashcard — `front` and `back` are both prose blocks. */
export const flashcardFixture = {
  id: 'artefact-flashcard-eigenvalue',
  format: 'flashcard',
  conceptId: 'concept-eigenvectors',
  title: 'Eigenvalue',
  sources,
  payload: {
    front: [{ type: 'paragraph', text: 'What is an eigenvalue?' }],
    back: [
      {
        type: 'paragraph',
        text: 'The factor $\\lambda$ by which a matrix scales one of its eigenvectors, leaving the direction alone. [[1]]',
      },
    ],
  },
};

/* cloze — `segments` are rendered in order. A `text` segment is inline prose;
   a `blank` segment is filled in by the learner. `accept` holds further
   spellings that count as right; matching is case- and space-insensitive. */
export const clozeFixture = {
  id: 'artefact-cloze-eigenvector',
  format: 'cloze',
  conceptId: 'concept-eigenvectors',
  title: 'Eigenvectors',
  sources,
  payload: {
    segments: [
      { type: 'text', text: 'A non-zero vector whose direction a matrix leaves alone is called an ' },
      { type: 'blank', id: 'blank-1', answer: 'eigenvector', accept: ['eigen vector'] },
      { type: 'text', text: ', and the factor it is scaled by is its ' },
      { type: 'blank', id: 'blank-2', answer: 'eigenvalue', accept: ['eigen value'] },
      { type: 'text', text: '. [[1]]' },
    ],
  },
};

/* multiple_choice — one `correct` option, and every distractor carries the
   reason it is wrong. The reasons are shown after the answer, never before. */
export const multipleChoiceFixture = {
  id: 'artefact-choice-characteristic',
  format: 'multiple_choice',
  conceptId: 'concept-characteristic-polynomial',
  title: 'The characteristic polynomial',
  sources,
  payload: {
    stem: [
      {
        type: 'paragraph',
        text: 'What do the roots of $\\det(A - \\lambda I)$ give you?',
      },
    ],
    options: [
      {
        id: 'option-a',
        text: 'The eigenvalues of A',
        correct: true,
        reason: 'Right. A non-zero v solves $(A - \\lambda I)v = 0$ only where the determinant vanishes. [[2]]',
      },
      {
        id: 'option-b',
        text: 'The eigenvectors of A',
        correct: false,
        reason: 'The roots are scalars. Each eigenvector is found afterwards, by solving for that root. [[2]]',
      },
      {
        id: 'option-c',
        text: 'The rank of A',
        correct: false,
        reason: 'Rank is the dimension of the image of A and does not depend on $\\lambda$ at all.',
      },
      {
        id: 'option-d',
        text: 'The trace of A',
        correct: false,
        reason: 'The trace is the sum of the eigenvalues, not the set of them. It is one number.',
      },
    ],
  },
};

/* open_question — free text in, graded feedback back. `expectedPoints` is
   what a full answer covers; `sampleFeedback` stands in for the grade the
   agent will return, in the shape the renderer expects. */
export const openQuestionFixture = {
  id: 'artefact-open-eigenvectors',
  format: 'open_question',
  conceptId: 'concept-eigenvectors',
  title: 'Eigenvectors in your own words',
  sources,
  payload: {
    prompt: [
      {
        type: 'paragraph',
        text: 'Explain what it means for a vector to be an eigenvector of a matrix, and why the eigenvalue matters.',
      },
    ],
    expectedPoints: [
      { id: 'point-direction', text: 'The direction is unchanged by the matrix' },
      { id: 'point-scalar', text: 'The eigenvalue is the factor it is scaled by' },
      { id: 'point-nonzero', text: 'The vector must be non-zero' },
    ],
    sampleFeedback: {
      verdict: 'partly',
      summary: 'You have the direction and the scaling. The non-zero condition is missing.',
      covered: ['point-direction', 'point-scalar'],
      missing: ['point-nonzero'],
    },
  },
};

export const artefactFixtures = {
  summary: summaryFixture,
  glossary: glossaryFixture,
  flashcard: flashcardFixture,
  cloze: clozeFixture,
  multiple_choice: multipleChoiceFixture,
  open_question: openQuestionFixture,
};

/* A day's review queue: recall artefacts only, one at a time. */
export const reviewQueueFixture = [
  flashcardFixture,
  clozeFixture,
  multipleChoiceFixture,
  openQuestionFixture,
];

/* Mastery is a value in [0,1] per concept. It is the only progress display in
   the product, and it is rendered as grain density. */
export const conceptsFixture = [
  { id: 'concept-eigenvectors', name: 'Eigenvectors', mastery: 0.72 },
  { id: 'concept-characteristic-polynomial', name: 'The characteristic polynomial', mastery: 0.34 },
  { id: 'concept-diagonalisation', name: 'Diagonalisation', mastery: 0 },
  { id: 'concept-vector-spaces', name: 'Vector spaces', mastery: 1 },
];
