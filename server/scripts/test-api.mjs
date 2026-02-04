/**
 * Quick API smoke test. Run with: node scripts/test-api.mjs [baseUrl]
 * Default baseUrl: http://localhost:3001/api
 */
const BASE = process.argv[2] || 'http://localhost:3001/api'

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    return true
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`)
    return false
  }
}

async function main() {
  console.log('Testing API at', BASE, '\n')

  let passed = 0
  let failed = 0

  await test('GET /health returns 200', async () => {
    const r = await fetch(`${BASE}/health`)
    if (!r.ok) throw new Error(`status ${r.status}`)
    const data = await r.json()
    if (data.status !== 'ok') throw new Error('status not ok')
  }) ? passed++ : failed++

  await test('GET /storage without auth returns 401', async () => {
    const r = await fetch(`${BASE}/storage`)
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`)
  }) ? passed++ : failed++

  await test('GET /files without auth returns 401', async () => {
    const r = await fetch(`${BASE}/files`)
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`)
  }) ? passed++ : failed++

  await test('PUT /storage without auth returns 401', async () => {
    const r = await fetch(`${BASE}/storage`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`)
  }) ? passed++ : failed++

  console.log('\n' + passed + ' passed, ' + failed + ' failed')
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
