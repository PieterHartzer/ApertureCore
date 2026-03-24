export const useObservedElementSize = <T extends HTMLElement>() => {
  const element = ref<T | null>(null)
  const width = ref(0)
  const height = ref(0)
  let resizeObserver: ResizeObserver | null = null

  const syncSize = () => {
    width.value = element.value?.clientWidth ?? 0
    height.value = element.value?.clientHeight ?? 0
  }

  onMounted(async () => {
    await nextTick()
    syncSize()

    if (!element.value || typeof ResizeObserver === 'undefined') {
      return
    }

    resizeObserver = new ResizeObserver(() => {
      syncSize()
    })
    resizeObserver.observe(element.value)
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
  })

  return {
    element,
    width,
    height
  }
}
