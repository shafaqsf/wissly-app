/**
 * Read one environment variable, or say which one is missing.
 *
 * Without this, an empty `.env.local` surfaces as an opaque network error on
 * the first query rather than as the configuration mistake it is.
 */
export function requireEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`)
  }

  return value
}
