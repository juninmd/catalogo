# Catálogo de Repositórios

> Catálogo automático de repositórios GitHub do usuário **juninmd**, gerado estaticamente com VitePress.

![VitePress](https://img.shields.io/badge/VitePress-1.6-4FC08D?logo=vitepress)
![Node](https://img.shields.io/badge/Node-%3E=18-339933?logo=nodedotjs)
![License](https://img.shields.io/badge/License-MIT-green)

## Sobre

Gera automaticamente um site de documentação listando todos os repositórios do usuário **juninmd** no GitHub. Utiliza VitePress para gerar páginas estáticas a partir de um script Node.js que consulta a API do GitHub.

## Funcionalidades

- Geração automática da lista de repositórios
- Site estático rápido com VitePress
- Deploy simplificado (GitHub Pages ou Netlify)
- Atualização via comando NPM

## Stack Tecnológico

- **Framework:** VitePress 1.6
- **Linguagem:** JavaScript (ESM)
- **Scripting:** Node.js
- **Busca:** DocSearch (Algolia)

## Instalação

```bash
git clone https://github.com/juninmd/catalogo.git
cd catalogo
pnpm install
```

## Uso

```bash
# Gerar lista de repositórios e iniciar dev server
pnpm dev

# Gerar build de produção
pnpm build

# Preview do build
pnpm preview
```

## Licença

MIT
