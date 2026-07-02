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
    repositorios.md   # Auto-generated repo list
  scripts/
    generate.mjs      # GitHub API fetch + site generation
  package.json
```

## Commands
- `pnpm generate` - Fetch repos and update site
- `pnpm dev` - Generate + start dev server
- `pnpm build` - Generate + build for production
- `pnpm preview` - Preview built site

## Conventions
- ES modules (`"type": "module"`)
- Node.js scripting for code generation
- VitePress markdown-based pages
