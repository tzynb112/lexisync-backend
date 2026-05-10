'use client'

import { useState, useCallback } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

interface SpeakButtonProps {
  text: string
  lang?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SpeakButton({ text, lang = 'en-US', size = 'md', className = '' }: SpeakButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleSpeak = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (isPlaying) return
    if (!text?.trim()) return

    setIsPlaying(true)
    setHasError(false)

    // 方案1: 使用有道 TTS API (英音 type=1, 美音 type=2)
    const youdaoAudio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`)
    
    try {
      await youdaoAudio.play()
      youdaoAudio.onended = () => setIsPlaying(false)
      youdaoAudio.onerror = () => {
        // 有道失败，尝试浏览器语音合成
        fallbackToSpeechSynthesis(text, lang, setIsPlaying, setHasError)
      }
    } catch {
      // 播放被阻止或失败，尝试浏览器语音合成
      fallbackToSpeechSynthesis(text, lang, setIsPlaying, setHasError)
    }
  }, [text, lang, isPlaying])

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  }

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  return (
    <button
      onClick={handleSpeak}
      disabled={isPlaying}
      className={`${sizeClasses[size]} rounded-lg bg-accent-primary/10 border border-accent-primary/20
                  flex items-center justify-center
                  hover:bg-accent-primary/20 hover:scale-110 active:scale-95
                  transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                  ${hasError ? 'text-red-400 border-red-400/20 bg-red-400/10' : 'text-accent-primary'}
                  ${className}`}
      title={hasError ? '发音不可用' : '朗读发音'}
    >
      {hasError ? (
        <VolumeX className={iconSizes[size]} />
      ) : (
        <Volume2 className={`${iconSizes[size]} ${isPlaying ? 'animate-pulse' : ''}`} />
      )}
    </button>
  )
}

// 浏览器语音合成备选方案
function fallbackToSpeechSynthesis(
  text: string,
  lang: string,
  setIsPlaying: (v: boolean) => void,
  setHasError: (v: boolean) => void
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    setIsPlaying(false)
    setHasError(true)
    return
  }

  // 取消之前的语音
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.9
  utterance.pitch = 1
  utterance.volume = 1

  utterance.onend = () => {
    setIsPlaying(false)
  }

  utterance.onerror = () => {
    setIsPlaying(false)
    setHasError(true)
  }

  // 某些浏览器需要延迟才能正常播放
  setTimeout(() => {
    window.speechSynthesis.speak(utterance)
  }, 50)

  // 安全超时
  setTimeout(() => {
    setIsPlaying(false)
  }, 10000)
}
