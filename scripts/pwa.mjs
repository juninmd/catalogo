import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { credential } from './github.mjs'
const root = 'docs/.vitepress/dist'
const base = process.env.CATALOG_BASE || '/'
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('CATALOG_BASE inválido; use / ou /catalogo/.')
const catalog = JSON.parse(await readFile(root + '/catalog.json', 'utf8'))
if (catalog.scope !== 'public' || catalog.repos.some(r => r.private)) throw new Error('Publicação bloqueada: catálogo contém dados privados.')
const files = []
async function walk(path = '') {
  for (const entry of await readdir(root + '/' + path, { withFileTypes: true })) {
    const name = path + entry.name
    if (entry.isDirectory()) await walk(name + '/')
    else if (!name.endsWith('.map') && !['sw.js', 'manifest.webmanifest'].includes(name)) files.push(name)
  }
}
await walk()
if (files.includes('repos.json')) throw new Error('Publicação bloqueada: snapshot legado presente no build.')
const hash = createHash('sha256')
const token = credential()
for (const file of files.sort()) {
  const content = await readFile(root + '/' + file)
  if (token && content.includes(Buffer.from(token))) throw new Error('Publicação bloqueada: credencial detectada no build.')
  hash.update(content)
}
const manifest = { id: base, name: 'Atlas · Biblioteca de aplicações', short_name: 'Atlas', lang: 'pt-BR', start_url: base, scope: base,
  display: 'standalone', background_color: '#101a20', theme_color: '#111d23', icons: [
    { src: base + 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: base + 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ] }
await writeFile(root + '/manifest.webmanifest', JSON.stringify(manifest))
const urls = [base, base + 'manifest.webmanifest', ...files.map(f => base + f)]
await writeFile(root + '/sw.js', `const CACHE = 'atlas-public-${hash.digest('hex').slice(0, 16)}';
const URLS = ${JSON.stringify(urls)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('atlas-public-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? caches.match('${base}') : Response.error())));
});
`)
console.log('PWA gerada: shell e READMEs públicos offline; API privada nunca armazenada no cache.')
