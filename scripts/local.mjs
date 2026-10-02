import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { inventory, readme, redact } from './github.mjs'
import { enrich, categories } from './catalog.mjs'
import { curated } from './curation.mjs'
const port = Number(process.env.PORT || 4173)
const root = resolve('docs/.vitepress/dist')
let collection
let collectionPromise
let annotations = {}
let classified = {}
try {
  const saved = JSON.parse(await readFile('.catalog/categories.json', 'utf8'))
  classified = Object.fromEntries(saved.repos.map(repo => [repo.name, repo]))
} catch (e) { if (e.code !== 'ENOENT') throw e }
try { annotations = JSON.parse(await readFile('.catalog/annotations.json', 'utf8')) } catch (e) { if (e.code !== 'ENOENT') throw e }
function annotated(repo) {
  const baseline = classified[repo.name]
  const personal = annotations[repo.name]
  return curated(repo, baseline || personal ? { [repo.name]: { ...baseline, ...personal } } : {})
}
async function getCollection() {
  if (!collectionPromise) collectionPromise = inventory({ privateRepos: true }).then(async repos => {
    collection = repos
    const publicCatalog = JSON.parse(await readFile(root + '/catalog.json', 'utf8'))
    const documents = new Map(publicCatalog.repos.map(r => [r.name, r.readme]))
    let next = 0
    const enriched = new Array(repos.length)
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < repos.length) {
        const index = next++, repo = repos[index]
        enriched[index] = enrich(repo, !repo.private && documents.has(repo.name) ? documents.get(repo.name) : await readme(repo))
      }
    }))
    return { generated_at: new Date().toISOString(), scope: 'private', repos: enriched }
  }).catch(e => { collectionPromise = null; throw e })
  return collectionPromise
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'")
  if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) { res.writeHead(403); return res.end() }
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store')
      if ((req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) { res.writeHead(403); return res.end() }
      res.setHeader('Content-Type', 'application/json')
      if (req.method === 'POST' && url.pathname === '/api/annotations') {
        if (req.headers.origin !== `http://${req.headers.host}` || req.headers['content-type'] !== 'application/json') { res.writeHead(403); return res.end('{}') }
        let body = ''
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16000) { res.writeHead(413); return res.end('{}') } }
        const data = JSON.parse(body)
        const catalog = await getCollection()
        const repo = catalog.repos.find(r => r.name === data.name)
        if (repo && data.reset === true) {
          annotations = Object.fromEntries(Object.entries(annotations).filter(([name]) => name !== repo.name))
          await mkdir('.catalog', { recursive: true })
          await writeFile('.catalog/annotations.json', JSON.stringify(annotations, null, 2))
          return res.end(JSON.stringify(annotated(repo)))
        }
        if (!repo || typeof data.purpose !== 'string' || data.purpose.length > 1200 || !data.purpose.trim() || !Array.isArray(data.categories) || data.categories.length > 8 || data.categories.some(c => !categories.some(option => option.name === c))) { res.writeHead(400); return res.end('{}') }
        annotations = { ...annotations, [repo.name]: { purpose: redact(data.purpose.trim()), categories: [...new Set(data.categories)], projectType: annotated(repo).projectType } }
        await mkdir('.catalog', { recursive: true })
        await writeFile('.catalog/annotations.json', JSON.stringify(annotations, null, 2))
        return res.end(JSON.stringify(annotated(repo)))
      }
      if (req.method !== 'GET') { res.writeHead(405); return res.end('{}') }
      if (url.pathname === '/api/catalog') {
        const catalog = await getCollection()
        return res.end(JSON.stringify({ ...catalog, repos: catalog.repos.map(annotated) }))
      }
      if (url.pathname === '/api/readme') {
        await getCollection()
        const repo = collection.find(r => r.name === url.searchParams.get('repo'))
        if (!repo) { res.writeHead(404); return res.end('{}') }
        return res.end(JSON.stringify(await readme(repo)))
      }
      res.writeHead(404); return res.end('{}')
    }
    if (req.method !== 'GET') { res.writeHead(405); return res.end() }
    let path = resolve(root, '.' + decodeURIComponent(url.pathname))
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); return res.end() }
    if (!extname(path)) path = url.pathname.endsWith('/') ? resolve(path, 'index.html') : path + '.html'
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream')
    res.end(await readFile(path))
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' ? 404 : 503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: error.code === 'ENOENT' ? 'Não encontrado' : 'A consulta ao GitHub falhou. Verifique gh auth status e tente novamente.' }))
  }
})
server.listen(port, '127.0.0.1', () => console.log(`Biblioteca privada: http://127.0.0.1:${port} · credencial apenas no processo Node.`))
