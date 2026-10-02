import { defineConfig } from 'vitepress'
const base = process.env.CATALOG_BASE || '/'
export default defineConfig({
  title: 'Atlas · Catálogo', description: 'Sua biblioteca de aplicações, ideias e ferramentas.', lang: 'pt-BR', base,
  cleanUrls: true,
  head: [ ['link', { rel: 'manifest', href: `${base}manifest.webmanifest` }],
    ['link', { rel: 'icon', href: `${base}icon.svg`, type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#111d23' }] ],
  themeConfig: { nav: [{ text: 'Biblioteca', link: '/' }, { text: 'GitHub', link: 'https://github.com/juninmd' }],
    footer: { message: 'Atlas · Um lugar para todas as suas ideias.' } }
})
