import { computed, defineComponent, onMounted, ref } from 'vue'

export default defineComponent({
  setup() {
    const isOpen = ref(false)
    const showMenu = ref(false)
    const {
      public: { devToolsLinks },
    } = useRuntimeConfig()

    onMounted(() => {
      showMenu.value = import.meta.dev && Boolean(devToolsLinks?.enabled)
    })

    const links = computed(() => {
      const items = [
        {
          href: devToolsLinks?.mailInboxUrl,
          label: 'Mail Inbox',
        },
        {
          href: devToolsLinks?.providerConsoleUrl,
          label: 'Dev Provider Console',
        },
      ]

      return items.filter((item) => Boolean(item.href))
    })

    return {
      isOpen,
      links,
      showMenu
    }
  }
})
