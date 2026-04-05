/**
 * generate.mjs — Busca todos os repositórios do GitHub e gera as páginas VitePress
 *
 * Variáveis de ambiente:
 *   GH_TOKEN  — Personal Access Token (leitura de repos privados)
 *   GH_USER   — Username do GitHub (default: juninmd)
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR  = join(__dirname, "../docs");
const GH_TOKEN  = process.env.GH_TOKEN;
const GH_USER   = process.env.GH_USER || "juninmd";

// ─── GitHub API ───────────────────────────────────────────────────────────────

async function ghFetch(path) {
  const headers = {
    "Accept":               "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GH_TOKEN) headers["Authorization"] = `Bearer ${GH_TOKEN}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchAllRepos() {
  const repos = [];
  let page = 1;

  while (true) {
    // /user/repos inclui repos privados quando autenticado
    // /users/:user/repos só retorna públicos
    const endpoint = GH_TOKEN
      ? `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner`
      : `/users/${GH_USER}/repos?per_page=100&page=${page}&sort=updated`;

    const batch = await ghFetch(endpoint);
    if (!batch.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return repos;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LANG_COLORS = {
  JavaScript:  "#f1e05a",
  TypeScript:  "#3178c6",
  Python:      "#3572A5",
  Shell:       "#89e051",
  Go:          "#00ADD8",
  Rust:        "#dea584",
  Java:        "#b07219",
  "C#":        "#178600",
  CSS:         "#563d7c",
  HTML:        "#e34c26",
  Vue:         "#41b883",
  Dockerfile:  "#384d54",
  HCL:         "#844FBA",
  YAML:        "#cb171e",
};

function langBadge(lang) {
  if (!lang) return "";
  const color = LANG_COLORS[lang] || "#888";
  return `<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>${lang}</span>`;
}

function visiBadge(isPrivate) {
  return isPrivate
    ? `<span style="background:#f0ad4e22;color:#f0ad4e;padding:1px 6px;border-radius:4px;font-size:11px;border:1px solid #f0ad4e55">🔒 privado</span>`
    : `<span style="background:#2da44e22;color:#2da44e;padding:1px 6px;border-radius:4px;font-size:11px;border:1px solid #2da44e55">🌐 público</span>`;
}

function relativeDate(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7)  return `${days}d atrás`;
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Geradores de página ──────────────────────────────────────────────────────

function generateHomePage(repos, updatedAt) {
  const total    = repos.length;
  const pubblic  = repos.filter(r => !r.private).length;
  const privat   = repos.filter(r => r.private).length;
  const forked   = repos.filter(r => r.fork).length;
  const original = total - forked;

  // Top 5 linguagens
  const langCount = {};
  for (const r of repos) {
    if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
  }
  const topLangs = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Últimos 6 atualizados (não forks)
  const recent = repos
    .filter(r => !r.fork && !r.archived)
    .slice(0, 6);

  const featuresCards = [
    { icon: "📦", title: `${total} Repositórios`, details: `${original} originais · ${forked} forks` },
    { icon: "🌐", title: `${pubblic} Públicos`, details: `Acessíveis por qualquer pessoa` },
    { icon: "🔒", title: `${privat} Privados`, details: `Visíveis apenas para você` },
    { icon: "💻", title: `Top linguagem`, details: topLangs[0] ? `${topLangs[0][0]} (${topLangs[0][1]} repos)` : "—" },
  ].map(f => `  - icon: "${f.icon}"\n    title: "${f.title}"\n    details: "${f.details}"`).join("\n");

  const recentSection = recent.map(r => {
    const desc = (r.description || "Sem descrição").replace(/"/g, "'");
    const lang = r.language || "";
    return `| [**${r.name}**](${r.html_url}) | ${desc} | ${lang} | ${relativeDate(r.updated_at)} |`;
  }).join("\n");

  return `---
layout: home
title: Catálogo de Repositórios

hero:
  name: "juninmd"
  text: "Catálogo de Repositórios"
  tagline: "${total} repositórios · ${pubblic} públicos · ${privat} privados · atualizado em ${formatDate(updatedAt)}"
  actions:
    - theme: brand
      text: Ver todos os repositórios →
      link: /repositorios
    - theme: alt
      text: GitHub
      link: https://github.com/${GH_USER}

features:
${featuresCards}
---

## Atualizados recentemente

| Repositório | Descrição | Linguagem | Atualizado |
|---|---|---|---|
${recentSection}

<div style="text-align:center;margin-top:2rem">
  <a href="/repositorios" style="background:var(--vp-c-brand-1);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">
    Ver os ${total} repositórios →
  </a>
</div>
`;
}

function generateReposPage(repos, updatedAt) {
  // Agrupa por linguagem
  const groups = {};
  for (const r of repos) {
    const lang = r.language || "Outros";
    if (!groups[lang]) groups[lang] = [];
    groups[lang].push(r);
  }

  // Linguagens ordenadas por quantidade
  const sortedLangs = Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length);

  const sections = sortedLangs.map(([lang, list]) => {
    const rows = list
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .map(r => {
        const desc  = (r.description || "*Sem descrição*").replace(/\|/g, "\\|");
        const stars = r.stargazers_count > 0 ? ` ⭐${r.stargazers_count}` : "";
        const fork  = r.fork ? " 🍴" : "";
        const arch  = r.archived ? " 📦" : "";
        const name  = `[${r.name}${stars}${fork}${arch}](${r.html_url})`;
        return `| ${name} | ${desc} | ${visiBadge(r.private)} | ${relativeDate(r.updated_at)} |`;
      })
      .join("\n");

    return `## ${langBadge(lang)} ${lang} <Badge text="${list.length}" type="info" />

| Repositório | Descrição | Visibilidade | Atualizado |
|---|---|:---:|:---:|
${rows}
`;
  }).join("\n");

  return `# Todos os Repositórios

> **${repos.length} repositórios** · Atualizado em ${formatDate(updatedAt)}
> Legenda: ⭐ estrelas · 🍴 fork · 📦 arquivado

${sections}
`;
}

function generateVitepressConfig(repos) {
  // Linguagens para sidebar
  const langCount = {};
  for (const r of repos) {
    const lang = r.language || "Outros";
    langCount[lang] = (langCount[lang] || 0) + 1;
  }
  const topLangs = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lang, count]) => `{ text: '${lang} (${count})', link: '/repositorios#${lang.toLowerCase().replace(/[^a-z0-9]/g, "-")}' }`)
    .join(",\n          ");

  return `import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Catálogo · juninmd',
  description: 'Catálogo automático de todos os repositórios de juninmd',
  lang: 'pt-BR',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: 'https://github.com/${GH_USER}.png', type: 'image/png' }],
  ],

  themeConfig: {
    logo: 'https://github.com/${GH_USER}.png',

    nav: [
      { text: 'Início', link: '/' },
      { text: 'Repositórios', link: '/repositorios' },
      { text: 'GitHub', link: 'https://github.com/${GH_USER}', target: '_blank' },
    ],

    sidebar: {
      '/repositorios': [
        {
          text: 'Por Linguagem',
          items: [
          ${topLangs}
          ],
        },
      ],
    },

    search: { provider: 'local' },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/${GH_USER}' },
    ],

    footer: {
      message: 'Atualizado automaticamente todo dia via GitHub Actions',
      copyright: 'juninmd · ${new Date().getFullYear()}',
    },

    editLink: {
      pattern: 'https://github.com/${GH_USER}/catalogo',
      text: 'Ver no GitHub',
    },
  },
})
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔍 Buscando repositórios de @${GH_USER}...`);
  if (!GH_TOKEN) {
    console.warn("⚠️  GH_TOKEN não definido — apenas repos públicos serão listados.");
  }

  const repos = await fetchAllRepos();
  const updatedAt = new Date().toISOString();

  console.log(`✅ ${repos.length} repositórios encontrados.`);

  // Garante que os diretórios existem
  mkdirSync(join(DOCS_DIR, ".vitepress"), { recursive: true });

  // Gera os arquivos
  writeFileSync(join(DOCS_DIR, "index.md"),          generateHomePage(repos, updatedAt),       "utf-8");
  writeFileSync(join(DOCS_DIR, "repositorios.md"),   generateReposPage(repos, updatedAt),      "utf-8");
  writeFileSync(join(DOCS_DIR, ".vitepress/config.mts"), generateVitepressConfig(repos),       "utf-8");

  console.log("📄 Páginas geradas:");
  console.log("   docs/index.md");
  console.log("   docs/repositorios.md");
  console.log("   docs/.vitepress/config.mts");
  console.log(`🕐 Atualizado em: ${new Date(updatedAt).toLocaleString("pt-BR")}`);
}

main().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});
