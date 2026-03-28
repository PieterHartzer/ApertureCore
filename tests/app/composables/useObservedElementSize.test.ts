import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let mountedHook: (() => unknown | Promise<unknown>) | undefined
let beforeUnmountHook: (() => unknown) | undefined
let resizeObserverInstances: ResizeObserverMock[] = []

class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()

  constructor(private readonly callback: () => void) {
    resizeObserverInstances.push(this)
  }

  trigger() {
    this.callback()
  }
}

const loadComposable = async (withResizeObserver = true) => {
  vi.resetModules()
  mountedHook = undefined
  beforeUnmountHook = undefined
  resizeObserverInstances = []

  vi.stubGlobal('ref', <T>(value: T) => ({ value }))
  vi.stubGlobal('onMounted', (callback: () => unknown | Promise<unknown>) => {
    mountedHook = callback
  })
  vi.stubGlobal('onBeforeUnmount', (callback: () => unknown) => {
    beforeUnmountHook = callback
  })
  vi.stubGlobal('nextTick', vi.fn().mockResolvedValue(undefined))

  if (withResizeObserver) {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  } else {
    vi.stubGlobal('ResizeObserver', undefined)
  }

  return (await import('../../../app/composables/useObservedElementSize'))
    .useObservedElementSize
}

describe('useObservedElementSize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('syncs size and reacts to resize observer updates', async () => {
    const useObservedElementSize = await loadComposable()
    const observed = useObservedElementSize<HTMLElement>()
    const element = {
      clientWidth: 320,
      clientHeight: 180
    } as HTMLElement

    observed.element.value = element

    await mountedHook?.()

    expect(observed.width.value).toBe(320)
    expect(observed.height.value).toBe(180)
    expect(resizeObserverInstances).toHaveLength(1)
    expect(resizeObserverInstances[0]?.observe).toHaveBeenCalledWith(element)

    element.clientWidth = 480
    element.clientHeight = 240
    resizeObserverInstances[0]?.trigger()

    expect(observed.width.value).toBe(480)
    expect(observed.height.value).toBe(240)

    beforeUnmountHook?.()

    expect(resizeObserverInstances[0]?.disconnect).toHaveBeenCalledTimes(1)
  })

  it('still syncs initial size when ResizeObserver is unavailable', async () => {
    const useObservedElementSize = await loadComposable(false)
    const observed = useObservedElementSize<HTMLElement>()

    observed.element.value = {
      clientWidth: 200,
      clientHeight: 100
    } as HTMLElement

    await mountedHook?.()

    expect(observed.width.value).toBe(200)
    expect(observed.height.value).toBe(100)
    expect(resizeObserverInstances).toEqual([])

    expect(() => beforeUnmountHook?.()).not.toThrow()
  })

  it('keeps zero dimensions when no element is attached', async () => {
    const useObservedElementSize = await loadComposable()
    const observed = useObservedElementSize<HTMLElement>()

    await mountedHook?.()

    expect(observed.width.value).toBe(0)
    expect(observed.height.value).toBe(0)
    expect(resizeObserverInstances).toEqual([])
  })
})
