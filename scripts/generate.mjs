import { mkdir, writeFile, rm } from 'node:fs/promises'
import { inventory, readme } from './github.mjs'
import { enrich } from './catalog.mjs'
import { curated } from './curation.mjs'
const repos = await inventory()
console.log(`Coletando documentação de ${repos.length} repositórios públicos.`)
let next = 0
const result = new Array(repos.length)
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < repos.length) { const index = next++; result[index] = curated(enrich(repos[index], await readme(repos[index]))) }
}))
const failed = result.filter(r => r.readme.status === 'error')
if (failed.length) throw new Error(`${failed.length} READMEs não puderam ser coletados. O catálogo anterior foi preservado.`)
await mkdir('docs/public', { recursive: true })
await rm('docs/public/repos.json', { force: true })
await writeFile('docs/public/catalog.json', JSON.stringify({ generated_at: new Date().toISOString(), scope: 'public', repos: result }))
console.log('Catálogo público atualizado. Nenhum repositório privado foi exportado.')
