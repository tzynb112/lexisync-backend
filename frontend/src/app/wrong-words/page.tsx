'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  BookOpen,
  TrendingUp,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/AppShell'
import { SpeakButton } from '@/components/SpeakButton'
import { api } from '@/lib/api'
import { useGroup } from '@/contexts/GroupContext'
import { parseLocalDate } from '@/lib/timeSync'
import type { WrongWord, WrongWordsResponse } from '@/types'

function WrongWordsPage() {
  const [items, setItems] = useState<WrongWord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { selectedGroupId } = useGroup()
  const pageSize = 20

  const fetchData = useCallback(async (p: number) => {
    setLoading(true)
    setError('')
    try {
      const data = await api.review.wrongWords(p, pageSize, selectedGroupId || undefined) as WrongWordsResponse
      setItems(data.items)
      setTotal(data.total)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [selectedGroupId])

  useEffect(() => {
    fetchData(page)
  }, [page, fetchData])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="w-12 h-12 text-accent-error" />
        <p className="text-accent-error text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 tracking-tight">错题本</h1>
          <p className="text-surface-400 text-sm mt-1 font-mono">
            答错的单词，针对性复习
          </p>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <Link href="/study" className="btn-primary flex items-center gap-2">
              <Zap className="w-4 h-4" />
              去复习
            </Link>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card-sci rounded-2xl p-12 text-center">
          <BookOpen className="w-16 h-16 text-surface-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-surface-200 mb-2">暂无错题</h3>
          <p className="text-surface-400 text-sm">
            太棒了！你还没有答错的单词，继续保持！
          </p>
        </div>
      ) : (
        <>
          <div className="card-data rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-surface-300">
              共 <span className="text-amber-400 font-semibold">{total}</span> 个错题
            </span>
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {items.map((item, i) => (
                <motion.div
                  key={item.word_record_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="card-sci rounded-xl p-4 hover:border-surface-600/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/words/detail?id=${item.word_id}`}
                          className="text-lg font-semibold text-surface-100 hover:text-accent-primary transition-colors font-mono"
                        >
                          {item.word}
                        </Link>
                        <SpeakButton text={item.word} size="sm" />
                        {item.part_of_speech && (
                          <span className="label-tag bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20 text-[10px]">
                            {item.part_of_speech}
                          </span>
                        )}
                      </div>
                      {item.phonetic && (
                        <p className="text-xs text-surface-500 font-mono mb-1">/{item.phonetic}/</p>
                      )}
                      <p className="text-sm text-surface-300">{item.definition}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <RotateCcw className="w-3 h-3 text-accent-error" />
                        <span className="text-xs font-mono text-accent-error font-semibold">
                          {item.wrong_count} 次错误
                        </span>
                      </div>
                      {item.last_wrong_at && (
                        <span className="text-[10px] text-surface-500 font-mono">
                          {parseLocalDate(item.last_wrong_at).toLocaleDateString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-[10px] text-surface-500 font-mono">
                        <TrendingUp className="w-3 h-3" />
                        EF: {item.easiness_factor.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-surface-700/40 text-surface-300 hover:text-surface-100
                           disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-surface-400 font-mono">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg bg-surface-700/40 text-surface-300 hover:text-surface-100
                           disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function WrongWords() {
  return (
    <AppShell>
      <WrongWordsPage />
    </AppShell>
  )
}
