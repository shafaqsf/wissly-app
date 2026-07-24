import { CLOZE_BLANK } from '@/lib/agent/formats';

/* One example artefact per Stage 1 format, in the shape the generation layer
   produces. The schemas live in `src/lib/agent/formats.js` and that file is
   the contract; this one only holds examples to build and test against, and
   goes away when the database feeds these components.

   The envelope, from the generation layer:

     subject_id, section_id, concept_id
     format           one of the six Stage 1 formats
     payload          format-specific — see PAYLOAD_SCHEMAS
     section_ordinal  the numeral the citation anchor prints
     anchor           { page } for a PDF, { start, end, heading? } for text

   Two fields are the UI's own and are not part of the contract:

     id       a stable key for a list and for reporting an answer back
     passage  the source text the anchor opens; the renderer degrades to the
              anchor description alone when it is absent */

const subject_id = 'subject-linear-algebra';

const eigenvectors = {
  subject_id,
  section_id: 'section-eigenvectors',
  concept_id: 'concept-eigenvectors',
  section_ordinal: 1,
  anchor: { page: 12 },
  passage:
    'A non-zero vector v is an eigenvector of a square matrix A when Av is a scalar multiple of v. That scalar is the eigenvalue belonging to v.',
};

const characteristic = {
  subject_id,
  section_id: 'section-characteristic-polynomial',
  concept_id: 'concept-characteristic-polynomial',
  section_ordinal: 2,
  anchor: { start: 1840, end: 2104, heading: 'The characteristic polynomial' },
  passage:
    'The eigenvalues of A are exactly the roots of det(A - λI) = 0, the characteristic polynomial of A.',
};

export const summaryFixture = {
  ...eigenvectors,
  id: 'artefact-summary-eigenvectors',
  format: 'summary',
  payload: {
    three_sentences: [
      'An eigenvector of a matrix keeps its direction when the matrix acts on it.',
      'Only its length changes, and the factor it changes by is the eigenvalue.',
      'Finding them means solving $\\det(A - \\lambda I) = 0$.',
    ],
    paragraph:
      'A square matrix normally turns a vector somewhere else. For a few directions it does not: it only stretches or shrinks the vector it is given. Those directions are the eigenvectors, and the stretch factor of each is its eigenvalue. Because $Av = \\lambda v$ can be rewritten as $(A - \\lambda I)v = 0$, a non-zero solution exists exactly when the matrix on the left is singular.',
    full: 'A square matrix normally turns a vector somewhere else. For a few directions it does not: it only stretches or shrinks the vector it is given. Those directions are the eigenvectors of the matrix.\n\n$$A v = \\lambda v$$\n\nRearranging gives $(A - \\lambda I)v = 0$, which has a non-zero solution only when $A - \\lambda I$ is singular. That condition is the characteristic polynomial, and its roots are the eigenvalues.\n\n```python\ndef eigenvalues(a):  # the roots of the characteristic polynomial\n    return numpy.linalg.eigvals(a)\n```',
  },
};

export const glossaryFixture = {
  ...eigenvectors,
  id: 'artefact-glossary-eigenvector',
  format: 'glossary',
  payload: {
    term: 'Eigenvector',
    definition:
      'A non-zero vector whose direction a matrix leaves alone, so that $Av = \\lambda v$.',
  },
};

export const flashcardFixture = {
  ...eigenvectors,
  id: 'artefact-flashcard-eigenvalue',
  format: 'flashcard',
  payload: {
    front: 'What is an eigenvalue?',
    back: 'The factor $\\lambda$ by which a matrix scales one of its eigenvectors, leaving the direction alone.',
  },
};

export const clozeFixture = {
  ...eigenvectors,
  id: 'artefact-cloze-eigenvector',
  format: 'cloze',
  payload: {
    text: `A non-zero vector whose direction a matrix leaves alone is called an ${CLOZE_BLANK}.`,
    answer: 'eigenvector',
  },
};

export const multipleChoiceFixture = {
  ...characteristic,
  id: 'artefact-choice-characteristic',
  format: 'multiple_choice',
  payload: {
    stem: 'What do the roots of $\\det(A - \\lambda I)$ give you?',
    options: [
      'The eigenvalues of A',
      'The eigenvectors of A',
      'The rank of A',
      'The trace of A',
    ],
    answer_index: 0,
    rationales: [
      'Right. A non-zero v solves $(A - \\lambda I)v = 0$ only where the determinant vanishes.',
      'The roots are scalars. Each eigenvector is found afterwards, by solving for that root.',
      'Rank is the dimension of the image of A and does not depend on $\\lambda$ at all.',
      'The trace is the sum of the eigenvalues, not the set of them. It is one number.',
    ],
  },
};

export const openQuestionFixture = {
  ...eigenvectors,
  id: 'artefact-open-eigenvectors',
  format: 'open_question',
  payload: {
    prompt:
      'Explain what it means for a vector to be an eigenvector of a matrix, and why the eigenvalue matters.',
    model_answer:
      'A non-zero vector v is an eigenvector of A when Av points along v. The eigenvalue is the factor v is scaled by, and it tells you whether the direction is stretched, shrunk or reversed.',
    criteria: [
      'The direction is unchanged by the matrix',
      'The eigenvalue is the factor it is scaled by',
      'The vector must be non-zero',
    ],
  },
};

/* The grade the agent returns for a free-text answer. Never stored on the
   artefact — see `gradeAnswer` in src/lib/agent/artefacts.js. */
export const sampleGrade = {
  verdict: 'partial',
  score: 0.6,
  missing: ['The vector must be non-zero'],
  feedback:
    'You have the direction and the scaling. The answer never says the vector has to be non-zero, and the zero vector would otherwise satisfy the equation for every scalar.',
};

export const artefactFixtures = {
  summary: summaryFixture,
  glossary: glossaryFixture,
  flashcard: flashcardFixture,
  cloze: clozeFixture,
  multiple_choice: multipleChoiceFixture,
  open_question: openQuestionFixture,
};

/* A day's review queue: recall formats only, one at a time. */
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
  {
    id: 'concept-characteristic-polynomial',
    name: 'The characteristic polynomial',
    mastery: 0.34,
  },
  { id: 'concept-diagonalisation', name: 'Diagonalisation', mastery: 0 },
  { id: 'concept-vector-spaces', name: 'Vector spaces', mastery: 1 },
];
