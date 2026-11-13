import { defineComponent } from 'vue'

import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import AppBrand from '~/components/ui/AppBrand.vue'

export default defineComponent({
  components: {
    AppAlert,
    AppBrand,
    AppLocaleSelect
  },
  async setup() {
    const config = useRuntimeConfig()
    const oidcConfigured = config.public.oidcConfigured
    const route = useRoute()
    const { t } = useI18n()

    const callbackRedirectUrl =
      typeof route.query.callbackRedirectUrl === 'string' && route.query.callbackRedirectUrl.startsWith('/')
        ? route.query.callbackRedirectUrl
        : '/'

    if (oidcConfigured) {
      await navigateTo(
        {
          path: '/auth/oidc/login',
          query: {
            callbackRedirectUrl
          }
        },
        {
          external: true,
          replace: true
        }
      )
    }

    return {
      callbackRedirectUrl,
      oidcConfigured,
      t
    }
  }
})
