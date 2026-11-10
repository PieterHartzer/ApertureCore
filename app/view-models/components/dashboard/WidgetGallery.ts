import { computed, defineComponent, ref, watch, type PropType } from 'vue'

import WidgetSample from '~/components/dashboard/WidgetSample.vue'
import { useUIPlugins } from '~/composables/useUIPlugins'
import type { WidgetPickerItem } from '~/extensions'
import { getUIPluginInputSource, type PluginInputDefinition, type UIPluginDefinition } from '~/types/uiPlugin'

const GROUP_ORDER = ['kpi', 'trend', 'compare', 'parts', 'distribution', 'flow', 'table']
const EXAMPLE_ROWS = 5

/**
 * Shows every widget drawn from sample data, with when to use it and what
 * columns it needs, so people can choose without knowing chart names.
 */
export default defineComponent({
  components: {
    WidgetSample
  },
  props: {
    open: {
      type: Boolean,
      default: false
    },
    // The same arranged list the plugin picker shows, including plan labels.
    items: {
      type: Array as PropType<WidgetPickerItem[]>,
      default: () => []
    },
    selectedId: {
      type: String,
      default: ''
    }
  },
  emits: ['update:open', 'select'],
  setup(props, { emit }) {
    const { t, te } = useI18n()
    const { getPlugin } = useUIPlugins()
    const search = ref('')
    const activeGroup = ref('all')
    const focusedId = ref('')

    const translated = (key: string | undefined, fallback = '') => key && te(key) ? t(key) : fallback

    const typeList = (input: PluginInputDefinition) => {
      const types = input.compatibleFieldTypes?.length ? input.compatibleFieldTypes : ['string', 'number', 'date']

      return types.map(type => t(`pages.dashboard.builder.mapping.types.${type}`)).join(', ')
    }

    const describe = (plugin: UIPluginDefinition, item: { label: string, trailingLabel?: string }) => {
      const columns = Object.keys(plugin.sample?.rows[0] ?? {})

      return {
        id: plugin.id,
        label: item.label,
        trailingLabel: item.trailingLabel,
        group: plugin.group ?? 'other',
        description: translated(plugin.descriptionKey, plugin.description ?? ''),
        useWhen: translated(`pages.dashboard.plugins.${plugin.id}.useWhen`),
        sample: plugin.sample,
        columns,
        exampleRows: (plugin.sample?.rows ?? []).slice(0, EXAMPLE_ROWS),
        moreRows: Math.max((plugin.sample?.rows.length ?? 0) - EXAMPLE_ROWS, 0),
        needs: plugin.inputSchema
          .filter(input => getUIPluginInputSource(input) === 'field' && input.required)
          .map(input => ({ label: translated(input.labelKey, input.label), types: typeList(input) }))
      }
    }

    const entries = computed(() => props.items.flatMap((item) => {
      if (!('value' in item)) return []

      const plugin = getPlugin(item.value)

      return plugin ? [describe(plugin, item)] : []
    }))

    const groups = computed(() => {
      const present = new Set(entries.value.map(entry => entry.group))
      const ordered = [...GROUP_ORDER, 'other'].filter(group => present.has(group))

      return [
        { id: 'all', label: t('pages.dashboard.gallery.groups.all') },
        ...ordered.map(group => ({ id: group, label: t(`pages.dashboard.gallery.groups.${group}`) }))
      ]
    })

    const matches = (entry: ReturnType<typeof describe>) => {
      const query = search.value.trim().toLowerCase()

      return (activeGroup.value === 'all' || entry.group === activeGroup.value)
        && (!query || [entry.label, entry.description, entry.useWhen].some(text => text.toLowerCase().includes(query)))
    }

    // Widgets on the current plan first, the rest under their plan's name.
    const sections = computed(() => {
      const visible = entries.value.filter(matches)
      const others = visible.filter(entry => entry.trailingLabel)

      return [
        { id: 'included', title: others.length ? t('pages.dashboard.gallery.included') : '', items: visible.filter(entry => !entry.trailingLabel) },
        { id: 'others', title: t('pages.dashboard.gallery.others'), items: others }
      ]
    })

    const focused = computed(() => entries.value.find(entry => entry.id === focusedId.value)
      ?? sections.value.flatMap(section => section.items)[0]
      ?? null)

    watch(() => props.open, (open) => {
      if (open) {
        search.value = ''
        activeGroup.value = 'all'
        focusedId.value = props.selectedId
      }
    }, { immediate: true })

    const details = ref<HTMLElement | null>(null)

    // On narrow screens the details sit below the list, so bring them into view.
    const focus = (id: string) => {
      focusedId.value = id

      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        requestAnimationFrame(() => details.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    }

    const choose = (id: string) => {
      emit('select', id)
      emit('update:open', false)
    }

    return {
      activeGroup,
      choose,
      details,
      focus,
      focused,
      focusedId,
      groups,
      search,
      sections,
      t
    }
  }
})
