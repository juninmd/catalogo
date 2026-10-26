# AGENTS.md

## Tech Stack
- **Language:** JavaScript (ESM)
- **Framework:** VitePress 1.6
- **Runtime:** Node >=18
- **Package Manager:** pnpm
- **Search:** @docsearch/js, @algolia/client-search

## Project Structure
```
catalogo/
  docs/               # VitePress site sources
    .vitepress/       # VitePress config
    public/           # Static assets
    index.md          # Home page
    repositorios.md   # Static page that reads the generated catalog
  scripts/
    generate.mjs      # GitHub API fetch -> docs/public/catalog.json (public repos only)
  package.json
```

## Commands
- `pnpm generate` - Fetch public repos into `docs/public/catalog.json`
- `pnpm dev` - Start the VitePress dev server (run `pnpm generate` first)
- `pnpm build` - Generate + build for production
- `pnpm preview` - Preview built site
- `pnpm stack:collect | stack:who <dep> | stack:report` - Local cross-repo dependency/CI index (`.catalog/stack.json`, never published)

## Conventions
- ES modules (`"type": "module"`)
- Node.js scripting for code generation
- VitePress markdown-based pages

## MCP
- `pnpm mcp` - Servidor MCP (stdio) que expõe `docs/public/catalog.json` (rode `pnpm generate` antes)
- Ferramentas: `list_repos`, `search_repos`, `get_repo`, `list_categories`
- `.mcp.json` registra o servidor `catalogo` para o Claude Code

<!-- base-actions-main-policy -->
## GitHub Actions — padrão obrigatório (@main)

- Referencie as actions internas sempre pelo branch, nunca por SHA:
  - `uses: juninmd/base-actions/<action>@main`
  - `uses: juninmd/base-actions/.github/workflows/<arquivo>.yml@main`
- Não fixe `@<sha>` em `juninmd/base-actions`: a atualização é centralizada no
  `main` e passa a valer no próximo run.
- PRs cujos checks não iniciam por billing/spending limit são mesclados pelo bot central
  `juninmd/base-actions/.github/workflows/auto-merge-billing-blocked.yml`.
  Para impedir o merge automático de um PR, aplique a label `do-not-merge`.