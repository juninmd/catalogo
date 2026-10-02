import { readFile } from 'node:fs/promises'
import { categories } from './catalog.mjs'
import { redact } from './github.mjs'
const publicNotes = JSON.parse(await readFile(new URL('../catalog/curation.public.json', import.meta.url), 'utf8'))
export function curated(repo, personalNotes = {}) {
  const personal = personalNotes[repo.name]
  const published = publicNotes[repo.name]
  if (!personal && !published) return repo
  const note = { ...published, ...personal }
  const chosen = (note.categories || []).filter(c => categories.some(option => option.name === c))
  return { ...repo, purpose: redact(note.purpose), categories: chosen,
    classificationConfidence: ['high', 'medium', 'low'].includes(note.confidence) ? note.confidence : 'high',
    purposeSource: redact(personal ? personal.source || 'Anotação pessoal' : published.source) + (note.confidence === 'low' ? ' · Classificação sugerida; evidência limitada' : ''), projectType: note.projectType || repo.projectType,
    suggestedTopics: [...new Set([...repo.suggestedTopics, ...categories.filter(c => chosen.includes(c.name)).map(c => c.topic)])] }
}
