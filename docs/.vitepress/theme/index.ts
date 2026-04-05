import DefaultTheme from 'vitepress/theme'
import RepoTable from './RepoTable.vue'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('RepoTable', RepoTable)
  },
} satisfies Theme
