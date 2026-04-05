import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Catálogo · juninmd',
  description: 'Catálogo automático de todos os repositórios de juninmd',
  lang: 'pt-BR',
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
        {
          text: 'Por Linguagem',
          items: [
          { text: 'JavaScript (104)', link: '/repositorios#javascript' },
          { text: 'TypeScript (103)', link: '/repositorios#typescript' },
          { text: 'Outros (80)', link: '/repositorios#outros' },
          { text: 'C# (37)', link: '/repositorios#c-' },
          { text: 'Python (29)', link: '/repositorios#python' },
          { text: 'Java (20)', link: '/repositorios#java' },
          { text: 'HTML (15)', link: '/repositorios#html' },
          { text: 'Shell (4)', link: '/repositorios#shell' },
          { text: 'Kotlin (4)', link: '/repositorios#kotlin' },
          { text: 'C (4)', link: '/repositorios#c' }
          ],
        },
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

    editLink: {
      pattern: 'https://github.com/juninmd/catalogo',
      text: 'Ver no GitHub',
    },
  },
})
