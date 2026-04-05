/**
 * generate.mjs — Busca todos os repositórios via GitHub GraphQL API e gera os arquivos do site
 *
 * Vantagem do GraphQL: busca tudo em ~9 requests (430 repos / 50 por página)
 * em vez de 860+ chamadas REST para commits e contribuidores.
 *
 * Variáveis de ambiente:
 *   GH_TOKEN  — Personal Access Token (necessário para repos privados e commits)
 *   GH_USER   — Username do GitHub (default: juninmd)
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR   = join(__dirname, "../docs");
const PUBLIC_DIR = join(__dirname, "../docs/public");
const GH_TOKEN   = process.env.GH_TOKEN;
const GH_USER    = process.env.GH_USER || "juninmd";

// ─── GitHub GraphQL ───────────────────────────────────────────────────────────

const REPOS_QUERY = `
query($login: String!, $after: String) {
  user(login: $login) {
    repositories(
      first: 50
      after: $after
      ownerAffiliations: OWNER
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      nodes {
        name
        description
        url
        isPrivate
        isFork
        isArchived
        createdAt
        updatedAt
        pushedAt
        stargazerCount
        primaryLanguage { name }
        defaultBranchRef {
          target {
            ... on Commit {
              history { totalCount }
            }
          }
        }
        mentionableUsers { totalCount }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

async function graphql(query, variables = {}) {
  if (!GH_TOKEN) throw new Error("GH_TOKEN é obrigatório para a API GraphQL.");

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization":  `Bearer ${GH_TOKEN}`,
      "Content-Type":   "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message).join(", "));
  return json.data;
}

async function fetchAllRepos() {
  const repos = [];
  let after   = null;
  let page    = 1;

  do {
    process.stdout.write(`  página ${page}...`);
    const data = await graphql(REPOS_QUERY, { login: GH_USER, after });
    const { nodes, pageInfo } = data.user.repositories;

    for (const r of nodes) {
      repos.push({
        name:         r.name,
        description:  r.description || "",
        url:          r.url,
        private:      r.isPrivate,
        fork:         r.isFork,
        archived:     r.isArchived,
        language:     r.primaryLanguage?.name || null,
        stars:        r.stargazerCount,
        created_at:   r.createdAt,
        updated_at:   r.updatedAt,
        pushed_at:    r.pushedAt,
        commits:      r.defaultBranchRef?.target?.history?.totalCount ?? null,
        contributors: r.mentionableUsers?.totalCount ?? null,
      });
    }

    process.stdout.write(` ${nodes.length} repos\n`);
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
    page++;
  } while (after);

  return repos;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function relativeDate(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7)   return `${days}d atrás`;
  if (days < 30)  return `${Math.floor(days / 7)}sem atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

// ─── Gerador da home ──────────────────────────────────────────────────────────

function generateHomePage(repos, updatedAt) {
  const total    = repos.length;
  const pubblic  = repos.filter(r => !r.private).length;
  const privat   = repos.filter(r => r.private).length;
  const forked   = repos.filter(r => r.fork).length;
  const original = total - forked;

  const langCount = {};
  for (const r of repos) {
    if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
  }
  const topLang = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0];

  const featuresCards = [
    { icon: "📦", title: `${total} Repositórios`,  details: `${original} originais · ${forked} forks` },
    { icon: "🌐", title: `${pubblic} Públicos`,    details: `Acessíveis por qualquer pessoa` },
    { icon: "🔒", title: `${privat} Privados`,     details: `Visíveis apenas para você` },
    { icon: "💻", title: `Top linguagem`,           details: topLang ? `${topLang[0]} (${topLang[1]} repos)` : "—" },
  ].map(f => `  - icon: "${f.icon}"\n    title: "${f.title}"\n    details: "${f.details}"`).join("\n");

  const recent = repos.filter(r => !r.fork && !r.archived).slice(0, 6);
  const recentSection = recent.map(r => {
    const desc = (r.description || "Sem descrição").replace(/"/g, "'").substring(0, 80);
    return `| [**${r.name}**](${r.url}) | ${desc} | ${r.language || "—"} | ${relativeDate(r.pushed_at)} |`;
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
      link: /catalogo/repositorios
    - theme: alt
      text: GitHub
      link: https://github.com/${GH_USER}

features:
${featuresCards}
---

## Atualizados recentemente

| Repositório | Descrição | Linguagem | Último push |
|---|---|---|---|
${recentSection}

<div style="text-align:center;margin-top:2rem">
  <a href="/catalogo/repositorios" style="background:var(--vp-c-brand-1);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">
    Ver os ${total} repositórios com filtros →
  </a>
</div>
`;
}

// ─── Gerador da página de repositórios ───────────────────────────────────────

function generateReposPage() {
  return `---
title: Todos os Repositórios
---

# Todos os Repositórios

<RepoTable />
`;
}

// ─── Gerador da config VitePress ──────────────────────────────────────────────

function generateVitepressConfig(repos) {
  const langCount = {};
  for (const r of repos) {
    if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
  }
  const topLangs = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([lang, count]) => `{ text: '${lang} (${count})', link: '/catalogo/repositorios' }`)
    .join(",\n          ");

  return `import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Catálogo · juninmd',
  description: 'Catálogo automático de todos os repositórios de juninmd',
  lang: 'pt-BR',
  base: '/catalogo/',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: 'https://github.com/${GH_USER}.png', type: 'image/png' }],
  ],

  themeConfig: {
    logo: 'https://github.com/${GH_USER}.png',

    nav: [
      { text: 'Início', link: '/catalogo/' },
      { text: 'Repositórios', link: '/catalogo/repositorios' },
      { text: 'GitHub', link: 'https://github.com/${GH_USER}', target: '_blank' },
    ],

    sidebar: {
      '/repositorios': [
        { text: 'Top linguagens', items: [${topLangs}] },
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
  },
})
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔍 Buscando repositórios de @${GH_USER} via GraphQL...`);

  const repos      = await fetchAllRepos();
  const updatedAt  = new Date().toISOString();

  console.log(`✅ ${repos.length} repositórios encontrados.`);

  mkdirSync(join(DOCS_DIR, ".vitepress/theme"), { recursive: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });

  // Dados JSON para o componente Vue
  writeFileSync(
    join(PUBLIC_DIR, "repos.json"),
    JSON.stringify({ generated_at: updatedAt, repos }, null, 2),
    "utf-8"
  );

  // Páginas markdown
  writeFileSync(join(DOCS_DIR, "index.md"),          generateHomePage(repos, updatedAt), "utf-8");
  writeFileSync(join(DOCS_DIR, "repositorios.md"),   generateReposPage(),                "utf-8");
  writeFileSync(join(DOCS_DIR, ".vitepress/config.mts"), generateVitepressConfig(repos), "utf-8");

  console.log("📄 Arquivos gerados:");
  console.log("   docs/public/repos.json");
  console.log("   docs/index.md");
  console.log("   docs/repositorios.md");
  console.log("   docs/.vitepress/config.mts");
  console.log(`🕐 Atualizado em: ${new Date(updatedAt).toLocaleString("pt-BR")}`);
}

main().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});
