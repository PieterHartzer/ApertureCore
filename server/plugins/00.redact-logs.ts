import { collectSecretValues, createSecretRedactor } from '../utils/redact-secrets'

const PATCHED = Symbol.for('aperture.redactedLogs')

type Write = typeof process.stdout.write

/**
 * Filters everything the server prints, including console calls, Nuxt's own
 * logger and uncaught error output, so secrets never reach the logs.
 */
export default defineNitroPlugin(() => {
  const target = process as typeof process & { [PATCHED]?: boolean }

  if (target[PATCHED]) {
    return
  }

  target[PATCHED] = true

  const redact = createSecretRedactor(collectSecretValues(process.env))

  for (const stream of [process.stdout, process.stderr]) {
    const original = stream.write.bind(stream) as Write

    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      const text = typeof chunk === 'string'
        ? chunk
        : chunk instanceof Uint8Array ? Buffer.from(chunk).toString('utf8') : null

      return (original as (...args: unknown[]) => boolean)(text === null ? chunk : redact(text), ...rest)
    }) as Write
  }
})
