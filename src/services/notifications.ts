import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

import type { Message } from '../types/chat'

const notified = new Set<string>()

export async function initializeNotifications() {
  try {
    if (await isPermissionGranted()) return true

    return (await requestPermission()) === 'granted'
  } catch (error) {
    console.warn('[Notifications]', error)
    return false
  }
}

function messagePreview(message: Message): string {
  if (message.content?.trim()) {
    return message.content.trim().slice(0, 160)
  }

  switch (message.type) {
    case 'IMAGE':
      return 'Wysano zdjcie'
    case 'VIDEO':
      return 'Wysano film'
    case 'AUDIO':
      return 'Wysano nagranie audio'
    case 'FILE':
      return 'Wysano zacznik'
    default:
      return 'Nowa wiadomo'
  }
}

export async function notifyMessage(
  message: Message,
  userId: string,
  isAllowed: () => boolean,
) {
  if (
    !message.id ||
    message.senderId === userId ||
    message.type === 'SYSTEM' ||
    message.deletedAt
  ) {
    return
  }

  const key = `${userId}:${message.id}`

  if (notified.has(key)) return

  notified.add(key)

  if (notified.size > 1000) {
    const oldest = notified.values().next().value

    if (oldest !== undefined) {
      notified.delete(oldest)
    }
  }

  try {
    if (!(await isPermissionGranted())) return
    if (!isAllowed()) return

    sendNotification({
      title: message.sender?.displayName || 'MikosChat',
      body: messagePreview(message),
    })
  } catch (error) {
    console.warn('[Notifications]', error)
  }
}