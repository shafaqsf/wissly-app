/* Stand-ins for the queries this dashboard will make once the database
   exists. Each one is async on purpose: replacing a body with a Supabase call
   must not change a single caller, and the panels above them must already be
   written for data that arrives late.
   Delete this file when the last panel reads from Postgres. */

export async function getCourses() {
  return [
    { id: 'algebra', title: 'Linear algebra', progress: 0.62 },
    { id: 'rhetoric', title: 'Rhetoric', progress: 0.28 },
    { id: 'systems', title: 'Distributed systems', progress: 0 },
  ];
}

export async function getProgressSummary() {
  return {
    lessonsCompleted: 24,
    lessonsTotal: 61,
    streakDays: 5,
  };
}

export async function getRecentLessons() {
  return [];
}
