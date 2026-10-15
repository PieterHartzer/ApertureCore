export const useObservedElementSize = <T extends HTMLElement>() => {
  const element = ref<T | null>(null)
  const width = ref(0)
  const height = ref(0)
  let resizeObserver: ResizeObserver | null = null
  let disposed = false

  const resolveElement = () => {
    const target = element.value as unknown
    const candidate = target && typeof target === 'object' && '$el' in target
      ? target.$el
      : target
    return typeof HTMLElement !== 'undefined' && candidate instanceof HTMLElement
      ? candidate
      : null
  }

  const syncSize = () => {
    const target = resolveElement()
    width.value = target?.clientWidth ?? 0
    height.value = target?.clientHeight ?? 0
  }

  onMounted(async () => {
    await nextTick()
    if (disposed) return
    syncSize()
    const target = resolveElement()
    if (!target || typeof ResizeObserver === 'undefined') return
    resizeObserver = new ResizeObserver(syncSize)
    resizeObserver.observe(target)
  })

  onBeforeUnmount(() => {
    disposed = true
    resizeObserver?.disconnect()
    resizeObserver = null
  })

  return { element, width, height }
}
