import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const addMock = vi.fn()

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('useToast', vi.fn(() => ({
    add: addMock
  })))

  return (await import('../../../../../app/composables/ui/useNotifications')).useNotifications
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pushes success notifications to Nuxt UI toast', async () => {
    const useNotifications = await loadComposable()
    const notifications = useNotifications()

    notifications.success('Connected', 'Connection successful')

    expect(addMock).toHaveBeenCalledWith({
      title: 'Connection successful',
      description: 'Connected',
      color: 'success',
      icon: 'i-lucide-circle-check-big',
      duration: 5000
    })
  })

  it('pushes error notifications to Nuxt UI toast', async () => {
    const useNotifications = await loadComposable()
    const notifications = useNotifications()

    notifications.error('Failed', 'Connection failed')

    expect(addMock).toHaveBeenCalledWith({
      title: 'Connection failed',
      description: 'Failed',
      color: 'error',
      icon: 'i-lucide-circle-alert',
      duration: 5000
    })
  })

  it('allows custom auto dismiss duration', async () => {
    const useNotifications = await loadComposable()
    const notifications = useNotifications()

    notifications.push({
      kind: 'warning',
      title: 'Heads up',
      message: 'Review the settings'
    }, {
      autoDismissMs: 2500
    })

    expect(addMock).toHaveBeenCalledWith({
      title: 'Heads up',
      description: 'Review the settings',
      color: 'warning',
      icon: 'i-lucide-triangle-alert',
      duration: 2500
    })
  })
})
