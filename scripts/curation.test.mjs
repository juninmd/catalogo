import test from 'node:test'
import assert from 'node:assert/strict'
import { curated } from './curation.mjs'
import { enrich } from './catalog.mjs'
const repo = enrich({ name: 'contador-javascript', description: '', topics: [], language: 'JavaScript' })
test('reviewed public purpose records evidence and content type', () => {
  const result = curated(repo)
  assert.equal(result.projectType, 'example')
  assert.match(result.purpose, /incrementar e decrementar/)
  assert.match(result.purposeSource, /scripts.js/)
})
test('personal edits override public purpose while preserving content type', () => {
  const result = curated(repo, { 'contador-javascript': { purpose: 'Minha ficha', categories: ['Documentação e estudos'] } })
  assert.equal(result.purpose, 'Minha ficha')
  assert.equal(result.purposeSource, 'Anotação pessoal')
  assert.equal(result.projectType, 'example')
  assert.ok(result.suggestedTopics.includes('documentation'))
})
test('curation does not copy private visibility or unrelated annotation fields', () => {
  const result = curated({ ...repo, private: false }, { 'contador-javascript': { purpose: 'Ficha', categories: [], private: true, token: 'secret' } })
  assert.equal(result.private, false)
  assert.equal(result.token, undefined)
})
