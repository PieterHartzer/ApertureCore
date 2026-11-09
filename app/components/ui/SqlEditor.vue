<script setup lang="ts">
import type { Compartment } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

const props = defineProps<{
  modelValue: string
  databaseType: string
  schema: string
  label: string
  placeholder?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string], 'run': [] }>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null
let disposed = false
let languageSlot: Compartment | null = null
let editableSlot: Compartment | null = null
let languageFor: typeof import('~/utils/sql-editor-language').sqlLanguageFor | null = null
let editableExtension: ((enabled: boolean) => import('@codemirror/state').Extension) | null = null

// Loaded on demand so the editor only costs pages that show it.
onMounted(async () => {
  const [state, editorView, commands, language, autocomplete, highlight, sqlLanguage] = await Promise.all([
    import('@codemirror/state'),
    import('@codemirror/view'),
    import('@codemirror/commands'),
    import('@codemirror/language'),
    import('@codemirror/autocomplete'),
    import('@lezer/highlight'),
    import('~/utils/sql-editor-language')
  ])

  if (disposed || !host.value) return

  const { tags } = highlight
  const highlightStyle = language.HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--sql-keyword)', fontWeight: '500' },
    { tag: [tags.string, tags.special(tags.string)], color: 'var(--sql-string)' },
    { tag: [tags.number, tags.bool, tags.null], color: 'var(--sql-number)' },
    { tag: [tags.typeName, tags.standard(tags.name)], color: 'var(--sql-type)' },
    { tag: [tags.lineComment, tags.blockComment], color: 'var(--ui-text-dimmed)', fontStyle: 'italic' }
  ])
  const theme = editorView.EditorView.theme({
    '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent', color: 'var(--ui-text-highlighted)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '20px', overflow: 'auto' },
    '.cm-content': { padding: '12px 0', caretColor: 'var(--ui-primary)' },
    '.cm-cursor': { borderLeftColor: 'var(--ui-primary)' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--ui-text-dimmed)' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in oklab, var(--ui-bg-accented) 30%, transparent)' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in oklab, var(--ui-primary) 35%, transparent)' },
    '.cm-placeholder': { color: 'var(--ui-text-dimmed)' },
    '.cm-tooltip': { backgroundColor: 'var(--ui-bg-elevated)', border: '1px solid var(--ui-border)', borderRadius: '8px', overflow: 'hidden' },
    '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', fontSize: '12px', maxHeight: '16rem' },
    '.cm-tooltip-autocomplete > ul > li': { padding: '4px 10px', color: 'var(--ui-text)' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--ui-primary)', color: '#ffffff' },
    '.cm-completionDetail': { color: 'var(--ui-text-muted)', fontStyle: 'normal' }
  })

  languageSlot = new state.Compartment()
  editableSlot = new state.Compartment()
  languageFor = sqlLanguage.sqlLanguageFor
  editableExtension = enabled => [editorView.EditorView.editable.of(enabled), state.EditorState.readOnly.of(!enabled)]

  view = new editorView.EditorView({
    parent: host.value,
    state: state.EditorState.create({
      doc: props.modelValue,
      extensions: [
        editorView.lineNumbers(),
        editorView.highlightActiveLine(),
        editorView.highlightActiveLineGutter(),
        editorView.drawSelection(),
        commands.history(),
        language.indentOnInput(),
        language.bracketMatching(),
        autocomplete.closeBrackets(),
        autocomplete.autocompletion({ icons: false }),
        language.syntaxHighlighting(highlightStyle),
        // Fixed tooltips would otherwise be clipped by the panel's backdrop blur.
        editorView.tooltips({ parent: document.body }),
        editorView.EditorView.lineWrapping,
        editorView.placeholder(props.placeholder ?? ''),
        editorView.EditorView.contentAttributes.of({ 'aria-label': props.label }),
        state.Prec.highest(editorView.keymap.of([
          { key: 'Mod-Enter', run: () => { emit('run'); return true } },
          { key: 'Tab', run: autocomplete.acceptCompletion }
        ])),
        editorView.keymap.of([...autocomplete.closeBracketsKeymap, ...autocomplete.completionKeymap, ...commands.defaultKeymap, ...commands.historyKeymap]),
        languageSlot.of(languageFor(props.databaseType, props.schema)),
        editableSlot.of(editableExtension(!props.disabled)),
        theme,
        editorView.EditorView.updateListener.of((update) => {
          if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
        })
      ]
    })
  })
})

watch(() => props.modelValue, (value) => {
  if (view && value !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }
})
watch([() => props.databaseType, () => props.schema], () => {
  if (view && languageSlot && languageFor) view.dispatch({ effects: languageSlot.reconfigure(languageFor(props.databaseType, props.schema)) })
})
watch(() => props.disabled, (disabled) => {
  if (view && editableSlot && editableExtension) view.dispatch({ effects: editableSlot.reconfigure(editableExtension(!disabled)) })
})
onBeforeUnmount(() => {
  disposed = true
  view?.destroy()
  view = null
})
</script>

<template>
  <div class="relative min-h-64 flex-1 lg:min-h-0">
    <div ref="host" class="absolute inset-0" />
  </div>
</template>
