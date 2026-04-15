import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Catálogo · juninmd',
  description: 'Catálogo automático de todos os repositórios de juninmd',
  lang: 'pt-BR',
  base: '/catalogo/',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: 'https://github.com/juninmd.png', type: 'image/png' }],
  ],

  themeConfig: {
    logo: 'https://github.com/juninmd.png',

    nav: [
      { text: 'Início', link: '/catalogo/' },
      { text: 'Repositórios', link: '/catalogo/repositorios' },
      { text: 'GitHub', link: 'https://github.com/juninmd', target: '_blank' },
    ],

    sidebar: {
      '/repositorios': [
        { text: 'Top linguagens', items: [{ text: 'JavaScript (105)', link: '/catalogo/repositorios' },
          { text: 'TypeScript (104)', link: '/catalogo/repositorios' },
          { text: 'C# (37)', link: '/catalogo/repositorios' },
          { text: 'Python (30)', link: '/catalogo/repositorios' },
          { text: 'Java (20)', link: '/catalogo/repositorios' },
          { text: 'HTML (15)', link: '/catalogo/repositorios' },
          { text: 'Shell (4)', link: '/catalogo/repositorios' },
          { text: 'Dockerfile (4)', link: '/catalogo/repositorios' },
          { text: 'Kotlin (4)', link: '/catalogo/repositorios' },
          { text: 'C (4)', link: '/catalogo/repositorios' },
          { text: 'Go (4)', link: '/catalogo/repositorios' },
          { text: 'CSS (4)', link: '/catalogo/repositorios' }] },
      ],
    },

    search: { provider: 'local' },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/juninmd' },
    ],

    footer: {
      message: 'Atualizado automaticamente todo dia via GitHub Actions',
      copyright: 'juninmd · 2026',
    },
  },
})
