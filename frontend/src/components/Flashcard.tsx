'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Volume2,
  BookText,
  HelpCircle,
} from 'lucide-react'

import type { DueWord } from '@/types'
import { api } from '@/lib/api'
import { SpeakButton } from '@/components/SpeakButton'

interface FlashcardProps {
  word: DueWord
  onFeedback: (quality: number) => void
  disabled?: boolean
}

// 颜色映射表（Tailwind JIT 不支持动态类名）

export function Flashcard({ word, onFeedback, disabled }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false)
  const [speechReady, setSpeechReady] = useState(false)

  // 检测语音合成是否可用
  useEffect(() => {
    const checkSpeech = () => {
      const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
      setSpeechReady(supported)
    }
    checkSpeech()
    // Chrome 需要等待 voices 加载
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = checkSpeech
    }
  }, [])

  // 切换单词时重置状态
  useEffect(() => {
    setFlipped(false)
  }, [word.word.id])

  const handleFlip = useCallback(() => {
    if (!disabled) {
      setFlipped((prev) => !prev)
    }
  }, [disabled])

  const handleFeedback = useCallback((quality: number) => {
    if (!flipped) {
      setFlipped(true)
      setTimeout(() => onFeedback(quality), 400)
    } else {
      onFeedback(quality)
    }
  }, [flipped, onFeedback])

  const handlePronounce = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const text = word.word.word
    if (!text?.trim()) return

    // 方案1: 使用有道 TTS API (美音 type=2)
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`)
    try {
      await audio.play()
    } catch {
      // 有道失败，尝试浏览器语音合成
      playWithSpeechSynthesis(text)
    }
  }, [word.word.word])

  const playWithSpeechSynthesis = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('浏览器不支持语音合成')
      return
    }

    // 取消之前的语音
    window.speechSynthesis.cancel()

    try {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 1

      const voices = window.speechSynthesis.getVoices()
      const enVoice = voices.find((v) => v.lang && v.lang.startsWith('en'))
      if (enVoice) {
        utterance.voice = enVoice
      }

      // 某些浏览器需要延迟才能正常播放
      setTimeout(() => {
        window.speechSynthesis.speak(utterance)
      }, 50)
    } catch (err) {
      console.error('Speech synthesis error:', err)
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* 3D 翻转容器 */}
      <div className="perspective-1000" style={{ perspective: '1000px' }}>
        <motion.div
          className="relative w-full cursor-pointer"
          style={{
            minHeight: '380px',
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{
            duration: 0.35,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          onClick={handleFlip}
        >
          {/* ========== 正面 ========== */}
          <div
            className={`absolute inset-0 card-sci p-8 flex flex-col items-center justify-center rounded-2xl
                        ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <div className="absolute top-4 left-4 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-primary/60" />
              <span className="text-[9px] font-mono text-accent-primary/50 tracking-widest uppercase">正面</span>
            </div>

            <div className="absolute top-4 right-4">
              <span className="label-tag bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20">
                SM-2
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div className="relative">
                <p className="text-4xl font-bold text-surface-100 tracking-tight">
                  {word.word.word}
                </p>
                <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
              </div>

              {word.word.phonetic && (
                <p className="text-surface-400 text-base font-mono tracking-wide">
                  /{word.word.phonetic}/
                </p>
              )}

              {/* 发音按钮 */}
              <button
                onClick={handlePronounce}
                className="flex items-center gap-2 px-4 py-2 rounded-lg
                           bg-surface-700/40 text-surface-300 hover:text-accent-primary
                           hover:bg-accent-primary/10 border border-surface-600/30
                           hover:border-accent-primary/20
                           transition-colors duration-200"
                title="点击发音"
              >
                <Volume2 className="w-4 h-4" />
                <span className="text-sm font-medium">发音</span>
              </button>
            </div>

            <p className="text-xs text-surface-500 flex items-center gap-1.5 mt-4">
              <HelpCircle className="w-3 h-3" />
              点击显示释义
            </p>
          </div>

          {/* ========== 背面 ========== */}
          <div
            className="absolute inset-0 card-sci p-6 flex flex-col rounded-2xl"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="absolute top-4 left-4 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-secondary/60" />
              <span className="text-[9px] font-mono text-accent-secondary/50 tracking-widest uppercase">背面</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pt-6">
              {/* 单词 + 词性 + 释义 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-2xl font-bold text-surface-100">
                    {word.word.word}
                  </p>
                  <SpeakButton text={word.word.word} size="sm" />
                  {word.word.part_of_speech && (
                    <span className="label-tag bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20">
                      {word.word.part_of_speech}
                    </span>
                  )}
                </div>
                <p className="text-surface-300 leading-relaxed text-sm">
                  {word.word.definition || '（暂无释义）'}
                </p>
              </div>

              {/* 内置例句 + 中文翻译 */}
              {word.word.example_sentence && (
                <div className="p-3 rounded-lg bg-surface-700/20 border border-surface-600/20">
                  <div className="flex items-start gap-2">
                    <BookText className="w-4 h-4 text-surface-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-surface-500 mb-1 font-mono uppercase tracking-wider">例句</p>
                      <div className="flex items-start gap-2">
                        <p className="text-sm text-surface-300 italic flex-1 break-words">
                          {word.word.example_sentence}
                        </p>
                        <SpeakButton text={word.word.example_sentence} size="sm" />
                      </div>
                      {word.word.sentence_cn && (
                        <p className="text-xs text-surface-400 mt-1">{word.word.sentence_cn}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 词源 */}
              {word.word.etymology && (
                <div className="flex items-start gap-2 text-sm text-surface-400 pt-1 border-t border-surface-700/30">
                  <BookText className="w-4 h-4 mt-0.5 shrink-0 text-accent-secondary/60" />
                  <p className="italic text-xs leading-relaxed">{word.word.etymology}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 评分按钮 */}
      <div className="flex justify-center gap-3 mt-6">
        {[
          {
            quality: 1,
            label: '不认识',
            sublabel: '忘记了',
            color: 'border-accent-error/30 text-accent-error hover:bg-accent-error/10 hover:border-accent-error/50',
            dot: 'bg-accent-error',
          },
          {
            quality: 3,
            label: '模糊',
            sublabel: '有点印象',
            color: 'border-accent-warning/30 text-accent-warning hover:bg-accent-warning/10 hover:border-accent-warning/50',
            dot: 'bg-accent-warning',
          },
          {
            quality: 5,
            label: '熟知',
            sublabel: '完全掌握',
            color: 'border-accent-primary/30 text-accent-primary hover:bg-accent-primary/10 hover:border-accent-primary/50',
            dot: 'bg-accent-primary',
          },
        ].map((btn) => (
          <button
            key={btn.quality}
            onClick={() => handleFeedback(btn.quality)}
            disabled={disabled}
            className={`flex flex-col items-center gap-1 px-6 py-3 rounded-xl text-sm font-medium border
                       transition-all duration-150 bg-surface-800/50 backdrop-blur-sm
                       disabled:opacity-30 disabled:cursor-not-allowed
                       hover:shadow-lg ${btn.color}`}
          style={{ willChange: 'transform' }}
          >
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${btn.dot}`} />
              <span className="font-semibold">{btn.label}</span>
            </div>
            <span className="text-[10px] opacity-60 font-mono">q={btn.quality}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
