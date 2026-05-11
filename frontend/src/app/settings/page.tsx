'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Target,
  LayoutGrid,
  ListChecks,
  PenLine,
  Save,
  Loader2,
  CheckCircle2,
  Bell,
  Clock,
  Sun,
  Moon,
  Languages,
} from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'
import { useTheme } from '@/lib/theme'
import { useLanguage } from '@/lib/language'
import type { UserSettings, StudyMode } from '@/types'

const textByLang = {
  zh: {
    title: '设置',
    subtitle: '个性化学习体验',
    save: '保存',
    saved: '已保存',
    dailyGoal: '每日目标',
    dailyGoalHint: '建议每天 20-50 个',
    studyMode: '默认学习模式',
    flashcard: '闪卡',
    choice: '选择题',
    spelling: '拼写',
    flashcardDesc: '翻卡自评',
    choiceDesc: '快速测验',
    spellingDesc: '深度记忆',
    appearance: '外观与语言',
    theme: '主题',
    light: '亮色模式',
    dark: '暗色模式',
    language: '界面语言',
    reminder: '学习提醒',
    reminderToggle: '启用提醒',
    reminderTime: '提醒时间',
    sounds: '音效',
    soundsHint: '复习时播放提示音',
  },
  en: {
    title: 'Settings',
    subtitle: 'Personalize your learning',
    save: 'Save',
    saved: 'Saved',
    dailyGoal: 'Daily Goal',
    dailyGoalHint: 'Recommended: 20-50 per day',
    studyMode: 'Default Study Mode',
    flashcard: 'Flashcard',
    choice: 'Choice',
    spelling: 'Spelling',
    flashcardDesc: 'Flip and rate',
    choiceDesc: 'Quick quiz',
    spellingDesc: 'Deep memory',
    appearance: 'Appearance & Language',
    theme: 'Theme',
    light: 'Light Mode',
    dark: 'Dark Mode',
    language: 'Language',
    reminder: 'Study Reminder',
    reminderToggle: 'Enable reminder',
    reminderTime: 'Reminder time',
    sounds: 'Sound',
    soundsHint: 'Play sound during review',
  },
} as const

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage } = useLanguage()
  const i18n = textByLang[language]

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
      alert(err?.message || 'Save failed')
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
    { id: 'flashcard', label: i18n.flashcard, icon: LayoutGrid, desc: i18n.flashcardDesc },
    { id: 'choice', label: i18n.choice, icon: ListChecks, desc: i18n.choiceDesc },
    { id: 'spelling', label: i18n.spelling, icon: PenLine, desc: i18n.spellingDesc },
  ]

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-100">{i18n.title}</h1>
            <p className="text-sm text-surface-400 mt-1">{i18n.subtitle}</p>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? i18n.saved : i18n.save}
          </button>
        </div>

        <div className="card-data rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-accent-primary" />
            <h2 className="section-title">{i18n.dailyGoal}</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={settings?.daily_goal ?? 20}
                onChange={(e) => setSettings((s) => s ? { ...s, daily_goal: parseInt(e.target.value, 10) } : s)}
                className="flex-1 accent-accent-primary"
              />
              <span className="text-lg font-mono font-bold text-accent-primary w-12 text-right">{settings?.daily_goal ?? 20}</span>
            </div>
            <p className="text-xs text-surface-500">{i18n.dailyGoalHint}</p>
          </div>
        </div>

        <div className="card-data rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-accent-secondary" />
            <h2 className="section-title">{i18n.studyMode}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {studyModes.map((mode) => {
              const Icon = mode.icon
              const isActive = settings?.preferred_study_mode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => setSettings((s) => s ? { ...s, preferred_study_mode: mode.id } : s)}
                  className={`p-3 rounded-xl border text-left transition-colors ${isActive ? 'border-accent-primary/50 bg-accent-primary/10' : 'border-surface-700/50 hover:border-surface-600/50'}`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-accent-primary' : 'text-surface-400'}`} />
                  <p className={`text-sm font-semibold ${isActive ? 'text-accent-primary' : 'text-surface-300'}`}>{mode.label}</p>
                  <p className="text-[11px] text-surface-500 mt-0.5">{mode.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="card-data rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sun className="w-5 h-5 text-accent-warning" />
            <h2 className="section-title">{i18n.appearance}</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-200">{i18n.theme}</p>
                <p className="text-xs text-surface-500">{theme === 'dark' ? i18n.dark : i18n.light}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {theme === 'dark' ? i18n.light : i18n.dark}
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-surface-700/30 pt-4">
              <div>
                <p className="text-sm text-surface-200">{i18n.language}</p>
                <p className="text-xs text-surface-500">{language === 'zh' ? '中文' : 'English'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLanguage('zh')}
                  className={`px-3 py-1.5 rounded-lg text-xs ${language === 'zh' ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30' : 'bg-surface-700/40 text-surface-400 border border-surface-600/30'}`}
                >
                  中文
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1.5 rounded-lg text-xs ${language === 'en' ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30' : 'bg-surface-700/40 text-surface-400 border border-surface-600/30'}`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card-data rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-accent-info" />
            <h2 className="section-title">{i18n.reminder}</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-200">{i18n.reminderToggle}</p>
                <p className="text-xs text-surface-500">{i18n.soundsHint}</p>
              </div>
              <button
                onClick={() => setSettings((s) => s ? { ...s, reminder_enabled: !s.reminder_enabled } : s)}
                className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-0.5 ${settings?.reminder_enabled ? 'bg-accent-primary' : 'bg-surface-600'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${settings?.reminder_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {settings?.reminder_enabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-surface-400" />
                <label className="text-sm text-surface-300">{i18n.reminderTime}</label>
                <input
                  type="time"
                  value={settings?.reminder_time ?? '09:00'}
                  onChange={(e) => setSettings((s) => s ? { ...s, reminder_time: e.target.value } : s)}
                  className="input-field text-sm py-1.5 w-32"
                />
              </motion.div>
            )}

            <div className="flex items-center justify-between border-t border-surface-700/30 pt-4">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-surface-400" />
                <div>
                  <p className="text-sm text-surface-200">{i18n.sounds}</p>
                  <p className="text-xs text-surface-500">{i18n.soundsHint}</p>
                </div>
              </div>
              <button
                onClick={() => setSettings((s) => s ? { ...s, enable_sound: !s.enable_sound } : s)}
                className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-0.5 ${settings?.enable_sound ? 'bg-accent-primary' : 'bg-surface-600'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${settings?.enable_sound ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
