import { execFileSync } from 'node:child_process'
let cachedCredential
export function credential() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (cachedCredential !== undefined) return cachedCredential
  try { cachedCredential = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { cachedCredential = null }
  return cachedCredential
}
export function redact(text = '') {
  for (const secret of [process.env.GH_TOKEN, process.env.GITHUB_TOKEN, cachedCredential].filter(Boolean)) text = text.split(secret).join('[credencial removida]')
  return text.replace(/(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,})/g, '[credencial removida]')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[chave removida]')
    .replace(/((?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*)["']?[^\s"'<>]{8,}/gi, '$1[valor removido]')
}
export async function api(path, { token = credential(), method = 'GET', body, attempt = 0 } = {}) {
  const response = await fetch(`https://api.github.com/${path}`, { method, signal: AbortSignal.timeout(30000), headers: {
    Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) })
  if (!response.ok) {
    if (attempt < 4 && (response.status >= 500 || response.status === 429 || (response.status === 403 && response.headers.has('retry-after')))) {
      const delay = Number(response.headers.get('retry-after')) * 1000 || Math.min(30000, 2000 * 2 ** attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
      return api(path, { token, method, body, attempt: attempt + 1 })
    }
    const error = new Error(`GitHub retornou HTTP ${response.status}`); error.status = response.status
    // Primary quota exhausted: callers can stop early and report when it resets.
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      error.rateLimited = true
      const reset = Number(response.headers.get('x-ratelimit-reset'))
      if (reset) error.resetAt = new Date(reset * 1000).toISOString()
    }
    throw error
  }
  return response.json()
}
export async function inventory({ privateRepos = false, user = process.env.GH_USER || 'juninmd' } = {}) {
  const token = credential()
  if (privateRepos && !token) throw new Error('Autentique com gh auth login para consultar o inventário privado.')
  if (privateRepos && (await api('user', { token })).login.toLowerCase() !== user.toLowerCase()) throw new Error('GH_USER precisa ser o usuário autenticado.')
  const repos = []
  for (let page = 1; ; page++) {
    const path = privateRepos ? `user/repos?affiliation=owner&sort=updated&per_page=100&page=${page}` : `users/${encodeURIComponent(user)}/repos?type=owner&sort=updated&per_page=100&page=${page}`
    const batch = await api(path, { token })
    for (const r of batch) {
      if (r.owner.login.toLowerCase() !== user.toLowerCase() || (!privateRepos && r.private)) continue
      repos.push({ name: r.name, owner: r.owner.login, description: redact(r.description || ''), url: r.html_url,
        private: r.private, fork: r.fork, archived: r.archived, language: r.language, stars: r.stargazers_count,
        topics: r.topics || [], pushed_at: r.pushed_at, updated_at: r.updated_at, created_at: r.created_at, branch: r.default_branch })
    }
    if (batch.length < 100) break
  }
  return repos
}
export async function readme(repo) {
  try {
    const data = await api(`repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/readme`)
    return { status: 'ok', path: data.path, text: redact(Buffer.from(data.content, 'base64').toString('utf8')) }
  } catch (error) {
    if (error.status === 404) return { status: 'missing', text: '' }
    return { status: 'error', text: '', message: error.message }
  }
}
