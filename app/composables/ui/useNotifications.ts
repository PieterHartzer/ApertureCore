import type { FeedbackKind } from '../../theme/feedback'

import { FEEDBACK_THEME } from '../../theme/feedback'

type NotificationKind = FeedbackKind
const DEFAULT_AUTO_DISMISS_MS = 5000

export interface AppNotification {
  kind: NotificationKind
  title?: string
  message: string
}

interface PushNotificationOptions {
  autoDismissMs?: number
}

export const useNotifications = () => {
  const toast = useToast()

  const push = (
    notification: AppNotification,
    options: PushNotificationOptions = {}
  ) => {
    const theme = FEEDBACK_THEME[notification.kind]

    toast.add({
      title: notification.title,
      description: notification.message,
      color: theme.color,
      icon: theme.icon,
      duration: options.autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS
    })
  }

  const success = (message: string, title = 'Success') => {
    return push({ kind: 'success', title, message })
  }

  const error = (message: string, title = 'Error') => {
    return push({ kind: 'error', title, message })
  }

  return {
    push,
    success,
    error
  }
}
