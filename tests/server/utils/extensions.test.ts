import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildGuardRejectionResponse,
  isGuardRejection,
  runGuardedCreate,
  serverExtensions,
  type GuardRejection
} from '../../../server/utils/extensions'

const rejection: GuardRejection = { ok: false, code: 'limit_reached', limit: 'things', message: 'errors.limit' }

describe('server extensions', () => {
  afterEach(() => {
    delete serverExtensions.guardCreate
    vi.unstubAllGlobals()
  })

  it('runs the write directly when nothing guards it', async () => {
    await expect(runGuardedCreate('queries', 'org', 'db', async database => `${database}-row`)).resolves.toBe('db-row')
  })

  it('lets a guard refuse the write', async () => {
    const work = vi.fn()

    serverExtensions.guardCreate = (async () => rejection) as typeof serverExtensions.guardCreate

    await expect(runGuardedCreate('queries', 'org', 'db', work)).resolves.toBe(rejection)
    expect(work).not.toHaveBeenCalled()
  })

  it('recognises a rejection and answers with its message', () => {
    const setResponseStatus = vi.fn()

    vi.stubGlobal('setResponseStatus', setResponseStatus)

    expect(isGuardRejection(rejection)).toBe(true)
    expect(isGuardRejection({ ok: false, code: 'not_found' })).toBe(false)
    expect(buildGuardRejectionResponse({} as never, rejection)).toMatchObject({ code: 'limit_reached', messageKey: 'errors.limit' })
    expect(setResponseStatus).toHaveBeenCalledWith({}, 403)
  })
})
