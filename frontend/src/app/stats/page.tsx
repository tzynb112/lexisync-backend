'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  PieChart,
  Target,
  Clock,
  Loader2,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'
import { useGroup } from '@/contexts/GroupContext'
import { useLanguage } from '@/lib/language'
import { formatSyncedDateTime } from '@/lib/timeSync'
import type { DetailedStats } from '@/types'

const textByLang = {
  zh: {
    title: '学习统计',
    subtitle: '详细学习数据分析',
    allWords: '全部词汇',
    days: '天',
    noData: '暂无统计数据',
    accuracyTrend: '正确率趋势',
    reviewTrend: '复习量趋势',
    mastery: '掌握分布',
    dailyGoal: '每日目标进度',
    recent: '最近复习',
    newWords: '新词',
    learning: '学习中',
    familiar: '熟悉',
    mastered: '已掌握',
    avgAccuracy: '平均正确率',
    avgReviews: '日均复习',
    completed: '完成度',
    correct: '正确',
    wrong: '错误',
  },
  en: {
    title: 'Statistics',
    subtitle: 'Detailed learning analytics',
    allWords: 'All Words',
    days: 'days',
    noData: 'No statistics available',
    accuracyTrend: 'Accuracy Trend',
    reviewTrend: 'Review Volume',
    mastery: 'Mastery Distribution',
    dailyGoal: 'Daily Goal Progress',
    recent: 'Recent Reviews',
    newWords: 'New',
    learning: 'Learning',
    familiar: 'Familiar',
    mastered: 'Mastered',
    avgAccuracy: 'Avg Accuracy',
    avgReviews: 'Avg Daily Reviews',
    completed: 'Completion',
    correct: 'Correct',
    wrong: 'Wrong',
  },
} as const

function StatsPageInner() {
  const [stats, setStats] = useState<DetailedStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(14)
  const { selectedGroupId, setSelectedGroupId, groups, selectedGroupType } = useGroup()
  const { language } = useLanguage()
  const i18n = textByLang[language]

  useEffect(() => {
    setLoading(true)
    const isCategory = selectedGroupType === 'category'
    api.review.detailedStats(
      days,
      isCategory ? undefined : (selectedGroupId || undefined),
      isCategory ? selectedGroupId : undefined,
    )
      .then((data) => setStats(data as DetailedStats))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [days, selectedGroupId, selectedGroupType])

  const accuracyData = stats?.accuracy_trend || []
  const maxReviews = Math.max(...accuracyData.map((d) => d.total), 1)
  const avgAccuracy = useMemo(() => {
    if (!accuracyData.length) return 0
    return Math.round(accuracyData.reduce((sum, d) => sum + d.accuracy, 0) / accuracyData.length)
  }, [accuracyData])
  const avgReviews = useMemo(() => {
    if (!accuracyData.length) return 0
    return Math.round(accuracyData.reduce((sum, d) => sum + d.total, 0) / accuracyData.length)
  }, [accuracyData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <PieChart className="w-12 h-12 text-surface-600" />
        <p className="text-surface-400">{i18n.noData}</p>
      </div>
    )
  }

  const mastery = stats.mastery_distribution
  const masteryTotal = mastery.new_words + mastery.learning + mastery.familiar + mastery.mastered || 1
  const masteryRows = [
    { label: i18n.newWords, value: mastery.new_words, color: 'bg-surface-500' },
    { label: i18n.learning, value: mastery.learning, color: 'bg-accent-warning' },
    { label: i18n.familiar, value: mastery.familiar, color: 'bg-accent-info' },
    { label: i18n.mastered, value: mastery.mastered, color: 'bg-accent-primary' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">{i18n.title}</h1>
          <p className="text-surface-400 text-sm mt-1">{i18n.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="bg-surface-800/60 border border-surface-700/40 rounded-lg px-3 py-2 text-xs text-surface-300"
          >
            <option value="">{i18n.allWords}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.word_count || 0})
              </option>
            ))}
          </select>

          <div className="flex gap-1 bg-surface-800/60 rounded-lg p-1 border border-surface-700/40">
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                  days === d ? 'bg-accent-primary/20 text-accent-primary' : 'text-surface-400 hover:text-surface-200'
                }`}
              >
                {d}{i18n.days}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-data rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-accent-primary" />
            <h2 className="section-title">{i18n.accuracyTrend}</h2>
          </div>
          <div className="space-y-2">
            {accuracyData.map((d, idx) => (
              <div key={`${d.date}-${idx}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-surface-400 font-mono">{d.date}</span>
                  <span className="text-accent-primary font-mono">{Math.round(d.accuracy)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-700/40 overflow-hidden">
                  <div className="h-full bg-accent-primary/70 rounded-full" style={{ width: `${Math.max(2, d.accuracy)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs">
            <span className="text-surface-400">{i18n.avgAccuracy}</span>
            <span className="text-accent-primary font-semibold font-mono">{avgAccuracy}%</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card-data rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-accent-warning" />
            <h2 className="section-title">{i18n.reviewTrend}</h2>
          </div>
          <div className="flex items-end gap-1 h-36">
            {accuracyData.map((d, i) => (
              <div key={`${d.date}-${i}`} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t-sm bg-accent-warning/70 min-h-[3px]"
                  style={{ height: `${(d.total / maxReviews) * 100}%` }}
                />
                <span className="text-[9px] text-surface-500 font-mono">{i % 2 === 0 ? d.date.slice(5) : ''}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs">
            <span className="text-surface-400">{i18n.avgReviews}</span>
            <span className="text-accent-warning font-semibold font-mono">{avgReviews}</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-data rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-accent-secondary" />
            <h2 className="section-title">{i18n.mastery}</h2>
          </div>
          <div className="space-y-2.5">
            {masteryRows.map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-surface-300">{row.label}</span>
                  <span className="text-surface-100 font-mono">{row.value}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-700/40 overflow-hidden">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.value / masteryTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card-data rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-accent-primary" />
            <h2 className="section-title">{i18n.dailyGoal}</h2>
          </div>
          <div className="text-center py-3">
            <p className="text-4xl font-bold text-accent-primary font-mono">{stats.daily_goal_progress.percentage}%</p>
            <p className="text-sm text-surface-400 mt-1">
              {stats.daily_goal_progress.completed} / {stats.daily_goal_progress.goal}
            </p>
            <p className="text-xs text-surface-500 mt-2">{i18n.completed}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-data rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-accent-info" />
            <h2 className="section-title">{i18n.recent}</h2>
          </div>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {stats.recent_reviews.length > 0 ? (
              stats.recent_reviews.map((review, i) => (
                <div key={`${review.word}-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-surface-800/30 border border-surface-700/20">
                  <div className="flex items-center gap-2 min-w-0">
                    {review.quality >= 3 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-accent-error shrink-0" />
                    )}
                    <span className="text-sm text-surface-200 truncate font-mono">{review.word}</span>
                  </div>
                  <span className="text-[10px] text-surface-500 font-mono shrink-0 ml-2">
                    {formatSyncedDateTime(review.reviewed_at, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-surface-500 text-sm text-center py-6">{i18n.noData}</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function StatsRoute() {
  return (
    <AppShell>
      <StatsPageInner />
    </AppShell>
  )
}
