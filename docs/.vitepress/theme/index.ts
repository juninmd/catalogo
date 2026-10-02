import DefaultTheme from 'vitepress/theme'
import CatalogApp from './CatalogApp.vue'
import './style.css'
import type { Theme } from 'vitepress'
export default {
  extends: DefaultTheme,
  Layout: CatalogApp,
  enhanceApp({ app }) { app.component('CatalogApp', CatalogApp) }
} satisfies Theme
