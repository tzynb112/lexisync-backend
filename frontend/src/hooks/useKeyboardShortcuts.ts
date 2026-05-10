'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault()
          shortcut.handler()
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export function useGlobalShortcuts() {
  const router = useRouter()

  useKeyboardShortcuts([
    { key: 'd', ctrl: true, handler: () => router.push('/dashboard'), description: '仪表板' },
    { key: 's', ctrl: true, handler: () => router.push('/study'), description: '学习' },
    { key: 'w', ctrl: true, handler: () => router.push('/words'), description: '词汇管理' },
    { key: 't', ctrl: true, handler: () => router.push('/stats'), description: '统计' },
    { key: 'p', ctrl: true, handler: () => router.push('/study-plan'), description: '学习计划' },
    { key: 'e', ctrl: true, handler: () => router.push('/wrong-words'), description: '错题本' },
  ])
}
