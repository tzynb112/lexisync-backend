'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Target,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Save,
  X,
  Flame,
  Plus,
  Trash2,
  BookOpen,
  Layers,
  TrendingUp,
} from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'
import { useTimeSync } from '@/lib/timeSyncProvider'
import { parseLocalDate } from '@/lib/timeSync'
import type { StudyPlan, CustomPlan, Tag } from '@/types'

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

type TabType = 'weekly' | 'custom'

function StudyPlanPage() {
  const { now: syncedNow } = useTimeSync()
  const [activeTab, setActiveTab] = useState<TabType>('weekly')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(syncedNow))
  const [plans, setPlans] = useState<StudyPlan[]>([])
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState(20)
  const [editNote, setEditNote] = useState('')
  const [dailyGoal, setDailyGoal] = useState(20)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCustomPlan, setEditingCustomPlan] = useState<CustomPlan | null>(null)

  const [newPlan, setNewPlan] = useState({
    title: '',
    description: '',
    tag_id: '',
    target_words: 100,
    start_date: formatDate(syncedNow),
    end_date: formatDate(new Date(syncedNow.getTime() + 30 * 24 * 60 * 60 * 1000)),
    daily_goal: 20,
  })

  const weekDates = getWeekDates(weekStart)

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const [weeklyRes, customData, tagsData] = await Promise.all([
        api.studyPlans.getWeek(formatDate(weekStart)) as Promise<{ daily_goal: number; plans: StudyPlan[] }>,
        api.customPlans.list() as Promise<CustomPlan[]>,
        api.tags.list() as Promise<Tag[]>,
      ])
      setPlans(weeklyRes.plans)
      setDailyGoal(weeklyRes.daily_goal)
      setCustomPlans(customData)
      setTags(tagsData)
    } catch {
      setPlans([])
      setCustomPlans([])
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const handlePrevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  const handleNextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  const handleStartEdit = (plan: StudyPlan) => {
    setEditingDate(plan.plan_date)
    setEditTarget(plan.target_words || dailyGoal)
    setEditNote(plan.note || '')
  }

  const handleSave = async () => {
    if (!editingDate) return
    try {
      await api.studyPlans.createOrUpdate(editingDate, editTarget, editNote || undefined)
      await api.tags.updateSettings({ daily_goal: editTarget })
      setEditingDate(null)
      setDailyGoal(editTarget)
      fetchPlans()
    } catch {}
  }

  const handleCreateCustomPlan = async () => {
    try {
      await api.customPlans.create({
        ...newPlan,
        tag_id: newPlan.tag_id || undefined,
      })
      setShowCreateModal(false)
      setNewPlan({
        title: '',
        description: '',
        tag_id: '',
        target_words: 100,
        start_date: formatDate(syncedNow),
        end_date: formatDate(new Date(syncedNow.getTime() + 30 * 24 * 60 * 60 * 1000)),
        daily_goal: 20,
      })
      fetchPlans()
    } catch (err: any) {
      alert(err?.message || '创建计划失败')
    }
  }

  const handleUpdateCustomPlan = async () => {
    if (!editingCustomPlan) return
    try {
      await api.customPlans.update(editingCustomPlan.id, {
        title: editingCustomPlan.title,
        description: editingCustomPlan.description || undefined,
        tag_id: editingCustomPlan.tag_id || undefined,
        target_words: editingCustomPlan.target_words,
        start_date: editingCustomPlan.start_date,
        end_date: editingCustomPlan.end_date,
        daily_goal: editingCustomPlan.daily_goal,
        is_active: editingCustomPlan.is_active,
      })
      setEditingCustomPlan(null)
      fetchPlans()
    } catch (err: any) {
      alert(err?.message || '更新计划失败')
    }
  }

  const handleDeleteCustomPlan = async (planId: string) => {
    if (!confirm('确定要删除这个计划吗？')) return
    try {
      await api.customPlans.delete(planId)
      fetchPlans()
    } catch {}
  }

  const handleUpdateProgress = async (planId: string) => {
    try {
      await api.customPlans.updateProgress(planId)
      fetchPlans()
    } catch {}
  }

  const handleApplyToWeek = async (plan: CustomPlan) => {
    if (!confirm(`将 "${plan.title}" 的每日目标 (${plan.daily_goal}词) 应用到本周每一天？`)) return
    try {
      const weekStartDate = getWeekStart(syncedNow)
      const dates = getWeekDates(weekStartDate)
      for (const d of dates) {
        await api.studyPlans.createOrUpdate(formatDate(d), plan.daily_goal)
      }
      await api.tags.updateSettings({ daily_goal: plan.daily_goal })
      setDailyGoal(plan.daily_goal)
      setActiveTab('weekly')
      fetchPlans()
      setTimeout(() => alert('已应用到本周计划！'), 100)
    } catch (err: any) {
      alert(err?.message || '应用失败')
    }
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const totalTarget = plans.reduce((sum, p) => sum + p.target_words, 0)
  const totalCompleted = plans.reduce((sum, p) => sum + p.completed_words, 0)
  const weekProgress = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-100 tracking-tight">学习计划</h1>
            <p className="text-surface-400 text-xs mt-1 font-mono">设定每周目标，追踪学习进度</p>
          </div>
          <div className="flex items-center gap-2 bg-surface-800/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === 'weekly'
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              周计划
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === 'custom'
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              自定义计划
            </button>
          </div>
        </div>

        {activeTab === 'weekly' ? (
          <div className="card-data rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handlePrevWeek}
                className="p-2 rounded-lg hover:bg-surface-700/50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-surface-400" />
              </button>
              <div className="text-center">
                <p className="text-lg font-semibold text-surface-100">
                  {weekStart.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                  {' - '}
                  {weekEnd.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-surface-500 font-mono mt-0.5">
                  {weekStart.getFullYear()}年
                </p>
              </div>
              <button
                onClick={handleNextWeek}
                className="p-2 rounded-lg hover:bg-surface-700/50 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-surface-400" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-surface-800/40 border border-surface-700/30">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-accent-primary" />
                <div>
                  <p className="text-xs text-surface-500">本周目标</p>
                  <p className="text-lg font-bold text-surface-100 font-mono">{totalTarget} 词</p>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-surface-400">完成进度</span>
                  <span className="text-xs font-mono text-accent-primary">{weekProgress}%</span>
                </div>
                <div className="w-full bg-surface-700/50 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(weekProgress, 100)}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-accent-primary/60 to-accent-primary"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <div>
                  <p className="text-xs text-surface-500">已完成</p>
                  <p className="text-lg font-bold text-surface-100 font-mono">{totalCompleted} 词</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {weekDates.map((date, i) => {
                const dateStr = formatDate(date)
                const plan = plans.find((p) => p.plan_date === dateStr)
                const isToday = dateStr === formatDate(syncedNow)
                const pct = plan && plan.target_words > 0
                  ? Math.min(Math.round((plan.completed_words / plan.target_words) * 100), 100)
                  : 0
                const isEditing = editingDate === dateStr

                return (
                  <motion.div
                    key={dateStr}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`p-4 rounded-xl border transition-colors
                      ${isToday
                        ? 'bg-accent-primary/5 border-accent-primary/20'
                        : 'bg-surface-800/30 border-surface-700/20'
                      }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-surface-200 w-10">{DAY_LABELS[i]}</span>
                          <span className="text-xs text-surface-500 font-mono">{dateStr}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-surface-400">目标词数:</label>
                          <input
                            type="number"
                            value={editTarget}
                            onChange={(e) => setEditTarget(Number(e.target.value))}
                            min={1}
                            max={200}
                            className="input-field w-20 text-sm py-1.5"
                          />
                          <label className="text-xs text-surface-400">备注:</label>
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="input-field flex-1 text-sm py-1.5"
                            placeholder="可选备注..."
                          />
                          <button onClick={handleSave} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                            <Save className="w-3 h-3" />保存
                          </button>
                          <button onClick={() => setEditingDate(null)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                            <X className="w-3 h-3" />取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="w-10 text-center">
                          <span className={`text-sm font-semibold ${isToday ? 'text-accent-primary' : 'text-surface-300'}`}>
                            {DAY_LABELS[i]}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-surface-500 font-mono">{dateStr}</span>
                              {plan?.note && (
                                <span className="text-[10px] text-surface-500 italic truncate max-w-[200px]">
                                  — {plan.note}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono text-surface-300">
                              {plan?.completed_words ?? 0}/{plan?.target_words ?? dailyGoal}
                            </span>
                          </div>
                          <div className="w-full bg-surface-700/50 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              className={`h-full rounded-full ${
                                pct >= 100
                                  ? 'bg-accent-primary'
                                  : pct >= 50
                                    ? 'bg-gradient-to-r from-accent-primary/60 to-accent-primary'
                                    : 'bg-surface-500'
                              }`}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pct >= 100 && <CheckCircle2 className="w-4 h-4 text-accent-primary" />}
                          <button
                            onClick={() => handleStartEdit(plan || {
                              id: '', plan_date: dateStr, target_words: dailyGoal,
                              completed_words: 0, note: null, created_at: '', updated_at: '',
                            })}
                            className="p-1.5 rounded-lg text-surface-500 hover:text-accent-info hover:bg-surface-700/50 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-accent-secondary" />
                <h2 className="text-lg font-semibold text-surface-100">我的自定义计划</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                新建计划
              </button>
            </div>

            {customPlans.length === 0 ? (
              <div className="card-data rounded-2xl p-12 text-center">
                <BookOpen className="w-12 h-12 text-surface-600 mx-auto mb-4" />
                <p className="text-surface-400 mb-2">还没有自定义计划</p>
                <p className="text-surface-500 text-sm mb-4">创建自定义计划来追踪长期学习目标</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  创建第一个计划
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {customPlans.map((plan) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-data rounded-2xl p-6"
                  >
                    {editingCustomPlan?.id === plan.id ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-surface-400 mb-1 block">计划名称</label>
                          <input
                            type="text"
                            value={editingCustomPlan.title}
                            onChange={(e) => setEditingCustomPlan({ ...editingCustomPlan, title: e.target.value })}
                            className="input-field w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-surface-400 mb-1 block">描述</label>
                          <input
                            type="text"
                            value={editingCustomPlan.description || ''}
                            onChange={(e) => setEditingCustomPlan({ ...editingCustomPlan, description: e.target.value })}
                            className="input-field w-full text-sm"
                            placeholder="可选描述..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-surface-400 mb-1 block">词组</label>
                            <select
                              value={editingCustomPlan.tag_id || ''}
                              onChange={(e) => setEditingCustomPlan({ ...editingCustomPlan, tag_id: e.target.value || null })}
                              className="input-field w-full text-sm"
                            >
                              <option value="">全部词汇</option>
                              {tags.map((tag) => (
                                <option key={tag.id} value={tag.id}>{tag.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-surface-400 mb-1 block">目标词数</label>
                            <input
                              type="number"
                              value={editingCustomPlan.target_words}
                              onChange={(e) => setEditingCustomPlan({ ...editingCustomPlan, target_words: Number(e.target.value) })}
                              min={1}
                              className="input-field w-full text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-surface-400 mb-1 block">开始日期</label>
                            <input
                              type="date"
                              value={editingCustomPlan.start_date}
                              onChange={(e) => setEditingCustomPlan({ ...editingCustomPlan, start_date: e.target.value })}
                              className="input-field w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-surface-400 mb-1 block">结束日期</label>
                            <input
                              type="date"
                              value={editingCustomPlan.end_date}
                              onChange={(e) => setEditingCustomPlan({ ...editingCustomPlan, end_date: e.target.value })}
                              className="input-field w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-surface-400 mb-1 block">每日目标</label>
                            <input
                              type="number"
                              value={editingCustomPlan.daily_goal}
                              onChange={(e) => setEditingCustomPlan({ ...editingCustomPlan, daily_goal: Number(e.target.value) })}
                              min={1}
                              className="input-field w-full text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handleUpdateCustomPlan} className="btn-primary text-sm px-4 py-2 flex items-center gap-1">
                            <Save className="w-4 h-4" />保存
                          </button>
                          <button onClick={() => setEditingCustomPlan(null)} className="btn-secondary text-sm px-4 py-2 flex items-center gap-1">
                            <X className="w-4 h-4" />取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-surface-100">{plan.title}</h3>
                              {!plan.is_active && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-700 text-surface-400">
                                  已暂停
                                </span>
                              )}
                            </div>
                            {plan.description && (
                              <p className="text-sm text-surface-400">{plan.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {plan.tag_name && (
                                <span className="text-xs px-2 py-1 rounded-md bg-accent-primary/10 text-accent-primary">
                                  {plan.tag_name}
                                </span>
                              )}
                              <span className="text-xs text-surface-500">
                                {plan.start_date} ~ {plan.end_date}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingCustomPlan(plan)}
                              className="p-2 rounded-lg text-surface-500 hover:text-accent-info hover:bg-surface-700/50 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomPlan(plan.id)}
                              className="p-2 rounded-lg text-surface-500 hover:text-accent-error hover:bg-surface-700/50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-surface-400">学习进度</span>
                              <span className="text-xs font-mono text-accent-primary">
                                {plan.completed_words}/{plan.target_words} 词 ({plan.progress_percent}%)
                              </span>
                            </div>
                            <div className="w-full bg-surface-700/50 rounded-full h-2.5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${plan.progress_percent}%` }}
                                className="h-full rounded-full bg-gradient-to-r from-accent-primary/60 to-accent-primary"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs text-surface-500">
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              每日 {plan.daily_goal} 词
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              还剩 {Math.max(0, Math.ceil((parseLocalDate(plan.end_date).getTime() - syncedNow.getTime()) / (1000 * 60 * 60 * 24)))} 天
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleApplyToWeek(plan)}
                              className="text-xs text-accent-primary hover:text-accent-secondary transition-colors flex items-center gap-1"
                            >
                              <Calendar className="w-3 h-3" />
                              应用到周计划
                            </button>
                            <button
                              onClick={() => handleUpdateProgress(plan.id)}
                              className="text-xs text-accent-info hover:text-accent-primary transition-colors flex items-center gap-1"
                            >
                              <TrendingUp className="w-3 h-3" />
                              更新进度
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-800 rounded-2xl p-6 w-full max-w-lg border border-surface-700/50"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-surface-100">新建自定义计划</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg hover:bg-surface-700/50 text-surface-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">计划名称 *</label>
                  <input
                    type="text"
                    value={newPlan.title}
                    onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                    className="input-field w-full text-sm"
                    placeholder="例如：考研词汇冲刺"
                  />
                </div>
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">描述</label>
                  <input
                    type="text"
                    value={newPlan.description}
                    onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                    className="input-field w-full text-sm"
                    placeholder="可选描述..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">词组</label>
                    <select
                      value={newPlan.tag_id}
                      onChange={(e) => setNewPlan({ ...newPlan, tag_id: e.target.value })}
                      className="input-field w-full text-sm"
                    >
                      <option value="">全部词汇</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">目标词数</label>
                    <input
                      type="number"
                      value={newPlan.target_words}
                      onChange={(e) => setNewPlan({ ...newPlan, target_words: Number(e.target.value) })}
                      min={1}
                      className="input-field w-full text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">开始日期</label>
                    <input
                      type="date"
                      value={newPlan.start_date}
                      onChange={(e) => setNewPlan({ ...newPlan, start_date: e.target.value })}
                      className="input-field w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">结束日期</label>
                    <input
                      type="date"
                      value={newPlan.end_date}
                      onChange={(e) => setNewPlan({ ...newPlan, end_date: e.target.value })}
                      className="input-field w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">每日目标</label>
                    <input
                      type="number"
                      value={newPlan.daily_goal}
                      onChange={(e) => setNewPlan({ ...newPlan, daily_goal: Number(e.target.value) })}
                      min={1}
                      className="input-field w-full text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleCreateCustomPlan}
                    disabled={!newPlan.title}
                    className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
                  >
                    创建计划
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary flex-1 text-sm py-2"
                  >
                    取消
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}

export default function StudyPlanRoute() {
  return <StudyPlanPage />
}
