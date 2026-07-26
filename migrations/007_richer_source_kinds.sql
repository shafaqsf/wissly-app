-- 007_richer_source_kinds.sql
--
-- Three more ways material arrives: a slide deck, a web link, a photo of a
-- page. Stage 1 ingested `text` and `pdf`; this widens `sources.kind` to
-- `pptx`, `url` and `image` and gives a source somewhere to keep where it
-- came from when that is not the raw text itself — a web address today, and
-- nothing yet for a photo, since there is no file storage in this schema to
-- point at (see src/lib/agent/ingest.js for what each kind ingests to).
--
-- Row level security. Both changes land on `public.sources`, which already
-- enables RLS (001) and already carries four policies — select, insert,
-- update, delete — every one predicated on `(select auth.uid()) = user_id`.
-- Policies are per table and per command, never per kind or per column, so
-- the existing four cover every new kind and the new column the moment they
-- exist. No policy is added, changed or weakened here.

-- Dropped and re-added under its original, implicit name so this file can be
-- re-run without failing on a constraint that already matches.
alter table public.sources
  drop constraint if exists sources_kind_check;

alter table public.sources
  add constraint sources_kind_check
  check (kind in ('text', 'pdf', 'pptx', 'url', 'image'));

alter table public.sources
  add column if not exists origin text;

comment on column public.sources.origin is
  'Where the material came from, when that is not the raw text itself: the '
  'address a url source was fetched from. Null for text, pdf, pptx and image.';
