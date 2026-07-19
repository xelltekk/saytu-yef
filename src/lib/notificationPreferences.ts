export type NotificationPreferences = {
  lowStock: boolean
}

export const NOTIFICATION_SETTINGS_KEY = 'saytu-yef:notification-preferences'

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  lowStock: true,
}

export function loadNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_NOTIFICATION_PREFERENCES
  }

  try {
    const rawValue = window.localStorage.getItem(NOTIFICATION_SETTINGS_KEY)
    if (!rawValue) return DEFAULT_NOTIFICATION_PREFERENCES

    const parsedValue = JSON.parse(rawValue) as Partial<NotificationPreferences>
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsedValue,
    }
  } catch (error) {
    console.warn('notification_preferences_load_failed', error)
    return DEFAULT_NOTIFICATION_PREFERENCES
  }
}
