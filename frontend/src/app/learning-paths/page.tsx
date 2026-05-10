'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Circle,
  Play,
  GraduationCap,
  Layers,
} from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'

interface PathWord {
  id: string
  word: string
  phonetic: string | null
  definition: string
  part_of_speech: string | null
  order_index: number
  is_studied: boolean
}

interface LearningPath {
  id: string
  name: string
  description: string | null
  category: string
  difficulty: string
  word_count: number
  created_at: string
  words?: PathWord[]
}

function LearningPathsPage() {
  const [paths, setPaths] = useState<LearningPath[]>([])
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startResult, setStartResult] = useState<{ added: number; skipped: number } | null>(null)

  const fetchPaths = useCallback(async () => {
    setLoading(true)
    try {
      const [pathsData, catsData] = await Promise.all([
        api.learningPaths.list(selectedCategory || undefined) as Promise<LearningPath[]>,
        api.learningPaths.categories() as Promise<{ category: string; count: number }[]>,
      ])
      setPaths(pathsData)
      setCategories(catsData)
    } catch {
      setPaths([])
    } finally {
      setLoading(false)
    }
  }, [selectedCategory])

  useEffect(() => {
    fetchPaths()
  }, [fetchPaths])

  const handleSelectPath = async (path: LearningPath) => {
    setDetailLoading(true)
    setStartResult(null)
    try {
      const detail = await api.learningPaths.getDetail(path.id) as LearningPath
      setSelectedPath(detail)
    } catch {
      setSelectedPath(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleStartPath = async () => {
    if (!selectedPath) return
    setStarting(true)
    try {
      const result = await api.learningPaths.start(selectedPath.id) as { added: number; skipped: number }
      setStartResult(result)
      const detail = await api.learningPaths.getDetail(selectedPath.id) as LearningPath
      setSelectedPath(detail)
    } catch {} finally {
      setStarting(false)
    }
  }

  const difficultyColors: Record<string, string> = {
    beginner: 'bg-accent-primary/10 text-accent-primary border-accent-primary/20',
    intermediate: 'bg-accent-warning/10 text-accent-warning border-accent-warning/20',
    advanced: 'bg-accent-error/10 text-accent-error border-accent-error/20',
  }

  const difficultyLabels: Record<string, string> = {
    beginner: '初级',
    intermediate: '中级',
    advanced: '高级',
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 tracking-tight">学习路径</h1>
          <p className="text-surface-400 text-xs mt-1 font-mono">按主题分组学习，系统化提升词汇量</p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${!selectedCategory
                  ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/40 border border-transparent'
                }`}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${selectedCategory === cat.category
                    ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/40 border border-transparent'
                  }`}
              >
                {cat.category} ({cat.count})
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
              </div>
            ) : paths.length === 0 ? (
              <div className="card-data rounded-2xl p-8 text-center">
                <Layers className="w-10 h-10 text-surface-500 mx-auto mb-3" />
                <p className="text-surface-400 text-sm">暂无学习路径</p>
              </div>
            ) : (
              paths.map((path, i) => (
                <motion.button
                  key={path.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleSelectPath(path)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors
                    ${selectedPath?.id === path.id
                      ? 'bg-accent-primary/5 border-accent-primary/30'
                      : 'border-surface-700/30 hover:border-surface-600/50 hover:bg-surface-700/20'
                    }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-surface-200">{path.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${difficultyColors[path.difficulty] || ''}`}>
                      {difficultyLabels[path.difficulty] || path.difficulty}
                    </span>
                  </div>
                  {path.description && (
                    <p className="text-xs text-surface-400 line-clamp-2 mb-2">{path.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-surface-500 font-mono">
                    <span>{path.word_count} 个单词</span>
                    <span>{path.category}</span>
                  </div>
                </motion.button>
              ))
            )}
          </div>

          <div className="lg:col-span-2">
            {detailLoading ? (
              <div className="card-data rounded-2xl p-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
              </div>
            ) : selectedPath ? (
              <div className="card-data rounded-2xl p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-surface-100">{selectedPath.name}</h2>
                    {selectedPath.description && (
                      <p className="text-sm text-surface-400 mt-1">{selectedPath.description}</p>
                    )}
                  </div>
                  <button
                    onClick={handleStartPath}
                    disabled={starting}
                    className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                  >
                    {starting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    开始学习
                  </button>
                </div>

                {startResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-sm text-accent-primary"
                  >
                    已添加 {startResult.added} 个新单词到学习队列
                    {startResult.skipped > 0 && `，${startResult.skipped} 个已存在`}
                  </motion.div>
                )}

                <div className="space-y-1">
                  {selectedPath.words?.map((pw, i) => (
                    <Link
                      key={pw.id}
                      href={`/words/${pw.id}`}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors group
                        ${pw.is_studied
                          ? 'bg-accent-primary/5 hover:bg-accent-primary/10'
                          : 'bg-surface-700/30 hover:bg-surface-700/50'
                        }`}
                    >
                      <div className="w-6 flex justify-center">
                        {pw.is_studied ? (
                          <CheckCircle2 className="w-4 h-4 text-accent-primary" />
                        ) : (
                          <Circle className="w-4 h-4 text-surface-600" />
                        )}
                      </div>
                      <span className="text-[10px] text-surface-500 font-mono w-6">{pw.order_index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-surface-200 font-mono group-hover:text-accent-primary transition-colors">
                            {pw.word}
                          </span>
                          {pw.part_of_speech && (
                            <span className="text-[10px] text-surface-500">{pw.part_of_speech}</span>
                          )}
                        </div>
                        <p className="text-xs text-surface-400 truncate">{pw.definition}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-accent-primary transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card-data rounded-2xl p-12 text-center">
                <GraduationCap className="w-12 h-12 text-surface-500 mx-auto mb-4" />
                <p className="text-surface-400">选择一个学习路径查看详情</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default function LearningPathsRoute() {
  return <LearningPathsPage />
}
