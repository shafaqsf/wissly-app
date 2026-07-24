'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

import ReviewQueue from './review-queue';

/* The queue with its two callbacks filled in.

   Both are server actions handed down from the page — a client component can
   reach neither the database nor the model, and should not try. The rating is
   recorded as it happens; the page is refreshed once the sitting is over
   rather than after every artefact, so a round trip the learner has no use
   for does not interrupt the rhythm. */
export default function ReviewSession({ artefacts = [], onRateAction, onGradeAction }) {
  const router = useRouter();
  const rated = useRef(0);

  async function rate({ artefactId, rating }) {
    rated.current += 1;
    const wasLast = rated.current >= artefacts.length;

    await onRateAction({ artefactId, rating });

    if (wasLast) {
      router.refresh();
    }
  }

  return <ReviewQueue artefacts={artefacts} onRate={rate} onGrade={onGradeAction} />;
}
