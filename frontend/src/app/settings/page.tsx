'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon,
  Target,
  Volume2,
  Sparkles,
  LayoutGrid,
  ListChecks,
  PenLine,
  Save,
  Loader2,
  CheckCircle2,
  Bell,
  Clock,
} from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'
import type { UserSettings, StudyMode } from '@/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.tags.getSettings().then((data: any) => {
      setSettings(data)
    }).catch(() => {
      setSettings({
        daily_goal: 20,
        preferred_study_mode: 'flashcard',
        enable_sound: true,
        reminder_enabled: false,
        reminder_time: '09:00',
      })
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    try {
      const payload: Record<string, any> = {
        daily_goal: settings.daily_goal,
        preferred_study_mode: settings.preferred_study_mode,
        enable_sound: settings.enable_sound,
        reminder_enabled: settings.reminder_enabled,
        reminder_time: settings.reminder_time,
      }
      const updated = await api.tags.updateSettings(payload) as any
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      console.error('保存设置失败:', err)
      alert(err?.message || '保存失败，请检查网络连接')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      </AppShell>
    )
  }

  const studyModes: { id: StudyMode; label: string; icon: any; desc: string }[] = [
    { id: 'flashcard', label: '闪卡模式', icon: LayoutGrid, desc: '翻转卡片自评' },
    { id: 'choice', label: '选择题', icon: ListChecks, desc: '四选一快检' },
    { id: 'spelling', label: '拼写模式', icon: PenLine, desc: '深度拼写记忆' },
  ]

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-100 tracking-tight">设置</h1>
            <p className="text-surface-400 text-sm mt-1 font-mono">个性化学习偏好</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved ? '已保存' : '保存'}
          </button>
        </div>

        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-accent-primary" />
            <h2 className="section-title">每日目标</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-surface-300 mb-2 block">每日复习目标（个）</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={settings?.daily_goal ?? 20}
                  onChange={(e) =>
                    setSettings((s) => s ? { ...s, daily_goal: parseInt(e.target.value) } : s)
                  }
                  className="flex-1 accent-accent-primary"
                />
                <span className="text-lg font-mono font-bold text-accent-primary w-12 text-right">
                  {settings?.daily_goal ?? 20}
                </span>
              </div>
              <p className="text-xs text-surface-500 mt-1">建议每天复习 20-50 个单词</p>
            </div>
          </div>
        </div>

        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <LayoutGrid className="w-5 h-5 text-accent-secondary" />
            <h2 className="section-title">默认学习模式</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {studyModes.map((mode) => {
              const Icon = mode.icon
              const isActive = settings?.preferred_study_mode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() =>
                    setSettings((s) => s ? { ...s, preferred_study_mode: mode.id } : s)
                  }
                  className={`p-4 rounded-xl border text-center transition-colors
                    ${isActive
                      ? 'border-accent-primary/50 bg-accent-primary/10'
                      : 'border-surface-700/50 hover:border-surface-600/50'
                    }`}
                >
                  <Icon className={`w-6 h-6 mx-auto mb-2 ${isActive ? 'text-accent-primary' : 'text-surface-400'}`} />
                  <p className={`text-sm font-semibold ${isActive ? 'text-accent-primary' : 'text-surface-300'}`}>
                    {mode.label}
                  </p>
                  <p className="text-[10px] text-surface-500 mt-0.5">{mode.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-accent-info" />
            <h2 className="section-title">功能开关</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-200">音效</p>
                <p className="text-xs text-surface-500">复习时播放提示音</p>
              </div>
              <button
                onClick={() =>
                  setSettings((s) => s ? { ...s, enable_sound: !s.enable_sound } : s)
                }
                className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-0.5
                  ${settings?.enable_sound ? 'bg-accent-primary' : 'bg-surface-600'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200
                  ${settings?.enable_sound ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
        </div>
        </div>

        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-amber-400" />
            <h2 className="section-title">学习提醒</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-200">浏览器通知</p>
                <p className="text-xs text-surface-500">在设定时间发送学习提醒</p>
              </div>
              <button
                onClick={() =>
                  setSettings((s) => s ? { ...s, reminder_enabled: !s.reminder_enabled } : s)
                }
                className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-0.5
                  ${settings?.reminder_enabled ? 'bg-accent-primary' : 'bg-surface-600'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200
                  ${settings?.reminder_enabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {settings?.reminder_enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-3"
              >
                <Clock className="w-4 h-4 text-surface-400" />
                <label className="text-sm text-surface-300">提醒时间</label>
                <input
                  type="time"
                  value={settings?.reminder_time ?? '09:00'}
                  onChange={(e) =>
                    setSettings((s) => s ? { ...s, reminder_time: e.target.value } : s)
                  }
                  className="input-field text-sm py-1.5 w-32"
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
