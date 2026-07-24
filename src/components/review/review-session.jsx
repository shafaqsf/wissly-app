'use client';

import ReviewQueue from './review-queue';
import { sampleGrade } from '@/lib/artefact-fixtures';

/* The queue with its two callbacks filled in.

   Both are stand-ins. `onRate` will hand the grade to the scheduler and
   `onGrade` will ask the agent to mark an open answer; until those layers
   exist, the rating is dropped and the marking is answered from the fixture
   after a beat, so the working grain field is actually visible. */
export default function ReviewSession({ artefacts = [] }) {
  async function grade() {
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });

    return sampleGrade;
  }

  return <ReviewQueue artefacts={artefacts} onRate={() => {}} onGrade={grade} />;
}
