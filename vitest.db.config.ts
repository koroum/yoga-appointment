import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

config({ path: '.env.local' })

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
