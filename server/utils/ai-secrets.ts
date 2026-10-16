import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { useRuntimeConfig } from '#imports'
import { createError } from 'h3'
const key = () => {
  const secret = useRuntimeConfig().appDatabaseEncryptionKey
  if (!secret?.trim()) throw createError({ statusCode: 503, statusMessage: 'Configure APP_DATABASE_ENCRYPTION_KEY to store AI credentials.' })
  return createHash('sha256').update(secret).digest()
}
export const encryptAICredentials = (credentials: Record<string, string>) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(credentials)), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map(value => value.toString('base64url')).join('.')
}
export const decryptAICredentials = (encrypted: string): Record<string, string> => {
  const [iv, tag, data] = encrypted.split('.').map(value => Buffer.from(value, 'base64url'))
  if (!iv || !tag || !data) throw new Error('Invalid encrypted AI credentials')
  const cipher = createDecipheriv('aes-256-gcm', key(), iv)
  cipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8'))
}
