import { access } from 'node:fs/promises'
try { await access('docs/public/catalog.json') }
catch { await import('./generate.mjs') }
