'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  BarChart3,
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
import { formatTimeOnly, formatShortDate, formatSyncedDateTime } from '@/lib/timeSync'
import type { DetailedStats } from '@/types'

function StatsPageInner() {
  const [stats, setStats] = useState<DetailedStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(14)
  const { selectedGroupId, setSelectedGroupId, groups } = useGroup()

  useEffect(() => {
    setLoading(true)
    api.review.detailedStats(days, selectedGroupId || undefined)
      .then((data) => setStats(data as DetailedStats))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days, selectedGroupId])

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
          <BarChart3 className="w-12 h-12 text-surface-600" />
          <p className="text-surface-400">暂无统计数据</p>
        </div>
    )
  }

  const maxTotal = Math.max(...stats.accuracy_trend.map((d) => d.total), 1)
  const chartWidth = 600
  const chartHeight = 200
  const padding = { top: 20, right: 20, bottom: 30, left: 40 }
  const plotWidth = chartWidth - padding.left - padding.right
  const plotHeight = chartHeight - padding.top - padding.bottom

  const points = stats.accuracy_trend.map((d, i) => {
    const x = padding.left + (i / Math.max(stats.accuracy_trend.length - 1, 1)) * plotWidth
    const y = padding.top + plotHeight - (d.accuracy / 100) * plotHeight
    return { x, y, ...d }
  })

  const barPoints = stats.accuracy_trend.map((d, i) => {
    const x = padding.left + (i / Math.max(stats.accuracy_trend.length - 1, 1)) * plotWidth
    const barWidth = Math.max(plotWidth / stats.accuracy_trend.length - 2, 2)
    const height = (d.total / maxTotal) * plotHeight
    return { x: x - barWidth / 2, y: padding.top + plotHeight - height, w: barWidth, h: height, ...d }
  })

  const { mastery_distribution: md } = stats
  const masteryTotal = md.new_words + md.learning + md.familiar + md.mastered || 1
  const masterySegments = [
    { label: '新词', value: md.new_words, color: 'rgb(var(--surface-500))' },
    { label: '学习中', value: md.learning, color: 'rgb(var(--accent-warning))' },
    { label: '熟悉', value: md.familiar, color: 'rgb(var(--accent-info))' },
    { label: '已掌握', value: md.mastered, color: 'rgb(var(--accent-primary))' },
  ]

  let cumulativeAngle = -Math.PI / 2
  const donutRadius = 70
  const donutInner = 40
  const donutCenter = 90

  return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-100 tracking-tight">学习统计</h1>
            <p className="text-surface-400 text-xs mt-1 font-mono">详细的学习数据分析</p>
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
            <div className="flex gap-1 bg-surface-800/60 rounded-lg p-1 border border-surface-700/40">
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors
                  ${days === d
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'text-surface-400 hover:text-surface-200'
                  }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-data rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-accent-primary" />
              <h2 className="section-title">正确率趋势</h2>
            </div>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full">
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = padding.top + plotHeight - (pct / 100) * plotHeight
                return (
                  <g key={pct}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="rgb(var(--surface-700))"
                      strokeWidth="0.5"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[10px]"
                      fill="rgb(var(--surface-500))"
                      fontFamily="JetBrains Mono"
                    >
                      {pct}%
                    </text>
                  </g>
                )
              })}
              {points.length > 1 && (
                <>
                  <defs>
                    <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--accent-primary))" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="rgb(var(--accent-primary))" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M${points.map((p) => `${p.x},${p.y}`).join(' L')}`}
                    fill="none"
                    stroke="rgb(var(--accent-primary))"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M${points[0].x},${padding.top + plotHeight} L${points.map((p) => `${p.x},${p.y}`).join(' L')} L${points[points.length - 1].x},${padding.top + plotHeight} Z`}
                    fill="url(#accuracyGrad)"
                  />
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="3"
                      fill="rgb(var(--accent-primary))"
                      stroke="rgb(var(--surface-800))"
                      strokeWidth="1.5"
                    />
                  ))}
                </>
              )}
              {stats.accuracy_trend.map((d, i) => {
                const x = padding.left + (i / Math.max(stats.accuracy_trend.length - 1, 1)) * plotWidth
                if (i % Math.max(Math.floor(stats.accuracy_trend.length / 7), 1) === 0) {
                  return (
                    <text
                      key={i}
                      x={x}
                      y={chartHeight - 6}
                      textAnchor="middle"
                      className="text-[9px]"
                      fill="rgb(var(--surface-500))"
                      fontFamily="JetBrains Mono"
                    >
                      {d.date}
                    </text>
                  )
                }
                return null
              })}
            </svg>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-data rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-accent-warning" />
              <h2 className="section-title">复习量趋势</h2>
            </div>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full">
              {barPoints.map((b, i) => (
                <rect
                  key={i}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx="2"
                  fill="rgb(var(--accent-warning))"
                  opacity="0.7"
                />
              ))}
              {stats.accuracy_trend.map((d, i) => {
                const x = padding.left + (i / Math.max(stats.accuracy_trend.length - 1, 1)) * plotWidth
                if (i % Math.max(Math.floor(stats.accuracy_trend.length / 7), 1) === 0) {
                  return (
                    <text
                      key={i}
                      x={x}
                      y={chartHeight - 6}
                      textAnchor="middle"
                      className="text-[9px]"
                      fill="rgb(var(--surface-500))"
                      fontFamily="JetBrains Mono"
                    >
                      {d.date}
                    </text>
                  )
                }
                return null
              })}
            </svg>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card-data rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-accent-secondary" />
              <h2 className="section-title">掌握分布</h2>
            </div>
            <div className="flex justify-center">
              <svg viewBox="0 0 180 180" className="w-44 h-44">
                {masterySegments.map((seg) => {
                  const angle = (seg.value / masteryTotal) * Math.PI * 2
                  const startAngle = cumulativeAngle
                  const endAngle = cumulativeAngle + angle
                  cumulativeAngle = endAngle

                  if (seg.value === 0) return null

                  const x1 = donutCenter + donutRadius * Math.cos(startAngle)
                  const y1 = donutCenter + donutRadius * Math.sin(startAngle)
                  const x2 = donutCenter + donutRadius * Math.cos(endAngle)
                  const y2 = donutCenter + donutRadius * Math.sin(endAngle)
                  const x1i = donutCenter + donutInner * Math.cos(startAngle)
                  const y1i = donutCenter + donutInner * Math.sin(startAngle)
                  const x2i = donutCenter + donutInner * Math.cos(endAngle)
                  const y2i = donutCenter + donutInner * Math.sin(endAngle)

                  const largeArc = angle > Math.PI ? 1 : 0

                  return (
                    <path
                      key={seg.label}
                      d={`M${x1},${y1} A${donutRadius},${donutRadius} 0 ${largeArc} 1 ${x2},${y2} L${x2i},${y2i} A${donutInner},${donutInner} 0 ${largeArc} 0 ${x1i},${y1i} Z`}
                      fill={seg.color}
                      stroke="rgb(var(--surface-800))"
                      strokeWidth="2"
                    />
                  )
                })}
              </svg>
            </div>
            <div className="space-y-2 mt-2">
              {masterySegments.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: seg.color }} />
                    <span className="text-surface-300">{seg.label}</span>
                  </div>
                  <span className="text-surface-100 font-mono">{seg.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-data rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-accent-primary" />
              <h2 className="section-title">每日目标</h2>
            </div>
            <div className="text-center py-4">
              <svg viewBox="0 0 160 160" className="w-36 h-36 mx-auto">
                <circle
                  cx="80"
                  cy="80"
                  r="65"
                  fill="none"
                  stroke="rgb(var(--surface-700))"
                  strokeWidth="10"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="65"
                  fill="none"
                  stroke="rgb(var(--accent-primary))"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(stats.daily_goal_progress.percentage / 100) * 408} 408`}
                  transform="rotate(-90 80 80)"
                />
                <text
                  x="80"
                  y="72"
                  textAnchor="middle"
                  className="text-2xl font-bold"
                  fill="rgb(var(--surface-100))"
                  fontFamily="JetBrains Mono"
                >
                  {stats.daily_goal_progress.completed}
                </text>
                <text
                  x="80"
                  y="92"
                  textAnchor="middle"
                  className="text-[10px]"
                  fill="rgb(var(--surface-500))"
                  fontFamily="JetBrains Mono"
                >
                  / {stats.daily_goal_progress.goal}
                </text>
              </svg>
              <p className="text-sm text-surface-300 mt-2">
                完成度 <span className="text-accent-primary font-mono font-semibold">{stats.daily_goal_progress.percentage}%</span>
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card-data rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-accent-info" />
              <h2 className="section-title">最近复习</h2>
            </div>
            <div className="space-y-2">
              {stats.recent_reviews.length > 0 ? (
                stats.recent_reviews.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-surface-800/30 border border-surface-700/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {r.quality >= 3 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-accent-error shrink-0" />
                      )}
                      <span className="text-sm text-surface-200 truncate font-mono">{r.word}</span>
                    </div>
                    <span className="text-[10px] text-surface-500 font-mono shrink-0 ml-2">
                      {formatSyncedDateTime(r.reviewed_at, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-surface-500 text-sm text-center py-4">暂无复习记录</p>
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
