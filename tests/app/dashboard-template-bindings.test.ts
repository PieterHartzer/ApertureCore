import { readFileSync } from 'node:fs'
import { compileTemplate, parse } from 'vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

describe('dashboard template bindings', () => {
  it('exposes every template context reference from the view model', () => {
    const page = readFileSync(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
    const viewModel = readFileSync(new URL('../../app/view-models/pages/index.ts', import.meta.url), 'utf8')
    const { descriptor } = parse(page)
    const template = compileTemplate({
      source: descriptor.template!.content,
      filename: 'index.vue',
      id: 'dashboard-binding-test'
    })

    expect(template.errors).toEqual([])

    // This page uses an explicit shorthand return object at the end of setup.
    // Compile the real template so references in slots and event handlers count too.
    const returnedBindings = viewModel.match(/\n {4}return \{([^{}]+)\}\s*\}\s*\}\)\s*$/)
    expect(returnedBindings).not.toBeNull()
    const exposed = new Set([...returnedBindings![1]!.split(',').map((key) => key.trim()), '$t', 'localizeAppMessage'])
    const referenced = new Set(
      [...template.code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1]!)
    )

    expect([...referenced].filter((key) => !exposed.has(key))).toEqual([])
  })
})
