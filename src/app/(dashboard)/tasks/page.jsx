import { redirect } from 'next/navigation';

/* `/tasks` is a junction, not a screen. The workbench always shows one type,
   and the type that answers "what now" is Due, so that is where the area
   opens. The course, if one was picked, travels with the redirect. */
export default async function TasksPage({ searchParams }) {
  const { course = '' } = (await searchParams) ?? {};

  redirect(course ? `/tasks/due?course=${course}` : '/tasks/due');
}
