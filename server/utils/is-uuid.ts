import { validate } from 'uuid'

export const isUuid = (value: string): boolean => {
  return validate(value)
}
