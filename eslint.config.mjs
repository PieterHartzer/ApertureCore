// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    standalone: true
  },
  dirs: {
    pages: ['app/pages'],
    composables: ['app/composables', 'app/utils'],
    components: ['app/components'],
    componentsPrefixed: [],
    layouts: ['app/layouts'],
    plugins: ['app/plugins'],
    middleware: ['app/middleware'],
    modules: ['modules'],
    servers: [],
    root: [],
    src: ['app']
  }
})
