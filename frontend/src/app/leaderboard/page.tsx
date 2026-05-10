'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  Flame,
  BookOpen,
  Loader2,
  User,
} from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'
import { useGroup } from '@/contexts/GroupContext'

interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  score: number
  is_current_user: boolean
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[]
  current_user_rank: number
  period: string
  sort_by: string
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-5 h-5 text-amber-400" />
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-300" />
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />
  return <span className="w-5 h-5 flex items-center justify-center text-xs font-mono text-surface-500">{rank}</span>
}

function LeaderboardPageInner() {
  const [period, setPeriod] = useState('week')
  const [sortBy, setSortBy] = useState('reviews')
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { selectedGroupId, selectedGroupType } = useGroup()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const tagFilter = selectedGroupType === 'tag' ? (selectedGroupId || undefined) : undefined
      const result = await api.leaderboard.get(period, sortBy, tagFilter, controller.signal) as LeaderboardData
      setData(result)
    } catch (err: unknown) {
      setData(null)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('请求超时，请检查后端服务是否正常运行')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('加载排行榜失败，请检查网络连接')
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [period, sortBy, selectedGroupId, selectedGroupType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const periods = [
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'all', label: '全部' },
  ]

  const sortOptions = [
    { key: 'reviews', label: '复习次数', icon: BookOpen },
    { key: 'streak', label: '连续天数', icon: Flame },
    { key: 'mastered', label: '已掌握', icon: TrendingUp },
  ]

  return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 tracking-tight">排行榜</h1>
          <p className="text-surface-400 text-xs mt-1 font-mono">与其他学习者一较高下</p>
        </div>

        <div className="card-data rounded-2xl p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${period === p.key
                    ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/40 border border-transparent'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${sortBy === opt.key
                      ? 'bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/40 border border-transparent'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="card-data rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-accent-error/10 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-6 h-6 text-accent-error" />
            </div>
            <p className="text-accent-error font-medium mb-2">加载失败</p>
            <p className="text-surface-400 text-sm mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="btn-primary text-xs"
            >
              重新加载
            </button>
          </div>
        ) : data ? (
          <>
            <div className="card-data rounded-2xl overflow-hidden">
              <div className="divide-y divide-surface-700/30">
                {data.leaderboard.map((entry, i) => (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors
                      ${entry.is_current_user
                        ? 'bg-accent-primary/5 border-l-2 border-l-accent-primary'
                        : 'hover:bg-surface-700/20'
                      }`}
                  >
                    <div className="w-8 flex justify-center">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center
                        ${entry.is_current_user
                          ? 'bg-accent-primary/15 text-accent-primary'
                          : 'bg-surface-700/40 text-surface-400'
                        }`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate
                          ${entry.is_current_user ? 'text-accent-primary' : 'text-surface-200'}`}>
                          {entry.username}
                          {entry.is_current_user && (
                            <span className="text-[10px] text-accent-primary/60 ml-1.5">(你)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-surface-100 font-mono">
                        {entry.score.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-surface-500">
                        {sortBy === 'reviews' ? '次复习' : sortBy === 'mastered' ? '个单词' : '天'}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {data.current_user_rank > 20 && (
              <div className="card-data rounded-2xl p-5 flex items-center gap-4">
                <Trophy className="w-5 h-5 text-accent-primary" />
                <div>
                  <p className="text-sm text-surface-300">你的排名</p>
                  <p className="text-lg font-bold text-accent-primary font-mono">第 {data.current_user_rank} 名</p>
                </div>
                <p className="text-xs text-surface-500 ml-auto">继续加油！</p>
              </div>
            )}
          </>
        ) : (
          <div className="card-data rounded-2xl p-12 text-center">
            <Trophy className="w-12 h-12 text-surface-500 mx-auto mb-4" />
            <p className="text-surface-400">暂无排行数据</p>
          </div>
        )}
      </div>
  )
}

export default function LeaderboardRoute() {
  return (
    <AppShell>
      <LeaderboardPageInner />
    </AppShell>
  )
}
