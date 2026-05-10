'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Calendar,
  Flame,
  Layers,
  Trophy,
  TrendingUp,
  Loader2,
  AlertCircle,
  Activity,
  Target,
  Zap,
  BarChart3,
  PieChart,
  Clock,
  Settings,
  BookMarked,
  Library,
  BookCopy,
  Brain,
  CalendarCheck,
  CalendarHeart,
  Star,
  GraduationCap,
  Award,
  Sparkles,
  Tag as TagIcon,
  Heart,
  Lock,
} from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/AppShell'
import { CalendarView } from '@/components/CalendarView'
import { SpeakButton } from '@/components/SpeakButton'
import { api } from '@/lib/api'
import { useGroup } from '@/contexts/GroupContext'
import { parseLocalDate } from '@/lib/timeSync'
import type { DashboardStats, DetailedStats, Achievement, Tag } from '@/types'

function SimpleBarChart({ data, maxValue, color }: { data: number[]; maxValue: number; color: string }) {
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((value, i) => {
        const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0
        return (
          <div
            key={i}
            className={`flex-1 rounded-t-sm ${color} min-h-[2px]`}
            style={{
              height: `${heightPct}%`,
              animation: `barGrow 0.5s ease-out ${i * 0.03}s both`,
            }}
          />
        )
      })}
    </div>
  )
}

function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-surface-400">{label}</span>
        <span className="text-xs font-mono text-surface-300">{value}/{max}</span>
      </div>
      <div className="w-full bg-surface-700/50 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%`, animation: 'barGrow 0.8s ease-out both' }}
        />
      </div>
    </div>
  )
}

const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'book-open': BookOpen,
  'book-marked': BookMarked,
  'library': Library,
  'book-copy': BookCopy,
  'brain': Brain,
  'zap': Zap,
  'flame': Flame,
  'trophy': Trophy,
  'calendar-check': CalendarCheck,
  'calendar-heart': CalendarHeart,
  'star': Star,
  'graduation-cap': GraduationCap,
  'award': Award,
  'sparkles': Sparkles,
  'tag': TagIcon,
  'heart': Heart,
}

function AchievementIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ACHIEVEMENT_ICONS[icon] || Trophy
  return <Icon className={className} />
}

function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [wordOfDay, setWordOfDay] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { selectedGroupId, setSelectedGroupId, groups } = useGroup()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const groupParam = selectedGroupId || undefined
        const [statsData, detailedData, achievementsData, wodData, recData] = await Promise.all([
          api.review.stats(groupParam) as Promise<DashboardStats>,
          api.review.detailedStats(14, groupParam) as Promise<DetailedStats>,
          api.achievements.list() as Promise<Achievement[]>,
          api.words.wordOfTheDay(groupParam) as Promise<any>,
          api.ai.getRecommendations(5, groupParam) as Promise<any[]>,
        ])
        setStats(statsData)
        setDetailedStats(detailedData)
        setAchievements(achievementsData)
        setWordOfDay(wodData)
        setRecommendations(recData)
      } catch (err: any) {
        setError(err.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedGroupId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="w-12 h-12 text-accent-error" />
        <p className="text-accent-error text-sm">{error}</p>
      </div>
    )
  }

  const statCards = [
    {
      label: '今日待复习',
      value: stats?.due_today ?? 0,
      icon: Calendar,
      color: 'text-accent-primary',
      bg: 'bg-accent-primary/8',
      border: 'border-accent-primary/15',
    },
    {
      label: '已掌握',
      value: stats?.mastered_words ?? 0,
      icon: Trophy,
      color: 'text-amber-400',
      bg: 'bg-amber-400/8',
      border: 'border-amber-400/15',
    },
    {
      label: '学习中',
      value: (stats?.total_words ?? 0) - (stats?.mastered_words ?? 0),
      icon: BookOpen,
      color: 'text-accent-secondary',
      bg: 'bg-accent-secondary/8',
      border: 'border-accent-secondary/15',
    },
    {
      label: '今日复习',
      value: stats?.today_reviews ?? 0,
      icon: Target,
      color: 'text-accent-info',
      bg: 'bg-accent-info/8',
      border: 'border-accent-info/15',
    },
    {
      label: '连续天数',
      value: `${stats?.streak_days ?? 0}天`,
      icon: Flame,
      color: 'text-orange-400',
      bg: 'bg-orange-400/8',
      border: 'border-orange-400/15',
    },
    {
      label: '总复习次数',
      value: stats?.total_reviews ?? 0,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/8',
      border: 'border-emerald-400/15',
    },
  ]

  const maxHeatmapCount = Math.max(
    ...(stats?.heatmap_data?.map((d) => d.count) || [1]),
    1
  )

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-surface-700/30'
    const intensity = count / maxHeatmapCount
    if (intensity <= 0.25) return 'bg-accent-primary/20'
    if (intensity <= 0.5) return 'bg-accent-primary/35'
    if (intensity <= 0.75) return 'bg-accent-primary/55'
    return 'bg-accent-primary/80'
  }

  const heatmapWeeks: { date: string; count: number }[][] = []
  const heatmapData = stats?.heatmap_data || []
  for (let i = 0; i < heatmapData.length; i += 7) {
    heatmapWeeks.push(heatmapData.slice(i, i + 7))
  }

  const mastery = detailedStats?.mastery_distribution
  const totalMastery = mastery
    ? mastery.new_words + mastery.learning + mastery.familiar + mastery.mastered
    : 0

  const accuracyData = detailedStats?.accuracy_trend || []
  const maxAccuracy = 100
  const maxReviewDay = Math.max(...accuracyData.map((d) => d.total), 1)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 tracking-tight">仪表板</h1>
          <p className="text-surface-400 text-sm mt-1 font-mono">词汇学习分析</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="bg-surface-800/60 border border-surface-700/40 rounded-lg px-3 py-2 text-xs font-mono
                       text-surface-300 focus:outline-none focus:border-accent-primary/50 transition-colors"
          >
            <option value="">全部词汇</option>
            {groups.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name} ({tag.word_count || 0}词)
              </option>
            ))}
          </select>
          <Link href="/settings" className="p-2 rounded-lg hover:bg-surface-700/50 transition-colors">
            <Settings className="w-5 h-5 text-surface-400" />
          </Link>
          {stats && stats.due_today > 0 && (
            <Link href="/study" className="btn-primary flex items-center gap-2">
              <Zap className="w-4 h-4" />
              开始复习 ({stats.due_today})
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`stat-card ${card.bg} ${card.border}`}>
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className={`text-2xl font-bold ${card.color} font-mono tabular-nums`}>
                {card.value}
              </p>
              <p className="text-[10px] text-surface-400 font-mono uppercase tracking-wider">
                {card.label}
              </p>
            </div>
          )
        })}
      </div>

      {wordOfDay && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-data rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-3 right-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="section-title">每日一词</h2>
            <span className="text-[10px] text-surface-500 font-mono">{wordOfDay.date}</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href={`/words/detail?id=${wordOfDay.word_id}`}
                  className="text-xl font-bold text-surface-100 hover:text-accent-primary transition-colors font-mono"
                >
                  {wordOfDay.word}
                </Link>
                {wordOfDay.part_of_speech && (
                  <span className="label-tag bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20 text-[10px]">
                    {wordOfDay.part_of_speech}
                  </span>
                )}
              </div>
              {wordOfDay.phonetic && (
                <p className="text-xs text-surface-500 font-mono mb-2">/{wordOfDay.phonetic}/</p>
              )}
              <p className="text-sm text-surface-300">{wordOfDay.definition}</p>
              {wordOfDay.example_sentence && (
                <div className="mt-2">
                  <div className="flex items-start gap-2">
                    <p className="text-xs text-surface-500 italic">"{wordOfDay.example_sentence}"</p>
                    <SpeakButton text={wordOfDay.example_sentence} size="sm" />
                  </div>
                  {(wordOfDay as any).sentence_cn && (
                    <p className="text-xs text-surface-400 mt-0.5">{(wordOfDay as any).sentence_cn}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-data rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-accent-secondary" />
            <h2 className="section-title">智能推荐</h2>
            <span className="text-[10px] text-surface-500 font-mono">基于你的学习情况</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendations.map((rec) => (
              <Link
                key={rec.id}
                href={`/words/detail?id=${rec.id}`}
                className="p-3 rounded-xl bg-surface-800/30 border border-surface-700/20
                           hover:border-accent-secondary/30 hover:bg-surface-700/30 transition-colors duration-200 group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-surface-200 group-hover:text-accent-secondary transition-colors font-mono">
                    {rec.word}
                  </span>
                  {rec.part_of_speech && (
                    <span className="text-[10px] text-surface-500">{rec.part_of_speech}</span>
                  )}
                </div>
                <p className="text-xs text-surface-400 line-clamp-2">{rec.definition}</p>
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full
                               bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20">
                  {rec.reason}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-accent-primary" />
              <h2 className="section-title">每日目标</h2>
            </div>
          </div>
          <div className="space-y-4">
            <ProgressBar
              value={stats?.daily_goal_progress ?? 0}
              max={stats?.daily_goal ?? 20}
              color="bg-gradient-to-r from-accent-primary/60 to-accent-primary"
              label="今日进度"
            />
            <div className="flex items-center justify-between text-xs text-surface-400">
              <span>目标: {stats?.daily_goal ?? 20} 个/天</span>
              <Link href="/settings" className="text-accent-primary hover:underline">修改目标</Link>
            </div>
          </div>
        </div>

        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-accent-secondary" />
              <h2 className="section-title">掌握度分布</h2>
            </div>
          </div>
          {mastery && totalMastery > 0 ? (
            <div className="space-y-3">
              <div className="flex gap-1 h-6 rounded-lg overflow-hidden">
                {mastery.mastered > 0 && (
                  <div
                    className="bg-accent-primary"
                    style={{
                      width: `${(mastery.mastered / totalMastery) * 100}%`,
                      animation: 'barGrow 0.6s ease-out both',
                    }}
                  />
                )}
                {mastery.familiar > 0 && (
                  <div
                    className="bg-accent-secondary"
                    style={{
                      width: `${(mastery.familiar / totalMastery) * 100}%`,
                      animation: 'barGrow 0.6s ease-out 0.1s both',
                    }}
                  />
                )}
                {mastery.learning > 0 && (
                  <div
                    className="bg-accent-info"
                    style={{
                      width: `${(mastery.learning / totalMastery) * 100}%`,
                      animation: 'barGrow 0.6s ease-out 0.2s both',
                    }}
                  />
                )}
                {mastery.new_words > 0 && (
                  <div
                    className="bg-surface-500"
                    style={{
                      width: `${(mastery.new_words / totalMastery) * 100}%`,
                      animation: 'barGrow 0.6s ease-out 0.3s both',
                    }}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-accent-primary" />
                  <span className="text-xs text-surface-400">已掌握 {mastery.mastered}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-accent-secondary" />
                  <span className="text-xs text-surface-400">熟悉 {mastery.familiar}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-accent-info" />
                  <span className="text-xs text-surface-400">学习中 {mastery.learning}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-surface-500" />
                  <span className="text-xs text-surface-400">新词 {mastery.new_words}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-surface-500 text-sm text-center py-4">暂无数据</p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent-info" />
              <h2 className="section-title">正确率趋势</h2>
            </div>
            <span className="text-[10px] text-surface-500 font-mono">近14天</span>
          </div>
          {accuracyData.length > 0 ? (
            <div>
              <div className="flex items-end gap-0.5 h-28">
                {accuracyData.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex flex-col items-center" style={{ height: '112px' }}>
                      <div
                        className="w-full rounded-t-sm bg-accent-info/40 min-h-[1px]"
                        style={{
                          height: `${day.accuracy}%`,
                          animation: `barGrow 0.5s ease-out ${i * 0.04}s both`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-0.5 mt-1">
                {accuracyData.filter((_, i) => i % 2 === 0).map((day, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className="text-[8px] text-surface-500 font-mono">{day.date}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-surface-400">
                <span>平均正确率</span>
                <span className="text-accent-info font-semibold font-mono">
                  {accuracyData.length > 0
                    ? Math.round(accuracyData.reduce((s, d) => s + d.accuracy, 0) / accuracyData.length)
                    : 0}%
                </span>
              </div>
            </div>
          ) : (
            <p className="text-surface-500 text-sm text-center py-4">暂无数据</p>
          )}
        </div>

        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-primary" />
              <h2 className="section-title">每日复习量</h2>
            </div>
            <span className="text-[10px] text-surface-500 font-mono">近14天</span>
          </div>
          {accuracyData.length > 0 ? (
            <div>
              <SimpleBarChart
                data={accuracyData.map((d) => d.total)}
                maxValue={maxReviewDay}
                color="bg-accent-primary/50"
              />
              <div className="flex gap-0.5 mt-1">
                {accuracyData.filter((_, i) => i % 2 === 0).map((day, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className="text-[8px] text-surface-500 font-mono">{day.date}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-surface-400">
                <span>日均复习</span>
                <span className="text-accent-primary font-semibold font-mono">
                  {accuracyData.length > 0
                    ? Math.round(accuracyData.reduce((s, d) => s + d.total, 0) / accuracyData.length)
                    : 0} 次
                </span>
              </div>
            </div>
          ) : (
            <p className="text-surface-500 text-sm text-center py-4">暂无数据</p>
          )}
        </div>
      </div>

      <div className="card-data rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-primary" />
            <h2 className="section-title">活动热图</h2>
          </div>
          <span className="text-[10px] text-surface-500 font-mono">过去30天</span>
        </div>

        <div className="space-y-2">
          {heatmapWeeks.map((week, wi) => (
            <div key={wi} className="flex gap-1.5">
              {week.map((day) => {
                const dateStr = parseLocalDate(day.date).toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                })
                return (
                  <div key={day.date} className="flex-1 group relative">
                    <div
                      className={`w-full aspect-square rounded-sm transition-colors duration-200
                                 ${getHeatmapColor(day.count)}
                                 hover:ring-1 hover:ring-accent-primary/40`}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                                    hidden group-hover:block z-10 pointer-events-none">
                      <div className="px-2 py-1 rounded-md bg-surface-700 border border-surface-600/50
                                      text-[10px] text-surface-200 font-mono whitespace-nowrap shadow-lg">
                        {dateStr}: {day.count} 次复习
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <span className="text-[10px] text-surface-500 font-mono">少</span>
          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
            <div
              key={intensity}
              className={`w-3 h-3 rounded-sm ${getHeatmapColor(intensity * maxHeatmapCount)}`}
            />
          ))}
          <span className="text-[10px] text-surface-500 font-mono">多</span>
        </div>
      </div>

      {achievements.length > 0 && (
        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="section-title">成就与徽章</h2>
            </div>
            <span className="text-[10px] text-surface-500 font-mono">
              {achievements.filter((a) => a.unlocked).length}/{achievements.length} 已解锁
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {achievements.map((achievement) => (
              <motion.div
                key={achievement.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex flex-col items-center p-3 rounded-xl transition-colors duration-200 group relative
                          ${achievement.unlocked
                            ? 'bg-surface-800/40 border border-surface-700/30 hover:border-amber-400/30'
                            : 'bg-surface-800/20 border border-surface-700/10 opacity-50 hover:opacity-70'
                          }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors
                              ${achievement.unlocked
                                ? 'bg-amber-400/10 text-amber-400'
                                : 'bg-surface-700/30 text-surface-500'
                              }`}>
                  {achievement.unlocked ? (
                    <AchievementIcon icon={achievement.icon} className="w-5 h-5" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                </div>
                <h3 className={`text-xs font-semibold text-center leading-tight
                              ${achievement.unlocked ? 'text-surface-200' : 'text-surface-500'}`}>
                  {achievement.name}
                </h3>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: achievement.tier }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full
                                ${achievement.unlocked ? 'bg-amber-400' : 'bg-surface-600'}`}
                    />
                  ))}
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                                hidden group-hover:block z-10 pointer-events-none">
                  <div className="px-3 py-2 rounded-lg bg-surface-700 border border-surface-600/50
                                  text-xs text-surface-200 whitespace-nowrap shadow-xl">
                    <p className="font-semibold">{achievement.name}</p>
                    <p className="text-surface-400 mt-0.5">{achievement.description}</p>
                    {achievement.unlocked && achievement.unlocked_at && (
                      <p className="text-surface-500 mt-0.5 text-[10px]">
                        {parseLocalDate(achievement.unlocked_at).toLocaleDateString('zh-CN')} 解锁
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {detailedStats && detailedStats.recent_reviews.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CalendarView />
          <div className="card-data rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-surface-400" />
              <h2 className="section-title">最近复习</h2>
            </div>
            <div className="space-y-2">
              {detailedStats.recent_reviews.slice(0, 8).map((review, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${review.quality >= 3 ? 'bg-accent-primary' : 'bg-accent-error'}`} />
                    <span className="text-sm text-surface-200 font-mono">{review.word}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono ${review.quality >= 3 ? 'text-accent-primary' : 'text-accent-error'}`}>
                      {review.quality >= 3 ? '正确' : '错误'}
                    </span>
                    <span className="text-[10px] text-surface-500 font-mono">
                      {parseLocalDate(review.reviewed_at).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stats && stats.total_words === 0 && (
        <div className="card-sci rounded-2xl p-8 text-center">
          <Layers className="w-12 h-12 text-surface-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-surface-200 mb-2">开始使用</h3>
          <p className="text-surface-400 text-sm mb-4">
            添加单词到您的学习队列，开始您的词汇学习之旅。
          </p>
          <Link href="/words" className="btn-primary inline-flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            浏览单词
          </Link>
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
