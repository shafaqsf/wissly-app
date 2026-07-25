/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Three screens moved when the six areas became four. The old addresses are
     in bookmarks and in notes, so they redirect rather than 404 — permanently,
     because the areas they named do not exist any more.

     `/review` became the mixed FSRS queue inside the workbench, `/progress`
     became `/analytics`, and `/library` dissolved into the course page, which
     is why it lands on the list rather than on any one course. */
  async redirects() {
    return [
      { source: '/review', destination: '/tasks/due', permanent: true },
      { source: '/progress', destination: '/analytics', permanent: true },
      { source: '/library', destination: '/courses', permanent: true },
    ];
  },
};

export default nextConfig;
