import { computed, type ComputedRef } from 'vue'

import { appExtensions, type AppPermissions } from '~/extensions'

export const FULL_PERMISSIONS: AppPermissions = {
  editDashboards: true,
  editQueries: true,
  viewConnections: true,
  manageConnections: true
}

/**
 * What the signed-in person may change, used only to hide controls they
 * can't use. The server checks every request on its own. Everything is
 * allowed unless a layer says otherwise.
 */
export const useAppPermissions = (): ComputedRef<AppPermissions> => {
  const fromLayer = appExtensions.usePermissions?.()

  return computed(() => ({ ...FULL_PERMISSIONS, ...(fromLayer?.value ?? {}) }))
}
