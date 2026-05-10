'use client'

import { useState, useCallback, useRef } from 'react'

interface UseSpeechRecognitionOptions {
  lang?: string
  onResult?: (text: string) => void
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = 'en-US', onResult } = options
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  const getRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    return recognition
  }, [lang])

  const startListening = useCallback(() => {
    const recognition = getRecognition()
    if (!recognition) {
      setIsSupported(false)
      return
    }

    setIsSupported(true)
    recognitionRef.current = recognition

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      if (onResult) {
        onResult(transcript)
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    try {
      recognition.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
    }
  }, [getRecognition, onResult])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  }
}
