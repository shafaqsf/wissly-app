/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Two screens moved when the six areas became four. The old addresses are
     in bookmarks and in notes, so they redirect rather than 404 — permanently,
     because the areas they named do not exist any more.

     `/review` became the mixed FSRS queue inside the workbench and `/progress`
     became `/analytics`. `/library` used to redirect here too — it dissolved
     into the course page in v0.14.0 — but v0.23.0 gives the address a new,
     unrelated meaning: the public course library, browsable signed out. That
     is a different screen, not the old one coming back, so the redirect is
     gone rather than repointed. */
  async redirects() {
    return [
      { source: '/review', destination: '/tasks/due', permanent: true },
      { source: '/progress', destination: '/analytics', permanent: true },
    ];
  },
};

export default nextConfig;
