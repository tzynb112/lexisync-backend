'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  Flame,
  Trophy,
  TrendingUp,
  Loader2,
  AlertCircle,
  Activity,
  Target,
  Zap,
  Brain,
  Sparkles,
  Lock,
} from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'
import { useGroup } from '@/contexts/GroupContext'
import { useLanguage } from '@/lib/language'
import { parseLocalDate } from '@/lib/timeSync'
import type { DashboardStats, Achievement } from '@/types'

const textByLang = {
  zh: {
    title: '仪表板',
    subtitle: '学习数据概览',
    dueToday: '今日待复习',
    mastered: '已掌握',
    inProgress: '学习中',
    todayReviews: '今日复习',
    streak: '连续天数',
    totalReviews: '总复习次数',
    startReview: '开始复习',
    wordOfDay: '每日一词',
    recommendations: '智能推荐',
    heatmap: '活动热图',
    last30Days: '过去30天',
    low: '少',
    high: '多',
    noActivity: '还没有复习记录，完成一次学习后这里会亮起来',
    achievements: '成就与徽章',
    unlocked: '已解锁',
  },
  en: {
    title: 'Dashboard',
    subtitle: 'Learning Overview',
    dueToday: 'Due Today',
    mastered: 'Mastered',
    inProgress: 'In Progress',
    todayReviews: 'Today Reviews',
    streak: 'Streak',
    totalReviews: 'Total Reviews',
    startReview: 'Start Review',
    wordOfDay: 'Word of the Day',
    recommendations: 'Recommendations',
    heatmap: 'Activity Heatmap',
    last30Days: 'Last 30 Days',
    low: 'Low',
    high: 'High',
    noActivity: 'No review activity yet. Complete one session to light this up.',
    achievements: 'Achievements',
    unlocked: 'unlocked',
  },
} as const

function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [wordOfDay, setWordOfDay] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { selectedGroupId, groups, selectedGroupType } = useGroup()
  const { language } = useLanguage()
  const i18n = textByLang[language]

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const isCategory = selectedGroupType === 'category'
        const tagParam = isCategory ? undefined : (selectedGroupId || undefined)
        const categoryParam = isCategory ? selectedGroupId : undefined
        const [statsData, achievementsData, wodData, recData] = await Promise.all([
          api.review.stats(tagParam, categoryParam) as Promise<DashboardStats>,
          api.achievements.list() as Promise<Achievement[]>,
          api.words.wordOfTheDay(tagParam) as Promise<any>,
          api.ai.getRecommendations(4, tagParam) as Promise<any[]>,
        ])
        setStats(statsData)
        setAchievements(achievementsData)
        setWordOfDay(wodData)
        setRecommendations(recData)
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedGroupId, selectedGroupType])

  const statCards = useMemo(() => {
    if (!stats) return []
    return [
      { label: i18n.dueToday, value: stats.due_today, icon: Calendar, tone: 'text-accent-primary' },
      { label: i18n.mastered, value: stats.mastered_words, icon: Trophy, tone: 'text-amber-400' },
      { label: i18n.inProgress, value: Math.max(stats.total_words - stats.mastered_words, 0), icon: Target, tone: 'text-accent-info' },
      { label: i18n.todayReviews, value: stats.today_reviews, icon: Activity, tone: 'text-accent-secondary' },
      { label: i18n.streak, value: `${stats.streak_days}`, icon: Flame, tone: 'text-orange-400' },
      { label: i18n.totalReviews, value: stats.total_reviews, icon: TrendingUp, tone: 'text-emerald-400' },
    ]
  }, [stats, i18n])

  const heatmapData = useMemo(() => {
    if (!stats?.heatmap_data?.length) return []
    return stats.heatmap_data.slice(-30)
  }, [stats])

  const maxHeatmapCount = useMemo(() => Math.max(...heatmapData.map((d) => d.count), 1), [heatmapData])
  const totalHeatmapCount = useMemo(() => heatmapData.reduce((sum, d) => sum + d.count, 0), [heatmapData])

  const getHeatmapColor = (count: number) => {
    if (count <= 0) return 'bg-surface-700/35 border border-surface-600/30'
    const intensity = count / maxHeatmapCount
    if (intensity <= 0.25) return 'bg-accent-primary/25 border border-accent-primary/20'
    if (intensity <= 0.5) return 'bg-accent-primary/45 border border-accent-primary/30'
    if (intensity <= 0.75) return 'bg-accent-primary/65 border border-accent-primary/40'
    return 'bg-accent-primary/85 border border-accent-primary/60'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <AlertCircle className="w-10 h-10 text-accent-error" />
        <p className="text-accent-error text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-100 tracking-tight">{i18n.title}</h1>
          <p className="text-surface-400 text-xs sm:text-sm mt-1">{i18n.subtitle}</p>
        </div>
        {stats && stats.due_today > 0 && (
          <Link href="/study" className="btn-primary inline-flex items-center justify-center gap-2 self-start sm:self-auto">
            <Zap className="w-4 h-4" />
            {i18n.startReview} ({stats.due_today})
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="stat-card p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${card.tone}`} />
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${card.tone} font-mono tabular-nums`}>{card.value}</p>
              <p className="text-[10px] sm:text-xs text-surface-400">{card.label}</p>
            </div>
          )
        })}
      </div>

      {wordOfDay && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-data rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="section-title text-base sm:text-lg">{i18n.wordOfDay}</h2>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/words/detail?id=${wordOfDay.word_id}`} className="text-lg font-bold text-surface-100 hover:text-accent-primary transition-colors">
              {wordOfDay.word}
            </Link>
            {wordOfDay.part_of_speech && (
              <span className="label-tag bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20 normal-case">
                {wordOfDay.part_of_speech}
              </span>
            )}
          </div>
          <p className="text-sm text-surface-300">{wordOfDay.definition}</p>
        </motion.div>
      )}

      <div className="card-data rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-primary" />
            <h2 className="section-title text-base sm:text-lg">{i18n.heatmap}</h2>
          </div>
          <span className="text-[11px] text-surface-500 font-mono">{i18n.last30Days}</span>
        </div>

        <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5">
          {heatmapData.map((day) => {
            const dateStr = parseLocalDate(day.date).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
              month: 'short',
              day: 'numeric',
            })
            return (
              <div key={day.date} className="group relative">
                <div className={`h-4 sm:h-5 rounded-sm ${getHeatmapColor(day.count)}`} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                  <div className="px-2 py-1 rounded bg-surface-700 border border-surface-600/50 text-[10px] text-surface-100 whitespace-nowrap">
                    {dateStr}: {day.count}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {totalHeatmapCount === 0 && (
          <p className="text-xs text-surface-500 mt-3">{i18n.noActivity}</p>
        )}

        <div className="flex items-center justify-end gap-2 mt-4">
          <span className="text-[10px] text-surface-500 font-mono">{i18n.low}</span>
          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
            <div key={intensity} className={`w-3 h-3 rounded-sm ${getHeatmapColor(intensity * maxHeatmapCount)}`} />
          ))}
          <span className="text-[10px] text-surface-500 font-mono">{i18n.high}</span>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="card-data rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-accent-secondary" />
            <h2 className="section-title text-base sm:text-lg">{i18n.recommendations}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {recommendations.map((rec) => (
              <Link
                key={rec.id}
                href={`/words/detail?id=${rec.id}`}
                className="p-3 rounded-xl bg-surface-800/30 border border-surface-700/20 hover:border-accent-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-surface-100">{rec.word}</span>
                </div>
                <p className="text-xs text-surface-400 line-clamp-2">{rec.definition}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {achievements.length > 0 && (
        <div className="card-data rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="section-title text-base sm:text-lg">{i18n.achievements}</h2>
            </div>
            <span className="text-[11px] text-surface-500 font-mono">
              {achievements.filter((a) => a.unlocked).length}/{achievements.length} {i18n.unlocked}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {achievements.map((achievement) => (
              <div
                key={achievement.key}
                className={`p-3 rounded-xl border text-center ${
                  achievement.unlocked
                    ? 'bg-surface-800/35 border-surface-700/30'
                    : 'bg-surface-800/15 border-surface-700/10 opacity-70'
                }`}
              >
                <div className="w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center bg-surface-700/30 text-surface-200">
                  <Lock className="w-4 h-4" />
                </div>
                <p className="text-xs text-surface-200">{achievement.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  )
}
