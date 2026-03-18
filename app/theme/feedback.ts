export type FeedbackKind = 'success' | 'error' | 'info' | 'warning'

interface FeedbackThemeEntry {
  color: FeedbackKind
  icon: string
}

export const FEEDBACK_THEME: Record<FeedbackKind, FeedbackThemeEntry> = {
  success: {
    color: 'success',
    icon: 'i-lucide-circle-check-big'
  },
  error: {
    color: 'error',
    icon: 'i-lucide-circle-alert'
  },
  info: {
    color: 'info',
    icon: 'i-lucide-info'
  },
  warning: {
    color: 'warning',
    icon: 'i-lucide-triangle-alert'
  }
}
