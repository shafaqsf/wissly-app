/* A stand-in for the Supabase client, for tests only.
 *
 * The real client builds a query by chaining and resolves like a promise at
 * the end. Faking that with hand-written objects per test buries the thing
 * under test in scaffolding, so the chain is recorded instead: every call is
 * appended to `calls`, and the result comes from whatever the test queued.
 *
 * It deliberately does not implement PostgREST. It proves which query was
 * built, not that Postgres would answer it — that is what the migration
 * files and a real database are for.
 */

const TERMINAL = new Set(['single', 'maybeSingle'])

export function fakeSupabase(results = {}) {
  const calls = []

  function builder(table) {
    const chain = []
    let settled = null

    const result = () => {
      const queued = results[table]
      const value = Array.isArray(queued) ? queued.shift() : queued
      return value ?? { data: null, error: null }
    }

    const proxy = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'then') {
            // Awaiting the chain is what runs it.
            return (resolve, reject) => {
              settled ??= result()
              calls.push({ table, chain: [...chain], result: settled })
              return Promise.resolve(settled).then(resolve, reject)
            }
          }

          return (...args) => {
            chain.push({ method: String(property), args })

            if (TERMINAL.has(String(property))) {
              settled ??= result()
            }

            return proxy
          }
        },
      },
    )

    return proxy
  }

  return {
    calls,
    from(table) {
      return builder(table)
    },
    /** The chain built against one table, for a test to assert on. */
    query(table) {
      return calls.find((call) => call.table === table)
    },
    /** Every chain built against one table, in order. */
    queries(table) {
      return calls.filter((call) => call.table === table)
    },
  }
}

/** Did the chain call `method`, and with what? */
export function argsOf(call, method) {
  return call?.chain.find((step) => step.method === method)?.args
}

/** The methods a chain called, in order. */
export function methodsOf(call) {
  return call?.chain.map((step) => step.method) ?? []
}

/** Every call to `method` in the chain, for a query that filters more than once. */
export function argsOfAll(call, method) {
  return (call?.chain ?? []).filter((step) => step.method === method).map((step) => step.args)
}
