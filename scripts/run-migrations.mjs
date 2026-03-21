import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'

import { Kysely, Migrator, FileMigrationProvider, PostgresDialect } from 'kysely'
import pg from 'pg'

const { Pool } = pg

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = resolve(
  currentDirectory,
  '../server/database/migrations'
)
const environment = process.env.NODE_ENV || 'development'
const environmentEnvFile = resolve(currentDirectory, `../.env.${environment}`)

try {
  process.loadEnvFile(environmentEnvFile)
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
    throw error
  }
}

const appDatabaseUrl = process.env.APP_DATABASE_URL
const migrationCommand = process.argv[2] || 'latest'

if (!appDatabaseUrl) {
  console.error('APP_DATABASE_URL is required to run migrations.')
  process.exit(1)
}

if (!['latest', 'down'].includes(migrationCommand)) {
  console.error(
    `Unsupported migration command "${migrationCommand}". Use "latest" or "down".`
  )
  process.exit(1)
}

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: appDatabaseUrl
    })
  })
})

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path: { join, resolve },
    migrationFolder: migrationsDirectory
  })
})

try {
  const { error, results } = await (
    migrationCommand === 'down'
      ? migrator.migrateDown()
      : migrator.migrateToLatest()
  )

  results?.forEach((result) => {
    if (result.status === 'Success') {
      console.log(
        migrationCommand === 'down'
          ? `Rolled back migration ${result.migrationName}`
          : `Applied migration ${result.migrationName}`
      )
    } else if (result.status === 'Error') {
      console.error(`Failed migration ${result.migrationName}`)
    }
  })

  if (error) {
    console.error(
      migrationCommand === 'down'
        ? 'Rollback failed:'
        : 'Migration failed:',
      error
    )
    process.exit(1)
  }
} finally {
  await db.destroy()
}
