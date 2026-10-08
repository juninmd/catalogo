// Servidor MCP (stdio, JSON-RPC 2.0) que expõe o catálogo público de repositórios.
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
const file = process.env.CATALOG_FILE || new URL('../docs/public/catalog.json', import.meta.url)
const slim = r => ({ name: r.name, url: r.html_url, purpose: r.purpose, language: r.language, categories: r.categories, topics: r.topics, projectType: r.projectType })
const text = value => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] })
async function load() {
  try { return JSON.parse(await readFile(file, 'utf8')) }
  catch { throw new Error('catalog.json não encontrado. Execute `pnpm generate` primeiro.') }
}
export const tools = {
  list_repos: {
    description: 'Lista repositórios do catálogo, com filtros opcionais por categoria e linguagem.',
    inputSchema: { type: 'object', properties: { category: { type: 'string' }, language: { type: 'string' }, limit: { type: 'number' } } },
    async run({ category, language, limit = 50 }) {
      const { repos } = await load()
      return repos.filter(r => (!category || r.categories?.includes(category)) && (!language || r.language?.toLowerCase() === language.toLowerCase())).slice(0, limit).map(slim)
    },
  },
  search_repos: {
    description: 'Busca textual em nome, finalidade, tópicos e categorias dos repositórios.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
    async run({ query, limit = 20 }) {
      const { repos } = await load()
      const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean)
      return repos.filter(r => { const hay = `${r.name} ${r.purpose} ${(r.topics || []).join(' ')} ${(r.categories || []).join(' ')}`.toLowerCase(); return terms.every(t => hay.includes(t)) }).slice(0, limit).map(slim)
    },
  },
  get_repo: {
    description: 'Retorna os detalhes de um repositório pelo nome.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    async run({ name }) {
      const { repos } = await load()
      const repo = repos.find(r => r.name.toLowerCase() === String(name).toLowerCase())
      if (!repo) throw new Error(`Repositório não encontrado: ${name}`)
      const { readme, ...rest } = repo
      return { ...rest, readme: { status: readme?.status, excerpt: (readme?.text || '').slice(0, 2000) } }
    },
  },
  list_categories: {
    description: 'Lista as categorias e a quantidade de repositórios em cada uma.',
    inputSchema: { type: 'object', properties: {} },
    async run() {
      const { repos } = await load()
      const counts = {}
      for (const r of repos) for (const c of r.categories || []) counts[c] = (counts[c] || 0) + 1
      return counts
    },
  },
}
export async function handle(msg) {
  const { id, method, params } = msg
  if (id === undefined) return null // notificação
  const ok = result => ({ jsonrpc: '2.0', id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
  switch (method) {
    case 'initialize': return ok({ protocolVersion: params?.protocolVersion || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'catalogo', version: '1.0.0' } })
    case 'ping': return ok({})
    case 'tools/list': return ok({ tools: Object.entries(tools).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) })
    case 'tools/call': {
      const tool = tools[params?.name]
      if (!tool) return fail(-32602, `Ferramenta desconhecida: ${params?.name}`)
      try { return ok(text(await tool.run(params.arguments || {}))) }
      catch (e) { return ok({ isError: true, content: [{ type: 'text', text: e.message }] }) }
    }
    default: return fail(-32601, `Método não suportado: ${method}`)
  }
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  for await (const line of createInterface({ input: process.stdin })) {
    if (!line.trim()) continue
    let msg
    try { msg = JSON.parse(line) } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } }) + '\n'); continue }
    const res = await handle(msg)
    if (res) process.stdout.write(JSON.stringify(res) + '\n')
  }
}
