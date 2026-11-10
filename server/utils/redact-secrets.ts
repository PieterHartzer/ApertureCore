const REDACTED = '[redacted]'

// Environment variables whose values must never be printed.
const SECRET_ENV_NAME = /SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_KEY|ENCRYPTION_KEY|TOKEN_KEY|DATABASE_URL|DSN/i
const MIN_SECRET_LENGTH = 8

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Collects secret values from the environment, longest first so a value that
 * contains another is replaced whole.
 */
export const collectSecretValues = (env: Record<string, string | undefined>) => {
  const values = new Set<string>()

  for (const [name, value] of Object.entries(env)) {
    if (!value || !SECRET_ENV_NAME.test(name)) {
      continue
    }

    const trimmed = value.trim()

    if (trimmed.length >= MIN_SECRET_LENGTH) {
      values.add(trimmed)
    }

    // Keys written as data URIs are often printed without their prefix.
    const encoded = trimmed.split('base64,')[1]

    if (encoded && encoded.length >= MIN_SECRET_LENGTH) {
      values.add(encoded)
    }

    // A database URL's password can appear on its own in driver errors.
    try {
      const password = decodeURIComponent(new URL(trimmed).password)

      if (password.length >= MIN_SECRET_LENGTH) {
        values.add(password)
      }
    } catch {
      // Not a URL.
    }
  }

  return [...values].sort((left, right) => right.length - left.length)
}

const PATTERNS: Array<[RegExp, string]> = [
  // Authorization headers and bearer tokens.
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
  // JSON web tokens.
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, REDACTED],
  // Provider API keys such as sk-..., sk-ant-..., AIza...
  [/\b(sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,})/g, REDACTED],
  // Credentials inside URLs: scheme://user:password@host
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]*:)[^\s@/]+@/gi, `$1${REDACTED}@`],
  // key: value, key=value and "key":"value" forms, as printed by objects and connection strings.
  [
    /((?:password|passwd|pwd|secret|client_?secret|token|access_?token|refresh_?token|id_?token|api_?key|authorization|encryption_?key|private_?key)["']?\s*[:=]\s*)(["']?)[^"'\s,;}&]+\2/gi,
    `$1$2${REDACTED}$2`
  ]
]

export const createSecretRedactor = (secrets: string[]) => {
  const known = secrets.length > 0
    ? new RegExp(secrets.map(escapeRegExp).join('|'), 'g')
    : null

  return (text: string) => {
    let result = known ? text.replace(known, REDACTED) : text

    for (const [pattern, replacement] of PATTERNS) {
      result = result.replace(pattern, replacement)
    }

    return result
  }
}
