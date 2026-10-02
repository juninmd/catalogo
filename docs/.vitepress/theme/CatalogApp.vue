<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { withBase } from 'vitepress'
import MarkdownIt from 'markdown-it'
import { categories as categoryDefinitions, projectTypes } from '../../../scripts/catalog.mjs'

const repos = ref([]), loading = ref(true), error = ref(''), scope = ref('public'), generated = ref('')
const search = ref(''), category = ref(''), visibility = ref(''), language = ref(''), topic = ref(''), kind = ref(''), sort = ref('updated')
const purposeFilter = ref('')
const contentType = ref('')
const view = ref('grid'), page = ref(1), cursor = ref(0), selected = ref(null), detail = ref(null), readmeLoading = ref(false)
const dialog = ref(null), installEvent = ref(null), installHint = ref(''), online = ref(true)
const editing = ref(false), editPurpose = ref(''), editCategories = ref([]), saving = ref(false), editError = ref('')
const categoryChoices = categoryDefinitions.map(c => c.name)
let returnFocus, requestId = 0
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false })
markdown.renderer.rules.image = (tokens, index) => '<span class="image-note">[Imagem: ' + markdown.utils.escapeHtml(tokens[index].content) + ']</span>'
const originalLink = markdown.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))
markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx], href = token.attrGet('href') || ''
  try {
    const r = selected.value
    const base = r ? `https://github.com/${r.owner}/${r.name}/blob/${r.branch || 'main'}/${detail.value?.path || 'README.md'}` : 'https://github.com/'
    const url = new URL(href, base)
    if (!['https:', 'http:'].includes(url.protocol)) token.attrSet('href', '#')
    else token.attrSet('href', url.href)
  } catch { token.attrSet('href', '#') }
  token.attrSet('target', '_blank'); token.attrSet('rel', 'noopener noreferrer')
  return originalLink(tokens, idx, options, env, self)
}
const rendered = computed(() => markdown.render(detail.value?.text || ''))
const options = computed(() => ({
  categories: [...new Set(repos.value.flatMap(r => r.categories))].sort(),
  languages: [...new Set(repos.value.map(r => r.language).filter(Boolean))].sort(),
  topics: [...new Set(repos.value.flatMap(r => r.topics))].sort(),
}))
const stats = computed(() => ({
  private: repos.value.filter(r => r.private).length,
  missing: repos.value.filter(r => !r.topics.length).length,
  pending: repos.value.filter(r => r.purposeSource === 'Pendente').length,
}))
const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('pt-BR')
  return repos.value.filter(r => (!q || [r.name, r.purpose, r.language, ...r.topics, ...r.categories].join(' ').toLocaleLowerCase('pt-BR').includes(q))
    && (!category.value || (category.value === 'uncategorized' ? !r.categories.length : r.categories.includes(category.value)))
    && (!visibility.value || r.private === (visibility.value === 'private'))
    && (!language.value || r.language === language.value)
    && (!topic.value || (topic.value === 'missing' ? !r.topics.length : r.topics.includes(topic.value)))
    && (!purposeFilter.value || r.purposeSource === 'Pendente')
    && (!contentType.value || r.projectType === contentType.value)
    && (!kind.value || (kind.value === 'fork' ? r.fork : kind.value === 'archived' ? r.archived : !r.fork && !r.archived)))
    .sort((a, b) => sort.value === 'name' ? a.name.localeCompare(b.name) : sort.value === 'stars' ? b.stars - a.stars : (b.pushed_at || '').localeCompare(a.pushed_at || ''))
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 24)))
const visible = computed(() => filtered.value.slice((page.value - 1) * 24, page.value * 24))
const featured = computed(() => filtered.value[cursor.value])
watch([search, category, visibility, language, topic, kind, sort, purposeFilter, contentType], () => { page.value = 1; cursor.value = 0 })
function reset() { search.value = ''; category.value = ''; visibility.value = ''; language.value = ''; topic.value = ''; kind.value = ''; purposeFilter.value = ''; contentType.value = '' }
async function load() {
  loading.value = true; error.value = ''
  try {
    let response
    if (navigator.onLine && ['127.0.0.1', 'localhost'].includes(location.hostname)) {
      response = await fetch(withBase('/api/catalog'), { cache: 'no-store' })
      if (!(response.headers.get('content-type') || '').includes('application/json')) response = null
      if (response && !response.ok && response.status !== 404) throw new Error('O inventário local não pôde ser carregado. Verifique a autenticação do GitHub e tente novamente.')
    }
    if (!response?.ok) response = await fetch(withBase('/catalog.json'))
    if (!response.ok) throw new Error('Não foi possível carregar a biblioteca. Tente novamente quando estiver conectado.')
    const data = await response.json()
    if (!Array.isArray(data.repos)) throw new Error('Catálogo inválido.')
    repos.value = data.repos; scope.value = data.scope; generated.value = data.generated_at
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
async function open(repo) {
  editing.value = false; editError.value = ''
  returnFocus = document.activeElement; selected.value = repo; detail.value = repo.readme
  await nextTick(); dialog.value.showModal()
  if (repo.readme.status !== 'unloaded' && (repo.readme.status !== 'error' || scope.value !== 'private')) return
  const id = ++requestId; readmeLoading.value = true
  try {
    const response = await fetch(withBase('/api/readme?repo=' + encodeURIComponent(repo.name)), { cache: 'no-store' })
    if (!response.ok) throw new Error('Falha ao consultar README.')
    const data = await response.json()
    if (id === requestId) detail.value = data
  } catch (e) { if (id === requestId) detail.value = { status: 'error', message: e.message } }
  finally { if (id === requestId) readmeLoading.value = false }
}
function close() { ++requestId; readmeLoading.value = false; dialog.value.close(); selected.value = null; detail.value = null; returnFocus?.focus() }
function edit() { editPurpose.value = selected.value.purpose; editCategories.value = [...selected.value.categories]; editing.value = true }
async function save() {
  saving.value = true; editError.value = ''
  try {
    const response = await fetch(withBase('/api/annotations'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: selected.value.name, purpose: editPurpose.value, categories: editCategories.value }) })
    if (!response.ok) throw new Error('Não foi possível salvar a ficha. Verifique a conexão com o servidor local.')
    const repo = await response.json()
    repos.value = repos.value.map(r => r.name === repo.name ? repo : r); selected.value = repo; editing.value = false; page.value = 1
  } catch (e) { editError.value = e.message }
  finally { saving.value = false }
}
function step(n) { cursor.value = Math.max(0, Math.min(filtered.value.length - 1, cursor.value + n)) }
function date(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR') : 'Sem atividade' }
function installPrompt(e) { e.preventDefault(); installEvent.value = e }
async function install() {
  if (installEvent.value) { await installEvent.value.prompt(); await installEvent.value.userChoice; installEvent.value = null }
  else installHint.value = 'No menu do navegador, escolha “Instalar aplicativo” ou “Adicionar à tela de início”.'
}
function connection() { online.value = navigator.onLine }
function shortcut(event) {
  if (event.key === '/' && !selected.value && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    event.preventDefault(); document.querySelector('.search-box input')?.focus()
  }
}
onMounted(() => {
  connection(); load()
  window.addEventListener('beforeinstallprompt', installPrompt)
  window.addEventListener('online', connection); window.addEventListener('offline', connection)
  window.addEventListener('keydown', shortcut)
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(withBase('/sw.js')).catch(() => {})
})
onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', installPrompt)
  window.removeEventListener('online', connection); window.removeEventListener('offline', connection)
  window.removeEventListener('keydown', shortcut)
})
</script>

<template>
  <main class="atlas">
    <header class="library-header"><a :href="withBase('/')" class="wordmark"><span class="brand-mark">A</span> atlas<span class="wordmark-sub">/ biblioteca pessoal</span></a><button class="quiet" @click="install">Instalar app ↗</button></header>
    <section class="intro">
      <div><p class="eyebrow">SUAS IDEIAS, EM UM SÓ LUGAR</p><h1>Conheça tudo<br>que você <span>construiu.</span></h1><p class="lede">Uma biblioteca viva de aplicações, ferramentas e experimentos.<br>Encontre a próxima ideia entre as que já são suas.</p></div>
      <aside class="collection-summary"><span class="summary-label">NA SUA ESTANTE</span><strong>{{ loading ? '…' : repos.length }}</strong><span>repositórios catalogados</span><div>{{ scope === 'private' ? stats.private + ' privados · acesso local' : 'Coleção pública' }}</div></aside>
    </section>
    <div class="library-status"><span><i :class="{ offline: !online }"></i>{{ online ? 'Biblioteca conectada' : 'Você está offline' }} · {{ scope === 'private' ? 'Inventário completo nesta máquina' : 'Somente repositórios públicos' }}</span><span v-if="generated">Atualizado em {{ date(generated) }}</span></div>
    <p v-if="installHint" class="notice" role="status">{{ installHint }}</p>
    <section class="workspace">
      <aside class="shelves"><h2>Explorar por finalidade</h2><button :class="{ chosen: !category }" @click="category = ''">Toda a biblioteca <span>{{ repos.length }}</span></button><button v-for="c in options.categories" :key="c" :class="{ chosen: category === c }" @click="category = c">{{ c }}<span>{{ repos.filter(r => r.categories.includes(c)).length }}</span></button><button :class="{ chosen: category === 'uncategorized' }" @click="category = 'uncategorized'">A categorizar<span>{{ repos.filter(r => !r.categories.length).length }}</span></button><div class="curation"><span>UM POUCO DE ORGANIZAÇÃO</span><h3>Sua coleção merece contexto.</h3><p>{{ stats.missing }} sem topics.<br>{{ stats.pending }} com finalidade pendente.</p><button @click="topic = 'missing'; category = ''">Ver sem topics →</button><button @click="reset(); purposeFilter = 'pending'">Ver finalidades pendentes →</button><small>Categorias são sugestões baseadas nos metadados e no README.</small></div></aside>
      <section class="collection" aria-label="Coleção de repositórios">
        <div class="collection-top"><div><p class="eyebrow">EXPLORE SUA COLEÇÃO</p><h2>{{ category && category !== 'uncategorized' ? category : 'Toda a biblioteca' }}</h2></div><div class="view-switch" aria-label="Modo de visualização"><button :aria-pressed="view === 'grid'" @click="view = 'grid'">Grade</button><button :aria-pressed="view === 'carousel'" @click="view = 'carousel'">Carrossel</button></div></div>
        <label class="search-box"><span aria-hidden="true">⌕</span><input v-model="search" aria-label="Buscar aplicações" placeholder="Busque uma ideia, ferramenta, linguagem ou topic…"><kbd>/ explorar</kbd></label>
        <div class="filter-bar"><label>Visibilidade<select v-model="visibility"><option value="">Todas</option><option value="public">Públicos</option><option value="private">Privados</option></select></label><label>Linguagem<select v-model="language"><option value="">Todas</option><option v-for="l in options.languages" :key="l">{{ l }}</option></select></label><label>Topic<select v-model="topic"><option value="">Todos</option><option value="missing">Sem topics</option><option v-for="t in options.topics" :key="t">{{ t }}</option></select></label><label>Tipo<select v-model="kind"><option value="">Todos</option><option value="original">Originais ativos</option><option value="fork">Forks</option><option value="archived">Arquivados</option></select></label><label>Conteúdo<select v-model="contentType"><option value="">Todos</option><option v-for="(label, value) in projectTypes" :key="value" :value="value">{{ label }}</option></select></label><label>Ordenar<select v-model="sort"><option value="updated">Último push</option><option value="name">Nome</option><option value="stars">Estrelas</option></select></label></div>
        <div v-if="loading" class="empty" role="status">Abrindo sua biblioteca…</div>
        <div v-else-if="error" class="empty" role="alert"><h3>A biblioteca não carregou.</h3><p>{{ error }}</p><button @click="load">Tentar novamente</button></div>
        <template v-else><div class="result-line"><span>{{ filtered.length }} repositórios encontrados</span><button @click="reset">Limpar filtros</button></div>
          <div v-if="!filtered.length" class="empty"><h3>Nenhuma aplicação por aqui.</h3><p>Experimente outro termo ou remova os filtros.</p><button @click="reset">Explorar tudo</button></div>
          <template v-else-if="view === 'grid'"><div class="repo-grid"><article v-for="r in visible" :key="r.name" class="repo-card"><div class="card-top"><span class="repo-monogram">{{ r.name.slice(0, 2).toUpperCase() }}</span><span class="visibility" :class="{ private: r.private }">{{ r.private ? '◈ Privado' : '◉ Público' }}</span></div><p class="card-category">{{ r.categories[0] || projectTypes[r.projectType] || 'A categorizar' }}</p><h3><button @click="open(r)">{{ r.name }}</button></h3><p class="purpose">{{ r.purpose }}</p><div class="topics"><span v-for="t in r.topics.slice(0, 3)" :key="t">{{ t }}</span><span v-if="!r.topics.length" class="pending">Sem topics</span><span v-if="r.topics.length > 3">+{{ r.topics.length - 3 }}</span></div><footer><span>{{ r.language || 'Sem linguagem' }} · {{ r.stars }} ★</span><button @click="open(r)">Explorar ↗<span class="sr-only"> {{ r.name }}</span></button></footer><div class="repo-flags" v-if="r.archived || r.fork">{{ r.archived ? 'Arquivado' : '' }} {{ r.fork ? 'Fork' : '' }}</div></article></div><nav v-if="pages > 1" class="pagination" aria-label="Paginação"><button :disabled="page === 1" @click="page--">← Anterior</button><span>{{ page }} / {{ pages }}</span><button :disabled="page === pages" @click="page++">Próxima →</button></nav></template>
          <section v-else class="carousel" tabindex="0" aria-label="Carrossel de repositórios. Use as setas para navegar." @keydown.left.prevent="step(-1)" @keydown.right.prevent="step(1)"><div class="carousel-art" aria-hidden="true"><span>{{ featured.name.slice(0, 2).toUpperCase() }}</span><div>IDEIAS QUE GANHARAM FORMA</div></div><div class="carousel-content"><div class="carousel-meta"><span>{{ featured.private ? '◈ Privado' : '◉ Público' }}</span><span>{{ cursor + 1 }} / {{ filtered.length }}</span></div><p class="eyebrow">{{ featured.categories.join(' · ') || 'A categorizar' }}</p><h3>{{ featured.name }}</h3><p>{{ featured.purpose }}</p><div class="topics"><span v-for="t in featured.topics" :key="t">{{ t }}</span></div><p class="muted">{{ featured.language || 'Sem linguagem' }} · {{ featured.stars }} estrelas · push {{ date(featured.pushed_at) }}</p><button class="primary" @click="open(featured)">Conhecer aplicação e README ↗</button><div class="carousel-controls"><button :disabled="cursor === 0" @click="step(-1)" aria-label="Repositório anterior">←</button><span>Navegue pela sua biblioteca</span><button :disabled="cursor === filtered.length - 1" @click="step(1)" aria-label="Próximo repositório">→</button></div></div></section>
        </template>
        <p v-if="scope === 'public'" class="local-note">Quer incluir aplicações privadas? Execute <code>pnpm local</code> nesta máquina. O acesso fica local e a credencial permanece no servidor.</p>
      </section>
    </section>
    <dialog ref="dialog" class="repo-dialog" @cancel.prevent="close" @click="($event.target === dialog) && close()"><template v-if="selected"><header><div><p class="eyebrow">{{ selected.private ? 'REPOSITÓRIO PRIVADO · ACESSO LOCAL' : 'REPOSITÓRIO PÚBLICO' }}</p><h2>{{ selected.name }}</h2></div><button @click="close" aria-label="Fechar detalhes">✕</button></header><div class="detail-body"><button v-if="scope === 'private' && !editing" class="edit-button" @click="edit">Editar ficha pessoal ↗</button><form v-if="editing" class="edit-form" @submit.prevent="save"><label>Para que serve esta aplicação?<textarea v-model="editPurpose" required maxlength="1200" rows="4"></textarea></label><fieldset><legend>Categorias</legend><label v-for="c in categoryChoices" :key="c"><input type="checkbox" v-model="editCategories" :value="c">{{ c }}</label></fieldset><p>Anotações ficam nesta máquina e não alteram a descrição no GitHub.</p><p v-if="editError" role="alert">{{ editError }}</p><button class="primary" :disabled="saving">{{ saving ? 'Salvando…' : 'Salvar ficha' }}</button><button type="button" @click="editing = false" :disabled="saving">Cancelar</button></form><p v-if="selected.projectType" class="content-status">{{ projectTypes[selected.projectType] }}</p><p class="detail-purpose">{{ selected.purpose }}</p><p class="muted">Fonte: {{ selected.purposeSource }} · {{ selected.language || 'Sem linguagem' }} · último push {{ date(selected.pushed_at) }}</p><div class="topics"><span v-for="t in selected.topics" :key="t">{{ t }}</span></div><div v-if="selected.suggestedTopics.some(t => !selected.topics.includes(t))" class="suggestions"><strong>Sugestões de topics</strong><p>{{ selected.suggestedTopics.filter(t => !selected.topics.includes(t)).join(' · ') }}</p><small>Revise a finalidade antes de aplicar. O comando de topics preserva as tags existentes.</small></div><a :href="selected.url" target="_blank" rel="noopener noreferrer" class="github-link">Abrir repositório no GitHub ↗</a><div class="readme-title"><h3>README</h3><span>{{ detail?.path || 'Documentação do projeto' }}</span></div><p v-if="readmeLoading" role="status">Carregando documentação…</p><div v-else-if="detail?.status === 'ok'" class="readme" v-html="rendered"></div><p v-else-if="detail?.status === 'missing'">Este repositório ainda não tem README.</p><div v-else role="alert"><p>{{ detail?.message || 'A documentação não está disponível.' }}</p><button @click="open(selected)">Tentar novamente</button></div></div></template></dialog>
  </main>
</template>
