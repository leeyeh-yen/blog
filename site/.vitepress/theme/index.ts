import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/900.css'
import './styles.css'

export default {
  Layout,
  enhanceApp({ router }) {
    router.onAfterRouteChanged = () => {
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
    }
  },
} satisfies Theme
