import { validate } from 'uuid'

/**
 * Returns true when the provided string is a syntactically valid UUID.
 */
export const isUuid = (value: string): boolean => {
  return validate(value)
}
