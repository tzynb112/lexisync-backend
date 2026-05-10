'use client'

import { useEffect, useCallback, useRef } from 'react'

export function useStudyReminder(enabled: boolean, reminderTime: string) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const notifiedRef = useRef(false)

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    return result === 'granted'
  }, [])

  const sendNotification = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    new Notification('LexiSync 学习提醒', {
      body: '该复习单词了！坚持学习，保持记忆曲线。',
      icon: '/icon-192.png',
      tag: 'study-reminder',
      requireInteraction: true,
    })
  }, [])

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    requestPermission()

    const checkAndNotify = () => {
      const now = new Date()
      const [hours, minutes] = reminderTime.split(':').map(Number)
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const targetTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

      if (currentTimeStr === targetTimeStr && !notifiedRef.current) {
        sendNotification()
        notifiedRef.current = true
      }

      if (currentTimeStr !== targetTimeStr) {
        notifiedRef.current = false
      }
    }

    checkAndNotify()
    timerRef.current = setInterval(checkAndNotify, 30000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, reminderTime, requestPermission, sendNotification])

  return { requestPermission }
}
