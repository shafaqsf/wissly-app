-- 003_concept_mastery.sql
--
-- Mastery per concept, in [0, 1]. This is the number the grain density on
-- every screen renders: 0 is `--grain-3` (unattempted), 1 is `--grain-0`
-- (settled). There is no second progress display.
--
-- The formula
-- -----------
--   1. Take every artefact that names the concept (`artefacts.concept_id`).
--   2. For each artefact, keep only its most recent review — the FSRS
--      grade of the latest attempt is the current evidence; earlier
--      attempts are history, not state.
--   3. Score that review from its FSRS rating, linearly:
--          1 (again) -> 0.0    2 (hard) -> 1/3
--          3 (good)  -> 2/3    4 (easy) -> 1.0
--      i.e. (rating - 1) / 3.
--   4. An artefact that has never been reviewed scores 0. Unattempted and
--      failed both mean "not yet known", and both should read as grain.
--   5. Mastery is the mean of those artefact scores.
--   6. A concept with no artefacts at all has mastery 0.
--
-- Deliberately simple: it is a mean of the latest evidence, with no decay
-- over time. Forgetting is already modelled by FSRS through `due_at`, and
-- applying it twice would double-count.
--
-- `security_invoker = true` is not optional. A view runs with its owner's
-- privileges by default, which would hand every learner every other
-- learner's mastery; with it, the RLS policies on `concepts`, `artefacts`
-- and `reviews` are evaluated as the caller.

create or replace view public.concept_mastery
  with (security_invoker = true)
as
with latest_review as (
  select distinct on (r.artefact_id)
    r.artefact_id,
    r.rating
  from public.reviews r
  order by r.artefact_id, r.reviewed_at desc, r.id desc
),
artefact_score as (
  select
    a.concept_id,
    a.user_id,
    coalesce((lr.rating - 1)::numeric / 3, 0) as score
  from public.artefacts a
  left join latest_review lr on lr.artefact_id = a.id
  where a.concept_id is not null
)
select
  c.id as concept_id,
  c.user_id,
  c.subject_id,
  count(s.score) as artefact_count,
  coalesce(avg(s.score), 0)::numeric(4, 3) as mastery
from public.concepts c
left join artefact_score s on s.concept_id = c.id
group by c.id, c.user_id, c.subject_id;

comment on view public.concept_mastery is
  'Mastery per concept in [0,1]: the mean, over the concept''s artefacts, of '
  '(rating - 1) / 3 taken from each artefact''s most recent review, with '
  'never-reviewed artefacts scoring 0. Drives grain density.';
