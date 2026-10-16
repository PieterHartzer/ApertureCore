import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileTemplate, parse } from 'vue/compiler-sfc'
import { isNavigationSectionActive } from '../../app/utils/navigation'
import { localizeAppMessage, localizeModelOptions } from '../../app/utils/localized-message'

const en = JSON.parse(readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8'))
const pseudo = JSON.parse(readFileSync(new URL('../../i18n/locales/pseudo.json', import.meta.url), 'utf8'))
const require = createRequire(import.meta.url)
const { createI18n } = require(fileURLToPath(new URL('../../node_modules/.pnpm/node_modules/vue-i18n', import.meta.url)))
const keys = (value: Record<string, unknown>, prefix = ''): string[] => Object.entries(value).flatMap(([key, child]) => typeof child === 'object' && child !== null ? keys(child as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`])
const allVueFiles = (folder: string): string[] => readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? allVueFiles(join(folder, entry.name)) : entry.name.endsWith('.vue') ? [join(folder, entry.name)] : [])

describe('shared application navigation', () => {
  it.each([
    ['/', '/', true], ['/queries/new', '/queries', true], ['/queries/123', '/queries', true],
    ['/connections/123', '/connections', true], ['/Queries/', '/queries', true],
    ['/settings/ai-models', '/settings/ai-models', true], ['/queries-other', '/queries', false],
    ['/queries', '/', false], ['/sql-workspace', '/queries', false]
  ])('highlights %s within %s: %s', (route, section, expected) => {
    expect(isNavigationSectionActive(route, section)).toBe(expected)
  })
  it('uses a labelled navigation landmark, ordinary links and an active-page announcement', () => {
    const source = readFileSync(new URL('../../app/components/ui/AppNavigation.vue', import.meta.url), 'utf8')
    const { descriptor } = parse(source)
    expect(compileTemplate({ source: descriptor.template!.content, filename: 'AppNavigation.vue', id: 'navigation' }).errors).toEqual([])
    expect(source).toContain("t('navigation.label')")
    expect(source).toContain(':aria-current=')
    expect(source).toContain('AppLocaleSelect')
    expect(source).toContain('overflow-x-auto')
    for (const route of ['/connections', '/queries', '/sql-workspace', '/settings/ai-models']) expect(source).toContain(`to: '${route}'`)
    const app = readFileSync(new URL('../../app/app.vue', import.meta.url), 'utf8')
    expect(app).toContain('import AppNavigation')
    expect(app).toContain('!route.meta.public')
    for (const file of allVueFiles(fileURLToPath(new URL('../../app/pages', import.meta.url)))) expect(readFileSync(file, 'utf8')).not.toContain('aria-label="Breadcrumb"')
  })
})

describe('interface localization', () => {
  it('has complete pseudo-locale coverage and compiles every interface message', () => {
    expect(keys(pseudo).sort()).toEqual(keys(en).sort())
    const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: false, messages: { en, pseudo }, missingWarn: false, fallbackWarn: false, warnHtmlMessage: false })
    for (const locale of ['en', 'pseudo']) {
      i18n.global.locale.value = locale
      for (const key of [...keys(en.navigation, 'navigation.'), ...keys(en.interface, 'interface.')]) {
        expect(i18n.global.te(key)).toBe(true)
        expect(i18n.global.t(key, { value1: 2, value2: 10, details: 'DETAIL', model: 'Qwen', memory: 512, cached: '', status: 400 })).not.toBe(key)
      }
    }
  })
  it('contains no untranslated static interface labels or text in Vue templates', () => {
    const untranslated: string[] = []
    const missingKeys: string[] = []
    const knownKeys = new Set(keys(en))
    type Node = { type: number, content?: string, name?: string, value?: { content: string }, props?: Node[], children?: Node[] }
    const labels = new Set(['label', 'title', 'description', 'headline', 'placeholder', 'aria-label', 'empty', 'alt'])
    for (const file of allVueFiles(fileURLToPath(new URL('../../app', import.meta.url)))) {
      const source = readFileSync(file, 'utf8')
      const { descriptor } = parse(source)
      const walk = (node: Node) => {
        if (node.type === 2 && /[A-Za-z]/.test(node.content ?? '')) untranslated.push(`${file}: ${node.content?.trim()}`)
        for (const prop of node.props ?? []) if (prop.type === 6 && labels.has(prop.name ?? '') && /[A-Za-z]/.test(prop.value?.content ?? '')) untranslated.push(`${file}: ${prop.name}`)
        for (const child of node.children ?? []) walk(child)
      }
      if (descriptor.template?.ast) walk(descriptor.template.ast as unknown as Node)
      for (const match of source.matchAll(/(?:\$t|\bt)\('([^']+)'/g)) if (!knownKeys.has(match[1]!)) missingKeys.push(`${file}: ${match[1]}`)
    }
    expect(untranslated).toEqual([])
    expect(missingKeys).toEqual([])
  })
  it('translates feedback and cached-model metadata reactively while preserving user and database data', () => {
    const i18n = createI18n({ legacy: false, locale: 'en', messages: { en, pseudo } })
    const translate = (key: string, parameters?: Record<string, unknown>) => i18n.global.t(key, parameters ?? {})
    const message = 'Your session has expired. Sign in again in a new tab, then return here and retry. Your query has not been changed.'
    expect(localizeAppMessage(translate, message)).toBe(message)
    i18n.global.locale.value = 'pseudo'
    expect(localizeAppMessage(translate, message)).not.toBe(message)
    const options = localizeModelOptions(translate, [{ value: 'model-id', label: 'Qwen · ~512 MB GPU · cached' }])
    expect(options[0]?.value).toBe('model-id')
    expect(options[0]?.label).toContain('Qwen')
    expect(options[0]?.label).toContain('512')
    expect(options[0]?.label).not.toContain('cached')
    expect(localizeAppMessage(translate, 'my_customer_table')).toBe('my_customer_table')
    expect(localizeAppMessage(translate, 'function date_trunc(unknown, text) does not exist')).toBe('function date_trunc(unknown, text) does not exist')
  })
})
