import { execFileSync } from 'node:child_process'

import { beforeAll, describe, expect, it, vi } from 'vitest'

import { createDatabaseConnectionTester, createDatabaseQueryExecutor } from '../../server/services/database/factory'
import { SCHEMA_SQL } from '../../server/services/database-schema'
import type { DatabaseType, QueryPlanNode } from '../../server/types/database'

// Only the SQL constants are needed; the service pulls in Nuxt runtime imports.
vi.mock('../../server/services/saved-sql-queries', () => ({}))

const COMPOSE = ['compose', '-f', 'docker-compose.test-db.yml', 'exec', '-T']
const ADMIN_PASSWORD = 'TestAdmin1!'
const READER_PASSWORD = 'Reader1!Pass'

const run = (service: string, command: string[], input: string) => {
  execFileSync('docker', [...COMPOSE, service, ...command], { input, stdio: ['pipe', 'pipe', 'pipe'] })
}

const pgSetup = (statements: string) => run('postgres', ['psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'autodash_test'], statements)
const mysqlSetup = (service: string, client: string) => (statements: string) =>
  run(service, [client, '-h127.0.0.1', '-uroot', `-p${ADMIN_PASSWORD}`, 'autodash_test'], statements)
const mssqlSetup = (statements: string) =>
  run('mssql', ['/opt/mssql-tools18/bin/sqlcmd', '-C', '-b', '-S', 'localhost', '-U', 'sa', '-P', ADMIN_PASSWORD], statements)

const MYSQL_SEED = `
drop table if exists orders_child; drop table if exists orders;
create table orders (id int primary key, label varchar(50));
create table orders_child (id int primary key, order_id int, foreign key (order_id) references orders(id));
insert into orders values (1,'a'),(2,'b'),(3,'c'),(4,'d'),(5,'e');
drop user if exists 'reader'@'%'; drop user if exists 'filer'@'%';
create user 'reader'@'%' identified by '${READER_PASSWORD}';
grant select on autodash_test.* to 'reader'@'%';
create user 'filer'@'%' identified by '${READER_PASSWORD}';
grant select on autodash_test.* to 'filer'@'%';
grant file on *.* to 'filer'@'%';
`

interface Engine {
  name: string
  type: DatabaseType
  port: number
  admin: string
  privileged: string
  limitBypass: string
  writeAttempts: string[]
  selectAll: string
  setup: () => void
}

const engines: Engine[] = [
  {
    name: 'postgres',
    type: 'postgres',
    port: 15432,
    admin: 'postgres',
    privileged: 'postgres',
    limitBypass: 'select * from orders) t --',
    selectAll: 'select id, label from orders order by id',
    writeAttempts: ['with x as (delete from orders returning id) select * from x'],
    setup: () => pgSetup(`
      drop table if exists orders_child; drop table if exists orders; drop role if exists reader;
      create table orders (id int primary key, label text);
      create table orders_child (id int primary key, order_id int references orders(id));
      insert into orders select g, chr(96 + g) from generate_series(1, 5) g;
      create role reader login password '${READER_PASSWORD}';
      grant select on all tables in schema public to reader;
    `)
  },
  {
    name: 'mysql',
    type: 'mysql',
    port: 13306,
    admin: 'filer',
    privileged: 'filer',
    limitBypass: 'select * from orders limit 18446744073709551615',
    selectAll: 'select id, label from orders order by id',
    writeAttempts: ['with x as (select 1) delete from orders'],
    setup: () => mysqlSetup('mysql', 'mysql')(MYSQL_SEED)
  },
  {
    name: 'mariadb',
    type: 'mysql',
    port: 13307,
    admin: 'filer',
    privileged: 'filer',
    limitBypass: 'select * from orders limit 1000000',
    selectAll: 'select id, label from orders order by id',
    writeAttempts: [],
    setup: () => mysqlSetup('mariadb', 'mariadb')(MYSQL_SEED)
  },
  {
    name: 'mssql',
    type: 'mssql',
    port: 11433,
    admin: 'sa',
    privileged: 'sa',
    limitBypass: 'select top 1000000 * from orders',
    selectAll: 'select id, label from orders order by id',
    writeAttempts: [
      'select 1 as a delete from orders',
      'with x as (select 1 as a) delete from orders',
      'select 1 as a exec sp_who',
      'select * into copied from orders'
    ],
    setup: () => mssqlSetup(`
if db_id('autodash_test') is null create database autodash_test
go
use autodash_test
if object_id('orders_child') is not null drop table orders_child
if object_id('orders') is not null drop table orders
create table orders (id int primary key, label nvarchar(50))
create table orders_child (id int primary key, order_id int foreign key references orders(id))
insert into orders values (1,'a'),(2,'b'),(3,'c'),(4,'d'),(5,'e')
if exists (select 1 from sys.database_principals where name = 'reader') drop user reader
if exists (select 1 from sys.database_principals where name = 'writer') drop user writer
if exists (select 1 from sys.server_principals where name = 'reader') drop login reader
if exists (select 1 from sys.server_principals where name = 'writer') drop login writer
create login reader with password = '${READER_PASSWORD}', check_policy = off
create user reader for login reader
alter role db_datareader add member reader
create login writer with password = '${READER_PASSWORD}', check_policy = off
create user writer for login writer
alter role db_datareader add member writer
grant insert on dbo.orders to writer
go
`)
  }
]

// Each engine is seeded once, whichever describe block runs first.
const seeded = new Set<string>()
const seed = (engine: Engine) => {
  if (seeded.has(engine.name)) return

  engine.setup()
  seeded.add(engine.name)
}

const input = (engine: Engine, username: string, password = READER_PASSWORD) => ({
  connectionName: 'integration',
  databaseType: engine.type,
  host: '127.0.0.1',
  port: engine.port,
  databaseName: 'autodash_test',
  username,
  password,
  sslMode: 'disable' as const
})

describe.runIf(process.env.RUN_DB_INTEGRATION === '1').each(engines)('$name adapter', (engine) => {
  const reader = input(engine, 'reader')
  const execute = (sql: string, maxRows = 3, timeoutMs = 3000) =>
    createDatabaseQueryExecutor(engine.type).executeReadOnlyQuery({ ...reader, sql, maxRows, timeoutMs })

  beforeAll(() => seed(engine), 60_000)

  it('accepts a read-only login', async () => {
    await expect(createDatabaseConnectionTester(engine.type).testConnection(reader)).resolves.toMatchObject({ ok: true })
  })

  it('refuses a privileged login at test time and at run time', async () => {
    const password = engine.privileged === 'filer' ? READER_PASSWORD : ADMIN_PASSWORD
    const privileged = input(engine, engine.privileged, password)

    await expect(createDatabaseConnectionTester(engine.type).testConnection(privileged)).resolves.toMatchObject({ code: 'privileged_role' })
    await expect(createDatabaseQueryExecutor(engine.type).executeReadOnlyQuery({ ...privileged, sql: engine.selectAll }))
      .resolves.toMatchObject({ code: 'query_rejected' })
  })

  it('reports bad credentials', async () => {
    await expect(createDatabaseConnectionTester(engine.type).testConnection(input(engine, 'reader', 'wrong-password')))
      .resolves.toMatchObject({ code: 'authentication_failed' })
  })

  it('returns ordered columns and rows up to the limit', async () => {
    const result = await execute(engine.selectAll)

    expect(result).toMatchObject({ ok: true, columns: ['id', 'label'], rowLimit: 3 })
    expect(result.ok && result.rows).toHaveLength(3)
    expect(result.ok && result.rows[0]).toEqual({ id: 1, label: 'a' })
  })

  it('returns columns for an empty result', async () => {
    await expect(execute('select id, label from orders where id = -1')).resolves.toMatchObject({ ok: true, columns: ['id', 'label'], rows: [] })
  })

  it('keeps the limit whatever the SQL says', async () => {
    const result = await execute(engine.limitBypass)

    if (result.ok) expect(result.rows.length).toBeLessThanOrEqual(3)
    else expect(result.code).toMatch(/query_/)
  })

  it('refuses writes and leaves the data unchanged', async () => {
    for (const sql of engine.writeAttempts) {
      await expect(execute(sql)).resolves.toMatchObject({ ok: false })
    }

    const count = await execute('select count(*) as total from orders')

    expect(count.ok && Number(count.rows[0]?.total)).toBe(5)
  })

  it('returns counts and decimals as numbers, keeping integers too big to be exact as text', async () => {
    const castBig = engine.type === 'mysql' ? 'cast(123456789012345678 as signed)' : 'cast(123456789012345678 as bigint)'
    const result = await execute(`select count(*) as total, cast(12.50 as decimal(10,2)) as price, ${castBig} as huge from orders`)

    expect(result).toMatchObject({ ok: true, rows: [{ total: 5, price: 12.5, huge: '123456789012345678' }] })
  })

  it('stops a slow query at the timeout', async () => {
    const slow = {
      postgres: 'select pg_sleep(30)',
      mysql: 'select sleep(30), o.* from orders o',
      mssql: 'select count_big(*) as n from sys.all_objects a cross join sys.all_objects b cross join sys.all_objects c cross join sys.all_objects d'
    }[engine.type]
    const started = Date.now()
    const result = await execute(slow, 3, 1000)

    expect(Date.now() - started).toBeLessThan(8000)
    // MySQL's sleep() returns early with a value when interrupted.
    if (engine.type !== 'mysql') expect(result).toMatchObject({ ok: false, code: 'timeout' })
  }, 15_000)

  it('discovers the schema with key metadata', async () => {
    const result = await createDatabaseQueryExecutor(engine.type).executeReadOnlyQuery({ ...reader, sql: SCHEMA_SQL[engine.type], maxRows: 100 })

    expect(result).toMatchObject({ ok: true })

    const rows = result.ok ? result.rows : []

    expect(rows.find((row) => row.table_name === 'orders' && row.column_name === 'id')?.constraints).toMatch(/PRIMARY KEY/)
    expect(rows.find((row) => row.column_name === 'order_id')?.constraints).toMatch(/orders/i)
  })
})

const planNodes = (node: QueryPlanNode): QueryPlanNode[] => [node, ...node.children.flatMap(planNodes)]

describe.runIf(process.env.RUN_DB_INTEGRATION === '1').each(engines)('$name query plans', (engine) => {
  const reader = input(engine, 'reader')
  const explain = (sql: string, analyze: boolean) =>
    createDatabaseQueryExecutor(engine.type).explainQuery({ ...reader, sql, analyze, timeoutMs: 5000 })
  const query = 'select o.label, count(c.id) as children from orders o left join orders_child c on c.order_id = o.id group by o.label order by o.label'

  beforeAll(() => {
    seed(engine)

    // SHOWPLAN is the one permission a SQL Server login needs to show plans.
    if (engine.type === 'mssql') mssqlSetup('use autodash_test\nrevoke showplan to reader\ngo\n')
  }, 60_000)

  if (engine.type === 'mssql') {
    it('says which permission is missing, then works once it is granted', async () => {
      await expect(explain(query, false)).resolves.toMatchObject({ ok: false, code: 'permission_denied', details: expect.stringContaining('GRANT SHOWPLAN') })

      mssqlSetup('use autodash_test\ngrant showplan to reader\ngo\n')

      await expect(explain(query, false)).resolves.toMatchObject({ ok: true })
    })
  }

  it('estimates a plan without running the query', async () => {
    if (engine.type === 'mssql') mssqlSetup('use autodash_test\ngrant showplan to reader\ngo\n')

    const result = await explain(query, false)

    expect(result).toMatchObject({ ok: true, plan: { analyzed: false } })

    const nodes = result.ok ? planNodes(result.plan.root) : []

    // MySQL and MariaDB name a table by its alias in the query.
    expect(nodes.some(node => /^(orders|o)\b/.test(node.object ?? ''))).toBe(true)
    expect(nodes.every(node => node.actualRows === undefined)).toBe(true)
    expect(result.ok && result.plan.raw.length).toBeGreaterThan(0)
  })

  it('measures real rows when asked to run the query', async () => {
    const result = await explain(query, true)

    expect(result).toMatchObject({ ok: true, plan: { analyzed: true } })
    expect(result.ok && planNodes(result.plan.root).some(node => node.actualRows !== undefined)).toBe(true)
  })

  it('keeps every read-only rule when explaining', async () => {
    for (const sql of engine.writeAttempts) {
      await expect(explain(sql, true)).resolves.toMatchObject({ ok: false })
    }

    const password = engine.privileged === 'filer' ? READER_PASSWORD : ADMIN_PASSWORD

    await expect(createDatabaseQueryExecutor(engine.type).explainQuery({ ...input(engine, engine.privileged, password), sql: query, analyze: true }))
      .resolves.toMatchObject({ code: 'query_rejected' })

    const count = await createDatabaseQueryExecutor(engine.type).executeReadOnlyQuery({ ...reader, sql: 'select count(*) as total from orders' })

    expect(count.ok && Number(count.rows[0]?.total)).toBe(5)
  })
})

describe.runIf(process.env.RUN_DB_INTEGRATION === '1')('SQL Server object-level writes', () => {
  it('refuses a login holding INSERT on one table', async () => {
    const engine = engines.find((candidate) => candidate.name === 'mssql') as Engine

    await expect(createDatabaseConnectionTester('mssql').testConnection(input(engine, 'writer')))
      .resolves.toMatchObject({ code: 'privileged_role' })
  })
})

describe.runIf(process.env.RUN_DB_INTEGRATION === '1')('certificate verification', () => {
  it('rejects the self-signed SQL Server certificate when SSL is required', async () => {
    const engine = engines.find((candidate) => candidate.name === 'mssql') as Engine

    await expect(createDatabaseConnectionTester('mssql').testConnection({ ...input(engine, 'reader'), sslMode: 'require' }))
      .resolves.toMatchObject({ ok: false, code: 'ssl_required' })
  })

  it('rejects the self-signed MySQL certificate when SSL is required', async () => {
    const engine = engines.find((candidate) => candidate.name === 'mysql') as Engine

    await expect(createDatabaseConnectionTester('mysql').testConnection({ ...input(engine, 'reader'), sslMode: 'require' }))
      .resolves.toMatchObject({ ok: false, code: 'ssl_required' })
  })
})
