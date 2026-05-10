'use client'

import { useCallback, useRef } from 'react'

export function useSpeech() {
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const isSpeakingRef = useRef(false)

  const speak = useCallback((text: string, lang: string = 'en-US') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    // 只在真正播放时才取消之前的
    if (isSpeakingRef.current) {
      window.speechSynthesis.cancel()
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.85
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => {
      isSpeakingRef.current = true
    }
    utterance.onend = () => {
      isSpeakingRef.current = false
    }
    utterance.onerror = () => {
      isSpeakingRef.current = false
    }

    synthRef.current = window.speechSynthesis
    synthRef.current.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    isSpeakingRef.current = false
  }, [])

  const isSupported = typeof window !== 'undefined' && !!window.speechSynthesis

  return { speak, stop, isSupported }
}
