export const up = async (db) => {
  await db.schema.createTable('app_ai_settings')
    .addColumn('organization_id', 'text', c => c.notNull())
    .addColumn('user_id', 'text', c => c.notNull())
    .addColumn('settings', 'jsonb', c => c.notNull())
    .addColumn('encrypted_credentials', 'text', c => c.notNull())
    .addPrimaryKeyConstraint('app_ai_settings_owner', ['organization_id', 'user_id'])
    .execute()
}
export const down = async (db) => { await db.schema.dropTable('app_ai_settings').execute() }
