#!/usr/bin/env node
/**
 * Switch env for local or production.
 * Usage: node scripts/use-env.js local | production
 *
 * Creates .env.local from .env.local.example (for local) or
 * shows instructions for production.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.join(__dirname, '..')

const mode = process.argv[2]?.toLowerCase()

if (mode === 'local') {
  const src = path.join(serverDir, '.env.local.example')
  const dest = path.join(serverDir, '.env.local')
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    console.log('✓ Created .env.local from .env.local.example')
    console.log('  Edit .env.local with your actual GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
    console.log('  Server will auto-load .env.local when NODE_ENV !== production')
  } else {
    console.error('✗ .env.local.example not found')
    process.exit(1)
  }
} else if (mode === 'production') {
  console.log('For production (Railway):')
  console.log('  1. Go to Railway dashboard → your project → Variables')
  console.log('  2. Set the values from .env.production.example')
  console.log('  3. Ensure BACKEND_PUBLIC_URL = your Railway URL')
  console.log('  4. Ensure FRONTEND_URL = your Vercel URL')
  console.log('')
  console.log('  .env.local is NOT used in production - Railway env vars override everything.')
} else {
  console.log('Usage: node scripts/use-env.js <local|production>')
  console.log('')
  console.log('  local      - Create .env.local from template (for local dev)')
  console.log('  production - Show production setup instructions')
  process.exit(1)
}
