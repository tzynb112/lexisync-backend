'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  LogOut,
  Atom,
  Menu,
  Activity,
  Settings,
  AlertTriangle,
  Sun,
  Moon,
  Calendar,
  Trophy,
  Layers,
  FolderOpen,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'

import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useLanguage } from '@/lib/language'
import { useStudyReminder } from '@/hooks/useStudyReminder'
import { useGlobalShortcuts } from '@/hooks/useKeyboardShortcuts'
import { SearchBar } from '@/components/SearchBar'
import { api } from '@/lib/api'
import { GroupProvider, useGroup } from '@/contexts/GroupContext'

const navItems = [
  { href: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/study', key: 'nav.study', icon: GraduationCap },
  { href: '/words', key: 'nav.words', icon: BookOpen },
  { href: '/groups', key: 'groups', icon: FolderOpen },
  { href: '/stats', key: 'nav.stats', icon: Activity },
  { href: '/study-plan', key: 'nav.plan', icon: Calendar },
  { href: '/leaderboard', key: 'nav.leaderboard', icon: Trophy },
  { href: '/learning-paths', key: 'learningPaths', icon: Layers },
  { href: '/wrong-words', key: 'nav.wrongWords', icon: AlertTriangle },
  { href: '/settings', key: 'nav.settings', icon: Settings },
]

const fallbackLabels: Record<string, { zh: string; en: string }> = {
  groups: { zh: '分组管理', en: 'Groups' },
  learningPaths: { zh: '学习路径', en: 'Learning Paths' },
}

function GroupSelectorInHeader({ className = '' }: { className?: string }) {
  const { selectedGroupId, setSelectedGroupId, groups } = useGroup()
  const { language } = useLanguage()

  const categories = groups.filter((g) => g.type === 'category')
  const customTags = groups.filter(
    (g) =>
      g.type === 'tag'
      && !g.is_system
      && !g.name.toLowerCase().includes('all words')
      && !g.name.includes('全部'),
  )

  return (
    <select
      value={selectedGroupId}
      onChange={(e) => setSelectedGroupId(e.target.value)}
      className={`bg-surface-800/60 border border-surface-700/40 rounded-xl px-3 py-2.5 text-sm font-mono
                 text-surface-300 focus:outline-none focus:border-accent-primary/50 transition-colors
                 min-w-[160px] cursor-pointer appearance-none bg-no-repeat
                 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')]
                 bg-[length:16px] bg-[right_8px_center] pr-8 ${className}`}
    >
      <option value="">{language === 'zh' ? '全部词汇' : 'All Words'}</option>
      {categories.length > 0 && (
        <optgroup label={language === 'zh' ? '系统分组' : 'System Groups'}>
          {categories.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.word_count})
            </option>
          ))}
        </optgroup>
      )}
      {customTags.length > 0 && (
        <optgroup label={language === 'zh' ? '我的标签' : 'My Tags'}>
          {customTags.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.word_count})
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, loading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settings, setSettings] = useState<{ reminder_enabled: boolean; reminder_time: string }>({
    reminder_enabled: false,
    reminder_time: '09:00',
  })

  useStudyReminder(settings.reminder_enabled, settings.reminder_time)
  useGlobalShortcuts()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      api.tags.getSettings().then((s: any) => {
        setSettings({ reminder_enabled: s.reminder_enabled, reminder_time: s.reminder_time })
      }).catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (!sidebarOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const handleLogout = () => {
    logout()
  }

  const labelFor = (key: string) => {
    const translated = t(key)
    if (translated !== key) return translated
    const fallback = fallbackLabels[key]
    if (!fallback) return key
    return language === 'zh' ? fallback.zh : fallback.en
  }

  const appSubtitle = language === 'zh' ? '词汇引擎' : 'Vocab Engine'
  const logoutLabel = language === 'zh' ? '退出登录' : 'Logout'
  const modeLabel = theme === 'dark'
    ? (language === 'zh' ? '亮色模式' : 'Light Mode')
    : (language === 'zh' ? '暗色模式' : 'Dark Mode')
  const langToggleLabel = language === 'zh' ? 'English' : '中文'

  if (loading || !user) {
    return (
      <GroupProvider>
        <div className="flex items-center justify-center min-h-screen bg-surface-950">
          <Atom className="w-10 h-10 text-accent-primary animate-spin" style={{ animationDuration: '3s' }} />
        </div>
      </GroupProvider>
    )
  }

  return (
    <GroupProvider>
      <div className="flex h-screen overflow-hidden bg-surface-950 text-surface-100">
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[320px] bg-surface-900/96 backdrop-blur-xl
            border-r border-surface-700/40 transform transition-transform duration-300
            lg:relative lg:translate-x-0 lg:w-64 lg:max-w-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-surface-700/40">
              <div className="relative">
                <Atom className="w-7 h-7 text-accent-primary" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
              </div>
              <div>
                <span className="text-lg font-bold text-surface-100 tracking-tight">TZYNB</span>
                <p className="text-[9px] text-accent-primary/60 font-mono tracking-widest uppercase">{appSubtitle}</p>
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-colors duration-200
                      ${isActive
                        ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20 shadow-[0_0_10px_rgba(0,229,191,0.08)]'
                        : 'text-surface-300 hover:bg-surface-700/40 hover:text-surface-100 border border-transparent'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {labelFor(item.key)}
                  </Link>
                )
              })}
            </nav>

            <div className="px-3 py-4 border-t border-surface-700/40">
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className="w-8 h-8 rounded-lg bg-accent-primary/15 border border-accent-primary/25 flex items-center justify-center">
                  <span className="text-xs font-bold text-accent-primary font-mono">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-100 truncate">{user?.username}</p>
                  <p className="text-[10px] text-surface-500 truncate font-mono">{user?.email}</p>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
                           text-surface-400 hover:text-accent-warning hover:bg-accent-warning/10
                           transition-colors duration-200 mb-1"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {modeLabel}
              </button>

              <button
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
                           text-surface-400 hover:text-accent-info hover:bg-accent-info/10
                           transition-colors duration-200 mb-1"
              >
                <span className="w-4 h-4 flex items-center justify-center text-xs font-mono">
                  {language === 'zh' ? 'EN' : '中'}
                </span>
                {langToggleLabel}
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
                           text-surface-400 hover:text-accent-error hover:bg-accent-error/10
                           transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                {logoutLabel}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden sticky top-0 z-30 flex flex-col gap-3 px-4 py-3 border-b border-surface-700/40 bg-surface-900/80 backdrop-blur-md">
            <div className="flex items-center justify-between w-full">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-surface-300 hover:text-surface-100 hover:bg-surface-700/40"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Atom className="w-5 h-5 text-accent-primary" />
                <span className="text-sm font-bold text-surface-100 tracking-tight">TZYNB</span>
              </div>
              <div className="w-9" />
            </div>
            <GroupSelectorInHeader className="w-full min-w-0" />
          </header>

          <div className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-surface-700/40 bg-surface-900/50 backdrop-blur-md">
            <GroupSelectorInHeader />
            <SearchBar />
          </div>

          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/4 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </GroupProvider>
  )
}
