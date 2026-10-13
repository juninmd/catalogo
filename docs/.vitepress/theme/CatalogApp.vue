<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { withBase, useRoute } from 'vitepress'
import MarkdownIt from 'markdown-it'
import { categories as categoryDefinitions, projectTypes } from '../../../scripts/catalog.mjs'

const props = defineProps({
  initialView: { type: String, default: 'grid' }
})

const route = useRoute()
const isCarouselRoute = computed(() => {
  if (props.initialView === 'carousel') return true
  if (typeof window !== 'undefined' && (window.location.pathname.includes('carrossel') || window.location.search.includes('view=carousel'))) return true
  return Boolean(route?.path && route.path.includes('carrossel'))
})

const repos = ref([]), loading = ref(true), error = ref(''), scope = ref('public'), generated = ref('')
const search = ref(''), category = ref(''), visibility = ref(''), language = ref(''), topic = ref(''), kind = ref(''), sort = ref('updated')
const purposeFilter = ref('')
const contentType = ref('')
const view = ref(props.initialView === 'carousel' ? 'carousel' : 'grid'), page = ref(1), cursor = ref(0), selected = ref(null), detail = ref(null), readmeLoading = ref(false)
const carouselReadmeDetail = ref(null), carouselReadmeLoading = ref(false)
const deleteDialog = ref(null), repoToDelete = ref(null), deletedFeedback = ref('')
const deletedHistory = []
let feedbackTimer = null, carouselRequestId = 0
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
    const r = selected.value || featured.value
    const base = r ? `https://github.com/${r.owner}/${r.name}/blob/${r.branch || 'main'}/${detail.value?.path || carouselReadmeDetail.value?.path || 'README.md'}` : 'https://github.com/'
    const url = new URL(href, base)
    if (!['https:', 'http:'].includes(url.protocol)) token.attrSet('href', '#')
    else token.attrSet('href', url.href)
  } catch { token.attrSet('href', '#') }
  token.attrSet('target', '_blank'); token.attrSet('rel', 'noopener noreferrer')
  return originalLink(tokens, idx, options, env, self)
}
const rendered = computed(() => markdown.render(detail.value?.text || ''))
const renderedCarousel = computed(() => {
  const current = featured.value
  if (!current) return ''
  const text = carouselReadmeDetail.value?.text || current.readme?.text || ''
  return text ? markdown.render(text) : ''
})
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
watch(featured, async (current) => {
  if (!current) {
    carouselReadmeDetail.value = null
    return
  }
  const id = ++carouselRequestId
  carouselReadmeDetail.value = current.readme || null
  if (current.readme?.status === 'unloaded' || (current.readme?.status === 'error' && scope.value === 'private')) {
    carouselReadmeLoading.value = true
    try {
      const response = await fetch(withBase('/api/readme?repo=' + encodeURIComponent(current.name)), { cache: 'no-store' })
      if (!response.ok) throw new Error('Falha ao consultar README.')
      const data = await response.json()
      if (id === carouselRequestId) carouselReadmeDetail.value = data
    } catch (e) {
      if (id === carouselRequestId) carouselReadmeDetail.value = { status: 'error', message: e.message }
    } finally {
      if (id === carouselRequestId) carouselReadmeLoading.value = false
    }
  }
}, { immediate: true })

function requestDelete(repo) {
  repoToDelete.value = repo || featured.value
  deleteDialog.value?.showModal()
}

function cancelDelete() {
  deleteDialog.value?.close()
  repoToDelete.value = null
}

function confirmDelete() {
  if (!repoToDelete.value) return
  const target = repoToDelete.value
  deletedHistory.push(target)
  repos.value = repos.value.filter(r => r.name !== target.name)
  deleteDialog.value?.close()
  repoToDelete.value = null

  if (cursor.value >= filtered.value.length) {
    cursor.value = Math.max(0, filtered.value.length - 1)
  }

  deletedFeedback.value = `Repositório "${target.name}" excluído com sucesso.`
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    deletedFeedback.value = ''
  }, 6000)
}

function undoDelete() {
  const restored = deletedHistory.pop()
  if (restored) {
    repos.value = [restored, ...repos.value]
    deletedFeedback.value = `Repositório "${restored.name}" restaurado com sucesso.`
    clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => {
      deletedFeedback.value = ''
    }, 4000)
  }
}

function date(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR') : 'Sem atividade' }
function installPrompt(e) { e.preventDefault(); installEvent.value = e }
async function install() {
  if (installEvent.value) { await installEvent.value.prompt(); await installEvent.value.userChoice; installEvent.value = null }
  else installHint.value = 'No menu do navegador, escolha “Instalar aplicativo” ou “Adicionar à tela de início”.'
}
function connection() { online.value = navigator.onLine }
function shortcut(event) {
  const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
  if (event.key === '/' && !selected.value && !repoToDelete.value && !isInputActive) {
    event.preventDefault()
    document.querySelector('.search-box input')?.focus()
  } else if (view.value === 'carousel' && !selected.value && !repoToDelete.value && !isInputActive) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    }
  }
}
watch(() => route?.path, (p) => {
  if (p && p.includes('carrossel')) view.value = 'carousel'
}, { immediate: true })

onMounted(() => {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      for (const reg of regs) reg.unregister()
    }).catch(() => {})
    if ('caches' in window) {
      caches.keys().then(keys => {
        for (const k of keys) caches.delete(k)
      }).catch(() => {})
    }
  }
  if (isCarouselRoute.value) view.value = 'carousel'
  connection(); load()
  window.addEventListener('beforeinstallprompt', installPrompt)
  window.addEventListener('online', connection); window.addEventListener('offline', connection)
  window.addEventListener('keydown', shortcut)
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
    <section class="intro" v-if="view === 'grid'">
      <div><p class="eyebrow">SUAS IDEIAS, EM UM SÓ LUGAR</p><h1>Conheça tudo<br>que você <span>construiu.</span></h1><p class="lede">Uma biblioteca viva de aplicações, ferramentas e experimentos.<br>Encontre a próxima ideia entre as que já são suas.</p></div>
      <aside class="collection-summary"><span class="summary-label">NA SUA ESTANTE</span><strong>{{ loading ? '…' : repos.length }}</strong><span>repositórios catalogados</span><div>{{ scope === 'private' ? stats.private + ' privados · acesso local' : 'Coleção pública' }}</div></aside>
    </section>
    <div class="library-status" v-if="view === 'grid'"><span><i :class="{ offline: !online }"></i>{{ online ? 'Biblioteca conectada' : 'Você está offline' }} · {{ scope === 'private' ? 'Inventário completo nesta máquina' : 'Somente repositórios públicos' }}</span><span v-if="generated">Atualizado em {{ date(generated) }}</span></div>
    <p v-if="installHint" class="notice" role="status">{{ installHint }}</p>
    <section class="workspace" :class="{ 'carousel-full': view === 'carousel' }">
      <aside class="shelves"><h2>Explorar por finalidade</h2><button :class="{ chosen: !category }" @click="category = ''">Toda a biblioteca <span>{{ repos.length }}</span></button><button v-for="c in options.categories" :key="c" :class="{ chosen: category === c }" @click="category = c">{{ c }}<span>{{ repos.filter(r => r.categories.includes(c)).length }}</span></button><button :class="{ chosen: category === 'uncategorized' }" @click="category = 'uncategorized'">A categorizar<span>{{ repos.filter(r => !r.categories.length).length }}</span></button><div class="curation"><span>UM POUCO DE ORGANIZAÇÃO</span><h3>Sua coleção merece contexto.</h3><p>{{ stats.missing }} sem topics.<br>{{ stats.pending }} com finalidade pendente.</p><button @click="topic = 'missing'; category = ''">Ver sem topics →</button><button @click="reset(); purposeFilter = 'pending'">Ver finalidades pendentes →</button><small>Categorias são sugestões baseadas nos metadados e no README.</small></div></aside>
      <section class="collection" aria-label="Coleção de repositórios">
        <div v-if="deletedFeedback" class="feedback-toast" role="status">
          <span class="toast-text">✓ {{ deletedFeedback }}</span>
          <div class="toast-actions">
            <button v-if="deletedHistory.length" type="button" @click="undoDelete" class="toast-undo">Desfazer</button>
            <button type="button" @click="deletedFeedback = ''" class="toast-close" aria-label="Fechar notificação">✕</button>
          </div>
        </div>
        <div class="collection-top"><div><p class="eyebrow">{{ view === 'carousel' ? 'PROTÓTIPO' : 'EXPLORE SUA COLEÇÃO' }}</p><h2>{{ category && category !== 'uncategorized' ? category : (view === 'carousel' ? 'Visualização em Carrossel' : 'Toda a biblioteca') }}</h2></div><div class="view-switch" aria-label="Modo de visualização"><button :aria-pressed="view === 'grid'" @click="view = 'grid'">Grade</button><button :aria-pressed="view === 'carousel'" @click="view = 'carousel'">Carrossel</button></div></div>
        <label class="search-box"><span aria-hidden="true">⌕</span><input v-model="search" aria-label="Buscar aplicações" placeholder="Busque uma ideia, ferramenta, linguagem ou topic…"><kbd>/ explorar</kbd></label>
        <div class="filter-bar"><label>Visibilidade<select v-model="visibility"><option value="">Todas</option><option value="public">Públicos</option><option value="private">Privados</option></select></label><label>Linguagem<select v-model="language"><option value="">Todas</option><option v-for="l in options.languages" :key="l">{{ l }}</option></select></label><label>Topic<select v-model="topic"><option value="">Todos</option><option value="missing">Sem topics</option><option v-for="t in options.topics" :key="t">{{ t }}</option></select></label><label>Tipo<select v-model="kind"><option value="">Todos</option><option value="original">Originais ativos</option><option value="fork">Forks</option><option value="archived">Arquivados</option></select></label><label>Conteúdo<select v-model="contentType"><option value="">Todos</option><option v-for="(label, value) in projectTypes" :key="value" :value="value">{{ label }}</option></select></label><label>Ordenar<select v-model="sort"><option value="updated">Último push</option><option value="name">Nome</option><option value="stars">Estrelas</option></select></label></div>
        <div v-if="loading" class="empty" role="status">Abrindo sua biblioteca…</div>
        <div v-else-if="error" class="empty" role="alert"><h3>A biblioteca não carregou.</h3><p>{{ error }}</p><button @click="load">Tentar novamente</button></div>
        <template v-else><div class="result-line"><span>{{ filtered.length }} repositórios encontrados</span><button @click="reset">Limpar filtros</button></div>
          <div v-if="!filtered.length" class="empty"><h3>Nenhuma aplicação por aqui.</h3><p>Experimente outro termo ou remova os filtros.</p><button @click="reset">Explorar tudo</button></div>
          <template v-else-if="view === 'grid'"><div class="repo-grid"><article v-for="r in visible" :key="r.name" class="repo-card"><div class="card-top"><span class="repo-monogram">{{ r.name.slice(0, 2).toUpperCase() }}</span><span class="visibility" :class="{ private: r.private }">{{ r.private ? '◈ Privado' : '◉ Público' }}</span></div><p class="card-category">{{ r.categories[0] || projectTypes[r.projectType] || 'A categorizar' }}</p><h3><button @click="open(r)">{{ r.name }}</button></h3><p class="purpose">{{ r.purpose }}</p><div class="topics"><span v-for="t in r.topics.slice(0, 3)" :key="t">{{ t }}</span><span v-if="!r.topics.length" class="pending">Sem topics</span><span v-if="r.topics.length > 3">+{{ r.topics.length - 3 }}</span></div><footer><span>{{ r.language || 'Sem linguagem' }} · {{ r.stars }} ★</span><button @click="open(r)">Explorar ↗<span class="sr-only"> {{ r.name }}</span></button></footer><div class="repo-flags" v-if="r.archived || r.fork">{{ r.archived ? 'Arquivado' : '' }} {{ r.fork ? 'Fork' : '' }}</div></article></div><nav v-if="pages > 1" class="pagination" aria-label="Paginação"><button :disabled="page === 1" @click="page--">← Anterior</button><span>{{ page }} / {{ pages }}</span><button :disabled="page === pages" @click="page++">Próxima →</button></nav></template>
          <section v-else class="carousel carousel-prototype" tabindex="0" aria-label="Carrossel de repositórios. Use as setas para navegar.">
            <div class="carousel-toolbar">
              <div class="carousel-nav-group">
                <button type="button" class="carousel-ctrl-btn btn-prev" :disabled="cursor === 0" @click="step(-1)" title="Ir para o repositório anterior">
                  ← Anterior
                </button>
                <div class="carousel-meta-badge">
                  <span class="carousel-meta">{{ cursor + 1 }} / {{ filtered.length }}</span>
                </div>
                <button type="button" class="carousel-ctrl-btn btn-next" :disabled="cursor === filtered.length - 1" @click="step(1)" title="Ir para o próximo repositório">
                  Próximo →
                </button>
              </div>
              <div class="carousel-action-group">
                <button type="button" class="carousel-ctrl-btn btn-list" @click="view = 'grid'" title="Visualizar catálogo em modo de lista/grade">
                  ☰ Lista
                </button>
                <button type="button" class="carousel-ctrl-btn btn-delete" @click="requestDelete(featured)" title="Excluir este repositório do catálogo">
                  🗑 Excluir repositório
                </button>
              </div>
            </div>

            <div class="carousel-body">
              <div class="carousel-info-pane">
                <div class="carousel-app-header">
                  <div class="carousel-app-monogram" aria-hidden="true">
                    {{ featured.name.slice(0, 2).toUpperCase() }}
                  </div>
                  <div class="carousel-app-title-area carousel-header-text">
                    <div class="carousel-badges-row carousel-meta-tags">
                      <span class="visibility-tag" :class="{ private: featured.private }">{{ featured.private ? '◈ Privado' : '◉ Público' }}</span>
                      <span class="type-tag" v-if="featured.projectType">{{ projectTypes[featured.projectType] || featured.projectType }}</span>
                    </div>
                    <h3 class="carousel-app-name">{{ featured.name }}</h3>
                    <p class="carousel-app-category" v-if="featured.categories?.length">{{ featured.categories.join(' · ') }}</p>
                  </div>
                </div>

                <div class="carousel-section">
                  <span class="carousel-section-heading carousel-section-title">DESCRIÇÃO DA APLICAÇÃO</span>
                  <p class="carousel-purpose carousel-purpose-text">{{ featured.purpose || featured.description || 'Sem descrição informada.' }}</p>
                </div>

                <div class="carousel-section" v-if="featured.topics?.length">
                  <span class="carousel-section-heading carousel-section-title">TOPICS</span>
                  <div class="topics-wrap">
                    <span v-for="t in featured.topics" :key="t" class="topic-chip">{{ t }}</span>
                  </div>
                </div>

                <div class="carousel-meta-grid carousel-stats">
                  <div class="meta-box stat-pill"><span class="meta-box-label stat-label">Linguagem:</span> <strong>{{ featured.language || 'Sem linguagem' }}</strong></div>
                  <div class="meta-box stat-pill"><span class="meta-box-label stat-label">Estrelas:</span> <strong>{{ featured.stars }} ★</strong></div>
                  <div class="meta-box stat-pill"><span class="meta-box-label stat-label">Último push:</span> <strong>{{ date(featured.pushed_at) }}</strong></div>
                  <div class="meta-box stat-pill" v-if="featured.branch"><span class="meta-box-label stat-label">Branch:</span> <strong>{{ featured.branch }}</strong></div>
                </div>

                <div class="carousel-info-footer carousel-footer-actions">
                  <a :href="featured.url" target="_blank" rel="noopener noreferrer" class="link-github">Abrir repositório no GitHub ↗</a>
                  <button class="modal-expand-btn quiet-modal-btn" @click="open(featured)">Conhecer aplicação e README ↗</button>
                </div>
              </div>

              <div class="carousel-readme-pane">
                <div class="carousel-readme-header">
                  <div class="readme-title-info">
                    <span class="readme-file-icon" aria-hidden="true">📄</span>
                    <div>
                      <h4>{{ carouselReadmeDetail?.path || 'README.md' }}</h4>
                      <span class="readme-sub">Documentação renderizada</span>
                    </div>
                  </div>
                  <span class="readme-badge" :class="carouselReadmeDetail?.status || (carouselReadmeLoading ? 'loading' : 'ok')">
                    {{ carouselReadmeLoading ? 'Carregando…' : carouselReadmeDetail?.status === 'ok' ? 'README renderizado' : carouselReadmeDetail?.status === 'missing' ? 'Sem README' : 'Disponível' }}
                  </span>
                </div>

                <div class="carousel-readme-viewport">
                  <div v-if="carouselReadmeLoading" class="readme-loading-box" role="status">
                    <p>Carregando documentação da aplicação…</p>
                  </div>
                  <div v-else-if="renderedCarousel" class="carousel-readme-body" v-html="renderedCarousel"></div>
                  <div v-else-if="carouselReadmeDetail?.status === 'missing'" class="carousel-readme-empty">
                    <span class="empty-icon" aria-hidden="true">📝</span>
                    <h4>Este repositório ainda não possui README.</h4>
                    <p>Nenhum arquivo de documentação encontrado na branch padrão.</p>
                  </div>
                  <div v-else class="carousel-readme-empty">
                    <p>{{ carouselReadmeDetail?.message || 'A documentação não está disponível para esta aplicação.' }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </template>
        <p v-if="scope === 'public'" class="local-note">Quer incluir aplicações privadas? Execute <code>pnpm local</code> nesta máquina. O acesso fica local e a credencial permanece no servidor.</p>
      </section>
    </section>
    <dialog ref="deleteDialog" class="repo-dialog confirm-dialog" @cancel.prevent="cancelDelete" @click="($event.target === deleteDialog) && cancelDelete()"><template v-if="repoToDelete"><header class="confirm-dialog-header"><div class="confirm-title-wrap"><span class="warning-badge" aria-hidden="true">⚠️</span><div><p class="eyebrow">CONFIRMAÇÃO DE EXCLUSÃO</p><h2>Excluir repositório?</h2></div></div><button type="button" @click="cancelDelete" aria-label="Fechar">✕</button></header><div class="confirm-dialog-body"><p class="confirm-msg">Tem certeza de que deseja excluir o repositório <strong>{{ repoToDelete.name }}</strong> da biblioteca?</p><div class="confirm-alert-box"><p>Esta ação removerá a aplicação da sua visualização e do carrossel no catálogo.</p></div><div class="confirm-dialog-actions"><button type="button" class="btn-cancel" @click="cancelDelete">Cancelar</button><button type="button" class="btn-confirm-delete" @click="confirmDelete">Sim, excluir repositório</button></div></div></template></dialog>
    <dialog ref="dialog" class="repo-dialog" @cancel.prevent="close" @click="($event.target === dialog) && close()"><template v-if="selected"><header><div><p class="eyebrow">{{ selected.private ? 'REPOSITÓRIO PRIVADO · ACESSO LOCAL' : 'REPOSITÓRIO PÚBLICO' }}</p><h2>{{ selected.name }}</h2></div><button @click="close" aria-label="Fechar detalhes">✕</button></header><div class="detail-body"><button v-if="scope === 'private' && !editing" class="edit-button" @click="edit">Editar ficha pessoal ↗</button><form v-if="editing" class="edit-form" @submit.prevent="save"><label>Para que serve esta aplicação?<textarea v-model="editPurpose" required maxlength="1200" rows="4"></textarea></label><fieldset><legend>Categorias</legend><label v-for="c in categoryChoices" :key="c"><input type="checkbox" v-model="editCategories" :value="c">{{ c }}</label></fieldset><p>Anotações ficam nesta máquina e não alteram a descrição no GitHub.</p><p v-if="editError" role="alert">{{ editError }}</p><button class="primary" :disabled="saving">{{ saving ? 'Salvando…' : 'Salvar ficha' }}</button><button type="button" @click="editing = false" :disabled="saving">Cancelar</button></form><p v-if="selected.projectType" class="content-status">{{ projectTypes[selected.projectType] }}</p><p class="detail-purpose">{{ selected.purpose }}</p><p class="muted">Fonte: {{ selected.purposeSource }} · {{ selected.language || 'Sem linguagem' }} · último push {{ date(selected.pushed_at) }}</p><div class="topics"><span v-for="t in selected.topics" :key="t">{{ t }}</span></div><div v-if="selected.suggestedTopics.some(t => !selected.topics.includes(t))" class="suggestions"><strong>Sugestões de topics</strong><p>{{ selected.suggestedTopics.filter(t => !selected.topics.includes(t)).join(' · ') }}</p><small>Revise a finalidade antes de aplicar. O comando de topics preserva as tags existentes.</small></div><a :href="selected.url" target="_blank" rel="noopener noreferrer" class="github-link">Abrir repositório no GitHub ↗</a><div class="readme-title"><h3>README</h3><span>{{ detail?.path || 'Documentação do projeto' }}</span></div><p v-if="readmeLoading" role="status">Carregando documentação…</p><div v-else-if="detail?.status === 'ok'" class="readme" v-html="rendered"></div><p v-else-if="detail?.status === 'missing'">Este repositório ainda não tem README.</p><div v-else role="alert"><p>{{ detail?.message || 'A documentação não está disponível.' }}</p><button @click="open(selected)">Tentar novamente</button></div></div></template></dialog>
  </main>
</template>

<style>
/* Full-width carousel workspace */
.workspace.carousel-full {
  grid-template-columns: 1fr !important;
  margin-top: 14px !important;
}
.workspace.carousel-full .shelves {
  display: none !important;
}
.workspace.carousel-full .filter-bar {
  display: none !important;
}
.workspace.carousel-full .collection-top {
  margin-bottom: 12px;
}
.workspace.carousel-full .search-box {
  margin-bottom: 6px;
  padding: 10px 14px;
}
.workspace.carousel-full .result-line {
  margin: 10px 0;
}

/* Prototype Carousel Styles */
.carousel.carousel-prototype {
  display: flex !important;
  flex-direction: column !important;
  background: var(--atlas-panel);
  border: 1px solid var(--atlas-line);
  border-radius: var(--atlas-radius);
  overflow: hidden;
  box-shadow: var(--atlas-shadow);
  margin-top: 10px;
}
.carousel-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: rgba(14, 23, 29, 0.95);
  border-bottom: 1px solid var(--atlas-line);
  gap: 12px;
  flex-wrap: wrap;
}
.carousel-nav-group, .carousel-action-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.carousel-ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--atlas-line);
  background: #192b33;
  color: var(--atlas-text);
  line-height: 1;
}
.carousel-ctrl-btn:hover:not(:disabled) {
  border-color: var(--atlas-accent);
  color: var(--atlas-accent);
  transform: translateY(-1px);
}
.carousel-ctrl-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: none;
}
.carousel-ctrl-btn.btn-prev, .carousel-ctrl-btn.btn-next {
  color: var(--atlas-accent);
  background: rgba(32, 113, 89, 0.28);
  border-color: rgba(178, 233, 205, 0.35);
}
.carousel-ctrl-btn.btn-prev:hover:not(:disabled), .carousel-ctrl-btn.btn-next:hover:not(:disabled) {
  background: rgba(32, 113, 89, 0.5);
  border-color: var(--atlas-accent);
}
.carousel-ctrl-btn.btn-list {
  background: rgba(23, 37, 45, 0.9);
  border-color: var(--atlas-line);
  color: var(--atlas-text);
}
.carousel-ctrl-btn.btn-list:hover {
  background: rgba(36, 61, 59, 0.9);
  border-color: var(--atlas-accent);
  color: var(--atlas-accent);
}
.carousel-ctrl-btn.btn-delete {
  background: rgba(180, 50, 50, 0.15);
  border-color: rgba(220, 80, 80, 0.4);
  color: #ff9d9d;
}
.carousel-ctrl-btn.btn-delete:hover {
  background: rgba(180, 50, 50, 0.32);
  border-color: #ff6e6e;
  color: #fff;
}
.carousel-meta-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  background: rgba(11, 19, 24, 0.7);
  border-radius: 8px;
  border: 1px solid var(--atlas-line);
  font-variant-numeric: tabular-nums;
}
.carousel-meta-badge .carousel-meta {
  margin-bottom: 0 !important;
  display: inline !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  color: var(--atlas-accent) !important;
  white-space: nowrap;
}

.carousel-body {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  min-height: 520px;
  align-items: stretch;
}
.carousel-info-pane {
  padding: 24px;
  background: linear-gradient(175deg, rgba(23, 37, 45, 0.98), rgba(16, 26, 32, 0.92));
  border-right: 1px solid var(--atlas-line);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.carousel-app-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.carousel-app-monogram {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2c5a4a, #1f4237);
  border: 1px solid rgba(178, 233, 205, 0.35);
  color: var(--atlas-accent);
  display: grid;
  place-items: center;
  font-size: 17px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
}
.carousel-header-text, .carousel-app-title-area {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.carousel-badges-row, .carousel-meta-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}
.visibility-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(178, 233, 205, 0.12);
  color: var(--atlas-accent);
  border: 1px solid rgba(178, 233, 205, 0.25);
  line-height: 1.2;
}
.visibility-tag.private {
  background: rgba(236, 190, 110, 0.12);
  color: #edc581;
  border-color: rgba(236, 190, 110, 0.25);
}
.type-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(95, 184, 217, 0.12);
  color: #5fb8d9;
  border: 1px solid rgba(95, 184, 217, 0.25);
  line-height: 1.2;
}
.carousel-app-name, .carousel-app-header h3, .carousel-header-text h3 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1.25;
  color: #fff;
  overflow-wrap: anywhere;
  margin: 2px 0 2px;
}
.carousel-app-category {
  font-size: 11px;
  color: var(--atlas-accent);
  font-weight: 500;
  margin: 0;
}
.carousel-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.carousel-section-heading, .carousel-section-title {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: var(--atlas-accent);
  text-transform: uppercase;
}
.carousel-purpose, .carousel-purpose-text {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--atlas-text);
  margin: 0;
  background: rgba(11, 19, 24, 0.45);
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(52, 68, 76, 0.45);
}
.topics-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.topic-chip {
  background: #1e333a;
  border: 1px solid #38535b;
  color: #c3d8dc;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
}
.carousel-meta-grid, .carousel-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--atlas-line);
}
.meta-box, .stat-pill {
  font-size: 11px;
  background: rgba(11, 19, 24, 0.5);
  border: 1px solid var(--atlas-line);
  padding: 8px 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.meta-box-label, .stat-label {
  font-size: 9.5px;
  color: var(--atlas-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.meta-box strong, .stat-pill strong {
  color: var(--atlas-text);
  font-weight: 600;
  font-size: 12px;
}
.carousel-info-footer, .carousel-footer-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--atlas-line);
}
.link-github {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12.5px;
  color: var(--atlas-accent);
  padding: 9px 14px;
  border: 1px solid rgba(178, 233, 205, 0.35);
  border-radius: 8px;
  background: rgba(32, 113, 89, 0.22);
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}
.link-github:hover {
  background: rgba(32, 113, 89, 0.42);
  border-color: var(--atlas-accent);
  color: #fff;
}
.modal-expand-btn, .quiet-modal-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11.5px;
  color: var(--atlas-muted);
  padding: 8px 12px;
  border: 1px solid var(--atlas-line);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}
.modal-expand-btn:hover, .quiet-modal-btn:hover {
  color: var(--atlas-text);
  border-color: var(--atlas-muted);
}

/* README Viewport Column */
.carousel-readme-pane {
  background: rgba(11, 19, 24, 0.65);
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.carousel-readme-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  border-bottom: 1px solid var(--atlas-line);
  background: rgba(16, 26, 32, 0.85);
  gap: 12px;
}
.readme-title-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.readme-file-icon {
  font-size: 20px;
}
.readme-title-info h4 {
  font-size: 15px;
  font-weight: 650;
  margin: 0;
  color: #fff;
}
.readme-sub {
  font-size: 11px;
  color: var(--atlas-muted);
}
.readme-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(178, 233, 205, 0.12);
  color: var(--atlas-accent);
  border: 1px solid rgba(178, 233, 205, 0.25);
}
.readme-badge.missing {
  background: rgba(236, 190, 110, 0.12);
  color: #edc581;
  border-color: rgba(236, 190, 110, 0.25);
}
.readme-badge.loading {
  background: rgba(95, 184, 217, 0.12);
  color: #5fb8d9;
  border-color: rgba(95, 184, 217, 0.25);
}
.carousel-readme-viewport {
  padding: 24px 30px;
  overflow-y: auto;
  height: 560px;
  max-height: 560px;
  line-height: 1.75;
  font-size: 13.5px;
}
.carousel-readme-viewport::-webkit-scrollbar {
  width: 8px;
}
.carousel-readme-viewport::-webkit-scrollbar-track {
  background: rgba(11, 19, 24, 0.4);
}
.carousel-readme-viewport::-webkit-scrollbar-thumb {
  background: var(--atlas-line);
  border-radius: 4px;
}
.carousel-readme-viewport::-webkit-scrollbar-thumb:hover {
  background: var(--atlas-muted);
}
.carousel-readme-body {
  overflow-wrap: anywhere;
  color: #dbe7e4;
}
.carousel-readme-body h1, .carousel-readme-body h2, .carousel-readme-body h3 {
  color: #fff;
  font-weight: 650;
  margin: 20px 0 12px;
  line-height: 1.3;
}
.carousel-readme-body h1 { font-size: 24px; border-bottom: 1px solid var(--atlas-line); padding-bottom: 6px; }
.carousel-readme-body h2 { font-size: 19px; border-bottom: 1px solid rgba(52, 68, 76, 0.5); padding-bottom: 5px; }
.carousel-readme-body h3 { font-size: 15px; }
.carousel-readme-body p, .carousel-readme-body ul, .carousel-readme-body ol { margin: 12px 0; }
.carousel-readme-body ul, .carousel-readme-body ol { padding-left: 22px; }
.carousel-readme-body ul { list-style: disc; }
.carousel-readme-body ol { list-style: decimal; }
.carousel-readme-body a { color: var(--atlas-accent); text-decoration: underline; }
.carousel-readme-body pre {
  background: #091014;
  padding: 14px 18px;
  border: 1px solid var(--atlas-line);
  border-radius: 8px;
  overflow-x: auto;
  margin: 14px 0;
}
.carousel-readme-body code {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #b2e9cd;
}
.carousel-readme-body blockquote {
  border-left: 3px solid var(--atlas-accent);
  padding-left: 14px;
  margin: 14px 0;
  color: var(--atlas-muted);
  font-style: italic;
}
.carousel-readme-body table {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 14px 0;
  width: 100%;
}
.carousel-readme-body th, .carousel-readme-body td {
  padding: 7px 12px;
  border: 1px solid var(--atlas-line);
}
.carousel-readme-body th {
  background: rgba(32, 113, 89, 0.2);
  font-weight: 600;
}
.carousel-readme-empty, .readme-loading-box {
  padding: 50px 20px;
  text-align: center;
  color: var(--atlas-muted);
}
.empty-icon {
  font-size: 34px;
  display: block;
  margin-bottom: 10px;
}
.carousel-readme-empty h4 {
  font-size: 17px;
  color: var(--atlas-text);
  margin-bottom: 6px;
}
.carousel-readme-body .image-note, .readme .image-note {
  display: inline-block;
  padding: 2px 7px;
  margin: 2px 3px;
  font-size: 11px;
  background: rgba(34, 54, 61, 0.7);
  border: 1px solid #38535b;
  border-radius: 4px;
  color: #c3d8dc;
  vertical-align: middle;
}
.carousel-readme-body a:has(.image-note), .readme a:has(.image-note) {
  text-decoration: none;
}

/* Confirmation Dialog */
.confirm-dialog {
  max-width: 460px;
  width: 90vw;
  border-radius: 16px;
  border: 1px solid rgba(220, 80, 80, 0.4);
  box-shadow: 0 25px 60px -15px rgba(0,0,0,0.85);
  background: var(--atlas-bg);
  overflow: hidden;
}
.confirm-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  background: rgba(180, 40, 40, 0.15);
  border-bottom: 1px solid var(--atlas-line);
}
.confirm-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.warning-badge {
  font-size: 22px;
}
.confirm-dialog-header h2 {
  font-size: 19px;
  font-weight: 650;
  color: #fff;
  margin: 2px 0 0;
}
.confirm-dialog-body {
  padding: 22px;
}
.confirm-msg {
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--atlas-text);
  margin-bottom: 14px;
}
.confirm-msg strong {
  color: #ff9d9d;
}
.confirm-alert-box {
  background: rgba(180, 40, 40, 0.1);
  border: 1px solid rgba(220, 80, 80, 0.25);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: var(--atlas-muted);
  line-height: 1.5;
}
.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.btn-cancel {
  background: transparent;
  border: 1px solid var(--atlas-line);
  color: var(--atlas-muted);
  padding: 9px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 550;
  transition: all 0.2s;
  cursor: pointer;
}
.btn-cancel:hover {
  color: var(--atlas-text);
  border-color: var(--atlas-muted);
}
.btn-confirm-delete {
  background: #c93b3b;
  border: 1px solid #e04848;
  color: #fff;
  padding: 9px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: 0 4px 14px -3px rgba(200, 50, 50, 0.5);
}
.btn-confirm-delete:hover {
  background: #de4343;
}
</style>
