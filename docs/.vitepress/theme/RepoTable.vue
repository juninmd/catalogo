<template>
  <div class="repo-catalog">

    <!-- Loading -->
    <div v-if="loading" class="loading">
      <span class="spinner" /> Carregando repositórios...
    </div>

    <template v-else>
      <!-- Filtros -->
      <div class="filters">
        <input
          v-model="search"
          class="search-input"
          placeholder="🔍 Buscar por nome ou descrição..."
          @input="page = 1"
        />

        <div class="filter-row">
          <!-- Tipo -->
          <div class="filter-group">
            <span class="filter-label">Tipo</span>
            <div class="pills">
              <button
                v-for="opt in typeOpts"
                :key="opt.value"
                class="pill"
                :class="{ active: typeFilter === opt.value }"
                @click="typeFilter = opt.value; page = 1"
              >{{ opt.label }} <span class="count">{{ opt.count }}</span></button>
            </div>
          </div>

          <!-- Visibilidade -->
          <div class="filter-group">
            <span class="filter-label">Visibilidade</span>
            <div class="pills">
              <button
                v-for="opt in visOpts"
                :key="opt.value"
                class="pill"
                :class="{ active: visFilter === opt.value }"
                @click="visFilter = opt.value; page = 1"
              >{{ opt.label }} <span class="count">{{ opt.count }}</span></button>
            </div>
          </div>

          <!-- Linguagem -->
          <div class="filter-group">
            <span class="filter-label">Linguagem</span>
            <select v-model="langFilter" class="lang-select" @change="page = 1">
              <option value="">Todas ({{ repos.length }})</option>
              <option v-for="[lang, count] in topLanguages" :key="lang" :value="lang">
                {{ lang }} ({{ count }})
              </option>
            </select>
          </div>

          <!-- Arquivados -->
          <div class="filter-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="showArchived" @change="page = 1" />
              Mostrar arquivados
            </label>
          </div>
        </div>
      </div>

      <!-- Resultado + info -->
      <div class="result-info">
        <span>
          Exibindo <strong>{{ paginated.length }}</strong> de
          <strong>{{ filtered.length }}</strong> repositórios
          <template v-if="filtered.length !== repos.length">
            (filtrado de {{ repos.length }} total)
          </template>
        </span>
        <span class="updated-at">atualizado {{ relativeDate(generatedAt) }}</span>
      </div>

      <!-- Tabela -->
      <div class="table-wrap">
        <table class="repo-table">
          <thead>
            <tr>
              <th @click="setSort('name')" class="sortable">
                Repositório {{ sortIcon('name') }}
              </th>
              <th>Descrição</th>
              <th @click="setSort('language')" class="sortable">
                Linguagem {{ sortIcon('language') }}
              </th>
              <th @click="setSort('created_at')" class="sortable th-date">
                Criado {{ sortIcon('created_at') }}
              </th>
              <th @click="setSort('pushed_at')" class="sortable th-date">
                Último push {{ sortIcon('pushed_at') }}
              </th>
              <th @click="setSort('commits')" class="sortable th-num">
                Commits {{ sortIcon('commits') }}
              </th>
              <th @click="setSort('contributors')" class="sortable th-num">
                Contrib. {{ sortIcon('contributors') }}
              </th>
              <th @click="setSort('stars')" class="sortable th-num">
                ⭐ {{ sortIcon('stars') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in paginated" :key="r.name" :class="{ archived: r.archived, fork: r.fork }">
              <!-- Nome -->
              <td class="td-name">
                <a :href="r.url" target="_blank" rel="noopener" class="repo-link">{{ r.name }}</a>
                <div class="badges">
                  <span v-if="r.fork"     class="badge badge-fork">🍴 fork</span>
                  <span v-if="r.archived" class="badge badge-arch">📦 arquivado</span>
                  <span v-if="r.private"  class="badge badge-priv">🔒 privado</span>
                  <span v-else            class="badge badge-pub">🌐 público</span>
                </div>
              </td>

              <!-- Descrição -->
              <td class="td-desc">{{ r.description || '—' }}</td>

              <!-- Linguagem -->
              <td class="td-lang">
                <span v-if="r.language" class="lang-badge">
                  <span class="lang-dot" :style="{ background: langColor(r.language) }"/>
                  {{ r.language }}
                </span>
                <span v-else class="muted">—</span>
              </td>

              <!-- Criado em -->
              <td class="td-date muted" :title="r.created_at">
                {{ shortDate(r.created_at) }}
              </td>

              <!-- Último push -->
              <td class="td-date" :title="r.pushed_at">
                {{ relativeDate(r.pushed_at) }}
              </td>

              <!-- Commits -->
              <td class="td-num">
                <span v-if="r.commits !== null">{{ r.commits.toLocaleString('pt-BR') }}</span>
                <span v-else class="muted">—</span>
              </td>

              <!-- Contribuidores -->
              <td class="td-num">
                <span v-if="r.contributors !== null">{{ r.contributors }}</span>
                <span v-else class="muted">—</span>
              </td>

              <!-- Stars -->
              <td class="td-num">
                <span v-if="r.stars > 0">{{ r.stars }}</span>
                <span v-else class="muted">0</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginação -->
      <div v-if="totalPages > 1" class="pagination">
        <button :disabled="page <= 1" @click="page--" class="pg-btn">‹ Anterior</button>
        <span class="pg-info">{{ page }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages" @click="page++" class="pg-btn">Próxima ›</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const repos       = ref([])
const generatedAt = ref(null)
const loading     = ref(true)
const search      = ref('')
const typeFilter  = ref('all')   // all | original | fork
const visFilter   = ref('all')   // all | public | private
const langFilter  = ref('')
const showArchived = ref(false)
const sortBy      = ref('pushed_at')
const sortDir     = ref('desc')
const page        = ref(1)
const PER_PAGE    = 30

// ─── Carregar dados ────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const res  = await fetch('/catalogo/repos.json')
    const data = await res.json()
    repos.value       = data.repos
    generatedAt.value = data.generated_at
  } catch (e) {
    console.error('Erro ao carregar repos.json', e)
  } finally {
    loading.value = false
  }
})

// ─── Opções de filtro com contagens ──────────────────────────────────────────

const allBase = computed(() => repos.value.filter(r => showArchived.value || !r.archived))

const typeOpts = computed(() => [
  { value: 'all',      label: 'Todos',     count: allBase.value.length },
  { value: 'original', label: 'Originais', count: allBase.value.filter(r => !r.fork).length },
  { value: 'fork',     label: 'Forks',     count: allBase.value.filter(r => r.fork).length },
])

const visOpts = computed(() => [
  { value: 'all',     label: 'Todos',    count: allBase.value.length },
  { value: 'public',  label: 'Públicos', count: allBase.value.filter(r => !r.private).length },
  { value: 'private', label: 'Privados', count: allBase.value.filter(r => r.private).length },
])

const topLanguages = computed(() => {
  const counts = {}
  for (const r of allBase.value) {
    if (r.language) counts[r.language] = (counts[r.language] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
})

// ─── Filtro + ordenação ───────────────────────────────────────────────────────

const filtered = computed(() => {
  let list = repos.value

  if (!showArchived.value)       list = list.filter(r => !r.archived)
  if (typeFilter.value === 'original') list = list.filter(r => !r.fork)
  if (typeFilter.value === 'fork')     list = list.filter(r => r.fork)
  if (visFilter.value === 'public')    list = list.filter(r => !r.private)
  if (visFilter.value === 'private')   list = list.filter(r => r.private)
  if (langFilter.value)                list = list.filter(r => r.language === langFilter.value)

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    )
  }

  return [...list].sort((a, b) => {
    let va = a[sortBy.value], vb = b[sortBy.value]
    if (va == null) va = sortDir.value === 'asc' ? Infinity : -Infinity
    if (vb == null) vb = sortDir.value === 'asc' ? Infinity : -Infinity
    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb + '').toLowerCase() }
    if (va < vb) return sortDir.value === 'asc' ? -1 : 1
    if (va > vb) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

const totalPages = computed(() => Math.ceil(filtered.value.length / PER_PAGE))
const paginated  = computed(() => {
  const start = (page.value - 1) * PER_PAGE
  return filtered.value.slice(start, start + PER_PAGE)
})

// ─── Sort ─────────────────────────────────────────────────────────────────────

function setSort(col) {
  if (sortBy.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value  = col
    sortDir.value = 'desc'
  }
  page.value = 1
}

function sortIcon(col) {
  if (sortBy.value !== col) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function relativeDate(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const d    = Math.floor(diff / 86400000)
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 7)   return `${d}d atrás`
  if (d < 30)  return `${Math.floor(d / 7)}sem atrás`
  if (d < 365) return `${Math.floor(d / 30)}m atrás`
  return `${Math.floor(d / 365)}a atrás`
}

function shortDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Shell: '#89e051', Go: '#00ADD8', Rust: '#dea584', Java: '#b07219',
  'C#': '#178600', CSS: '#563d7c', HTML: '#e34c26', Vue: '#41b883',
  Dockerfile: '#384d54', HCL: '#844FBA', Ruby: '#701516', PHP: '#4F5D95',
  Kotlin: '#A97BFF', Swift: '#F05138', 'C++': '#f34b7d', C: '#555555',
}

function langColor(lang) {
  return LANG_COLORS[lang] || '#888'
}
</script>

<style scoped>
.repo-catalog { font-size: 14px; }

/* ── Loading ── */
.loading { display: flex; align-items: center; gap: 10px; padding: 40px; color: var(--vp-c-text-2); }
.spinner { width: 18px; height: 18px; border: 2px solid var(--vp-c-border); border-top-color: var(--vp-c-brand-1); border-radius: 50%; animation: spin .7s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Filtros ── */
.filters { background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-border); border-radius: 10px; padding: 16px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }

.search-input {
  width: 100%; padding: 8px 12px; border-radius: 6px;
  border: 1px solid var(--vp-c-border); background: var(--vp-c-bg);
  color: var(--vp-c-text-1); font-size: 14px; outline: none;
  transition: border-color .2s;
}
.search-input:focus { border-color: var(--vp-c-brand-1); }

.filter-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-label { font-size: 12px; color: var(--vp-c-text-2); white-space: nowrap; font-weight: 500; }

.pills { display: flex; gap: 4px; }
.pill {
  padding: 3px 10px; border-radius: 20px; font-size: 12px; cursor: pointer;
  border: 1px solid var(--vp-c-border); background: transparent;
  color: var(--vp-c-text-2); transition: all .15s; white-space: nowrap;
}
.pill:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.pill.active { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: #fff; }
.count { opacity: .75; font-size: 11px; }

.lang-select {
  padding: 4px 8px; border-radius: 6px; font-size: 12px;
  border: 1px solid var(--vp-c-border); background: var(--vp-c-bg);
  color: var(--vp-c-text-1); cursor: pointer; max-width: 180px;
}

.toggle-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--vp-c-text-2); cursor: pointer; }
.toggle-label input { cursor: pointer; }

/* ── Info ── */
.result-info { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--vp-c-text-2); margin-bottom: 8px; }
.result-info strong { color: var(--vp-c-text-1); }
.updated-at { font-size: 12px; }

/* ── Tabela ── */
.table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid var(--vp-c-border); }

.repo-table { width: 100%; border-collapse: collapse; }
.repo-table thead { background: var(--vp-c-bg-soft); }
.repo-table th {
  padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600;
  color: var(--vp-c-text-2); border-bottom: 1px solid var(--vp-c-border);
  white-space: nowrap; user-select: none;
}
.repo-table th.sortable { cursor: pointer; }
.repo-table th.sortable:hover { color: var(--vp-c-brand-1); }
.th-date, .th-num { text-align: right; }

.repo-table td { padding: 9px 12px; border-bottom: 1px solid var(--vp-c-divider); vertical-align: top; }
.repo-table tr:last-child td { border-bottom: none; }
.repo-table tr:hover td { background: var(--vp-c-bg-soft); }
.repo-table tr.archived td { opacity: .6; }

/* ── Células ── */
.td-name { min-width: 160px; }
.repo-link { font-weight: 600; color: var(--vp-c-brand-1); text-decoration: none; }
.repo-link:hover { text-decoration: underline; }

.badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
.badge-fork { background: #6366f122; color: #6366f1; border: 1px solid #6366f144; }
.badge-arch { background: #78716c22; color: #78716c; border: 1px solid #78716c44; }
.badge-priv { background: #f59e0b22; color: #f59e0b; border: 1px solid #f59e0b44; }
.badge-pub  { background: #22c55e22; color: #22c55e; border: 1px solid #22c55e44; }

.td-desc { font-size: 13px; color: var(--vp-c-text-2); max-width: 300px; }

.td-lang { white-space: nowrap; }
.lang-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; }
.lang-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

.td-date { font-size: 12px; text-align: right; white-space: nowrap; }
.td-num  { font-size: 13px; text-align: right; white-space: nowrap; }
.muted   { color: var(--vp-c-text-3); }

/* ── Paginação ── */
.pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; }
.pg-btn {
  padding: 6px 14px; border-radius: 6px; border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg); color: var(--vp-c-text-1); cursor: pointer; font-size: 13px;
  transition: all .15s;
}
.pg-btn:hover:not(:disabled) { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.pg-btn:disabled { opacity: .4; cursor: not-allowed; }
.pg-info { font-size: 13px; color: var(--vp-c-text-2); }
</style>
