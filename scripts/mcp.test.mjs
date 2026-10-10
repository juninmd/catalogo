import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const dir = await mkdtemp(join(tmpdir(), 'mcp-'))
process.env.CATALOG_FILE = join(dir, 'catalog.json')
await writeFile(process.env.CATALOG_FILE, JSON.stringify({ repos: [
  { name: 'alpha', url: 'u', purpose: 'Bot de automação', language: 'Python', categories: ['Automação e bots'], topics: [], readme: { status: 'ok', text: 'x' } },
  { name: 'beta', url: 'u2', purpose: 'Site', language: 'JavaScript', categories: ['Aplicações web'], topics: [], readme: { status: 'ok', text: 'y' } },
] }))
const { handle } = await import('./mcp.mjs')
const call = async (name, args) => JSON.parse((await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })).result.content[0].text)
test('lista ferramentas', async () => {
  const r = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  assert.equal(r.result.tools.length, 4)
})
test('busca e filtros', async () => {
  assert.deepEqual((await call('search_repos', { query: 'automação' })).map(r => r.name), ['alpha'])
  assert.deepEqual((await call('list_repos', { language: 'javascript' })).map(r => r.name), ['beta'])
  assert.equal((await call('get_repo', { name: 'ALPHA' })).readme.excerpt, 'x')
  assert.equal((await call('list_categories', {}))['Aplicações web'], 1)
})
test('erro para repo inexistente', async () => {
  const r = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_repo', arguments: { name: 'nope' } } })
  assert.equal(r.result.isError, true)
})
