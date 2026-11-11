/**
 * Messages refer to the product by @:{'app.name'}. The name comes from the app
 * config (brand.name), so a layer can rename the product in one place. It is
 * not in the locale files, so loading them later never overwrites it.
 */
export default defineNuxtPlugin({
  name: 'brand-name',
  dependsOn: ['i18n:plugin'],
  setup(nuxtApp) {
    const name = useAppConfig().brand.name
    const i18n = nuxtApp.$i18n as {
      availableLocales: string[]
      mergeLocaleMessage: (locale: string, message: Record<string, unknown>) => void
    }

    for (const locale of i18n.availableLocales) {
      i18n.mergeLocaleMessage(locale, { app: { name } })
    }
  }
})
