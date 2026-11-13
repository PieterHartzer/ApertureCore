import { describe, expect, it } from 'vitest'

import { parseConnectionString } from '../../../app/utils/connection-string'

describe('parseConnectionString', () => {
  it('reads a Neon PostgreSQL string', () => {
    expect(parseConnectionString('postgresql://demo_reader:S%40fe-Pass!@ep-cool-1-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')).toEqual({
      ok: true,
      value: { databaseType: 'postgres', host: 'ep-cool-1-pooler.eu-central-1.aws.neon.tech', port: 5432, databaseName: 'neondb', username: 'demo_reader', password: 'S@fe-Pass!', sslMode: 'require' }
    })
  })

  it('reads MySQL and MariaDB strings with their own SSL wording', () => {
    expect(parseConnectionString('mysql://app:pw@db.example.com:3307/shop?ssl-mode=REQUIRED')).toEqual({
      ok: true,
      value: { databaseType: 'mysql', host: 'db.example.com', port: 3307, databaseName: 'shop', username: 'app', password: 'pw', sslMode: 'require' }
    })
    expect(parseConnectionString('mariadb://app@db.local/shop')).toMatchObject({ ok: true, value: { databaseType: 'mysql', port: 3306, username: 'app' } })
  })

  it('reads SQL Server in ADO.NET and JDBC forms', () => {
    expect(parseConnectionString('Server=tcp:acme.database.windows.net,1433;Initial Catalog=sales;User ID=reader;Password=p;Encrypt=True;')).toEqual({
      ok: true,
      value: { databaseType: 'mssql', host: 'acme.database.windows.net', port: 1433, databaseName: 'sales', username: 'reader', password: 'p', sslMode: 'require' }
    })
    expect(parseConnectionString('jdbc:sqlserver://sql.local:1444;databaseName=ops;user=r;password=x;encrypt=false')).toEqual({
      ok: true,
      value: { databaseType: 'mssql', host: 'sql.local', port: 1444, databaseName: 'ops', username: 'r', password: 'x', sslMode: 'disable' }
    })
  })

  it('leaves out what the string does not say', () => {
    expect(parseConnectionString('postgres://db.internal/app')).toEqual({ ok: true, value: { databaseType: 'postgres', host: 'db.internal', port: 5432, databaseName: 'app' } })
  })

  it('refuses text that is not a connection string', () => {
    for (const input of ['', 'hello there', 'redis://cache:6379', 'postgres://', 'Database=x;User=y']) {
      expect(parseConnectionString(input)).toEqual({ ok: false })
    }
  })
})
