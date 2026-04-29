import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Catálogo · juninmd',
  description: 'Catálogo automático de todos os repositórios de juninmd',
  lang: 'pt-BR',
  base: '/',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: 'https://github.com/juninmd.png', type: 'image/png' }],
  ],

  themeConfig: {
    logo: 'https://github.com/juninmd.png',

    nav: [
      { text: 'Início', link: '/' },
      { text: 'Repositórios', link: '/repositorios' },
      { text: 'GitHub', link: 'https://github.com/juninmd', target: '_blank' },
    ],

    sidebar: {
      '/repositorios': [
        { text: 'Top linguagens', items: [{ text: 'TypeScript (107)', link: '/repositorios' },
          { text: 'JavaScript (104)', link: '/repositorios' },
          { text: 'C# (37)', link: '/repositorios' },
          { text: 'Python (31)', link: '/repositorios' },
          { text: 'Java (20)', link: '/repositorios' },
          { text: 'HTML (15)', link: '/repositorios' },
          { text: 'Kotlin (4)', link: '/repositorios' },
          { text: 'Dockerfile (4)', link: '/repositorios' },
          { text: 'Shell (4)', link: '/repositorios' },
          { text: 'C (4)', link: '/repositorios' },
          { text: 'Go (4)', link: '/repositorios' },
          { text: 'CSS (4)', link: '/repositorios' }] },
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
