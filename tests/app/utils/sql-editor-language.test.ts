import { CompletionContext, type Completion, type CompletionSource } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'

import { parseCompletionSchema, sqlLanguageFor } from '../../../app/utils/sql-editor-language'

const complete = async (databaseType: string, schema: string, doc: string) => {
  const state = EditorState.create({ doc, extensions: [sqlLanguageFor(databaseType, schema)] })
  const context = new CompletionContext(state, doc.length, true)
  const results = await Promise.all(state.languageDataAt<CompletionSource>('autocomplete', doc.length).map(source => source(context)))

  return results.flatMap(result => result?.options ?? []) as Completion[]
}
const labels = async (databaseType: string, schema: string, doc: string) => (await complete(databaseType, schema, doc)).map(option => option.label)
const inserted = (option?: Completion) => String(option?.apply ?? option?.label)

describe('schema parsing', () => {
  it.each([
    ['postgres', '"public"."orders"."id" int4 NOT NULL [PRIMARY KEY (id)]\n"public"."orders"."total" numeric'],
    ['mysql', '`shop`.`orders`.`id` int NOT NULL\n`shop`.`orders`.`total` decimal'],
    ['mssql', '[dbo].[orders].[id] int NOT NULL\n[dbo].[orders].[total] decimal']
  ])('reads %s lines', (_type, schema) => {
    const [tables] = Object.values(parseCompletionSchema(schema))

    expect(tables?.orders).toEqual(['id', 'total'])
  })

  it('handles quotes inside names and ignores unrelated lines', () => {
    const namespace = parseCompletionSchema('[dbo].[a]]b].[c] int\nnot a schema line')

    expect(namespace.dbo?.['a]b']).toEqual(['c'])
  })
})

describe('completion by database', () => {
  const postgres = '"public"."order items"."id" int4\n"public"."users"."email" text'
  const mysql = '`shop`.`order items`.`id` int\n`shop`.`users`.`email` text'
  const mssql = '[dbo].[order items].[id] int\n[dbo].[users].[email] nvarchar'

  it('offers columns of the table in the query', async () => {
    expect(await labels('postgres', postgres, 'SELECT users.')).toContain('email')
  })

  it.each([
    ['postgres', postgres, '"order items"'],
    ['mysql', mysql, '`order items`'],
    ['mssql', mssql, '"order items"']
  ])('quotes names the way %s expects', async (databaseType, schema, expected) => {
    const options = await complete(databaseType, schema, 'SELECT * FROM ord')

    expect(inserted(options.find(option => option.label.includes('order items')))).toBe(expected)
  })

  it('offers keywords from the selected dialect', async () => {
    expect(await labels('mssql', mssql, 'SELECT TO')).toContain('TOP')
    expect(await labels('postgres', postgres, 'SELECT TO')).not.toContain('TOP')
    expect(await labels('mysql', mysql, 'SELECT STRAIGHT')).toContain('STRAIGHT_JOIN')
  })
})
