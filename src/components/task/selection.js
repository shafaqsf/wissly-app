'use client';

import { useCallback, useMemo, useState } from 'react';

/* A selection of rows, held above the filter.

   This is the whole trick, and it is a trick about where the state lives
   rather than about what it does. A filter narrows what is *shown*; it says
   nothing about what the learner has picked. So the set of ids sits in the
   workbench, one level above the filter that draws the list, and changing the
   filter re-derives the rows without ever touching it.

   The consequence has to be visible, or it is a bug rather than a feature:
   `hidden` counts the rows that are selected and no longer on screen, and the
   bulk bar says so before acting on them. */
export function useSelection() {
  const [ids, setIds] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Add every row currently shown, or drop them if they are all in already. */
  const toggleAll = useCallback((shownIds) => {
    setIds((current) => {
      const next = new Set(current);
      const all = shownIds.every((id) => next.has(id));

      for (const id of shownIds) {
        if (all) next.delete(id);
        else next.add(id);
      }

      return next;
    });
  }, []);

  const clear = useCallback(() => setIds(new Set()), []);

  return useMemo(
    () => ({
      ids,
      list: [...ids],
      count: ids.size,
      has: (id) => ids.has(id),
      toggle,
      toggleAll,
      clear,
      /** How many selected rows the current filter is hiding. */
      hiddenFrom: (shown) => {
        const visible = new Set(shown.map((task) => task.id));
        return [...ids].filter((id) => !visible.has(id)).length;
      },
    }),
    [ids, toggle, toggleAll, clear],
  );
}
