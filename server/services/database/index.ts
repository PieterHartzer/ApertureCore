import type {
  ExecuteDatabaseReadOnlyQueryInput,
  ExecuteDatabaseReadOnlyQueryResult,
  ExplainDatabaseQueryInput,
  ExplainDatabaseQueryResult,
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult,
} from '../../types/database'

import { resolveDatabaseTarget, type DatabaseTarget } from '../../utils/database-host-guard'

import { adviseQueryPlan } from './query-advice'

import {
  createDatabaseConnectionTester,
  createDatabaseQueryExecutor
} from './factory'

const refusedTarget = (target: Extract<DatabaseTarget, { allowed: false }>) => ({
  ok: false,
  code: 'connection_failed',
  message: 'connection_failed',
  details: target.reason === 'blocked'
    ? 'This database host is not allowed.'
    : 'This database host could not be found.'
} as const)

export const testDatabaseConnection = async (
  input: TestDatabaseConnectionInput
): Promise<TestDatabaseConnectionResult> => {
  const target = await resolveDatabaseTarget(input.host, input.port)

  if (!target.allowed) {
    return refusedTarget(target)
  }

  const tester = createDatabaseConnectionTester(input.databaseType)

  return tester.testConnection({ ...input, connectAddress: target.connectAddress })
}

export const testDatabaseReadOnlyQuery = async (
  input: ExecuteDatabaseReadOnlyQueryInput
): Promise<ExecuteDatabaseReadOnlyQueryResult> => {
  return executeDatabaseReadOnlyQuery(input)
}

export const executeDatabaseReadOnlyQuery = async (
  input: ExecuteDatabaseReadOnlyQueryInput
): Promise<ExecuteDatabaseReadOnlyQueryResult> => {
  const target = await resolveDatabaseTarget(input.host, input.port)

  if (!target.allowed) {
    return refusedTarget(target)
  }

  try {
    const executor = createDatabaseQueryExecutor(input.databaseType)

    return executor.executeReadOnlyQuery({ ...input, connectAddress: target.connectAddress })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === `unsupported_database_type:${input.databaseType}`
    ) {
      return {
        ok: false,
        code: 'unsupported_database_type',
        message: 'unsupported_database_type'
      }
    }

    throw error
  }
}

/** The database's plan for a query, checked against the same host rules as running it. */
export const explainDatabaseQuery = async (
  input: ExplainDatabaseQueryInput
): Promise<ExplainDatabaseQueryResult> => {
  const target = await resolveDatabaseTarget(input.host, input.port)

  if (!target.allowed) {
    return refusedTarget(target)
  }

  try {
    const executor = createDatabaseQueryExecutor(input.databaseType)

    const result = await executor.explainQuery({ ...input, connectAddress: target.connectAddress })

    return result.ok ? { ...result, plan: { ...result.plan, advice: adviseQueryPlan(result.plan, input.sql) } } : result
  } catch (error) {
    if (error instanceof Error && error.message === `unsupported_database_type:${input.databaseType}`) {
      return { ok: false, code: 'unsupported_database_type', message: 'unsupported_database_type' }
    }

    throw error
  }
}
