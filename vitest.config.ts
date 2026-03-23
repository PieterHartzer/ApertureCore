import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      all: true,
      include: [
        'app/composables/**/*.ts',
        'app/types/**/*.ts',
        'server/api/**/*.ts',
        'server/services/**/*.ts',
        'server/types/**/*.ts',
        'server/utils/**/*.ts',
        'server/validators/**/*.ts',
      ],
      exclude: [
        'tests/**',
        '.nuxt/**',
        '.output/**',
        'node_modules/**',
        '**/*.d.ts',
        'server/types/database-connections.ts',
        'server/types/saved-sql-queries.ts',
        'server/services/database/types.ts',
      ],
    },
  },
})
