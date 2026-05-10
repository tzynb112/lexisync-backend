'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Edit3,
  BookOpen,
  GraduationCap,
  School,
  Tag,
  Loader2,
  Check,
  X,
  ArrowRight,
  Users,
} from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'

const COLORS = [
  '#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#ea580c', '#4f46e5', '#be185d', '#0284c7',
]

const GROUP_ICONS: Record<string, React.ElementType> = {
  '小学词汇': School,
  '中考词汇': School,
  '高考词汇': GraduationCap,
  '四级词汇': GraduationCap,
  '六级词汇': GraduationCap,
  '考研词汇': GraduationCap,
  '雅思词汇': BookOpen,
  '托福词汇': BookOpen,
  'GRE': BookOpen,
}

interface Group {
  id: string
  name: string
  color: string
  word_count: number
  created_at: string
  type?: 'tag' | 'category'
  description?: string | null
  icon?: string | null
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#e11d48')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchGroups = useCallback(async () => {
    try {
      const [tagsData, categoriesData] = await Promise.all([
        api.tags.list().catch(() => []),
        api.words.categories().catch(() => []),
      ])
      const tags = Array.isArray(tagsData) ? tagsData : ((tagsData as any)?.tags || [])
      const categories = Array.isArray(categoriesData) ? categoriesData : []

      const tagGroups: Group[] = tags
        .filter((t: any) => !t.is_system)
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          word_count: t.word_count || 0,
          created_at: t.created_at,
          type: 'tag' as const,
        }))

      const categoryGroups: Group[] = categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        word_count: c.word_count || 0,
        created_at: c.created_at,
        type: 'category',
        description: c.description,
        icon: c.icon,
      }))

      // 系统分类排在前面
      setGroups([...categoryGroups, ...tagGroups])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const handleCreate = async () => {
    if (!formName.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.tags.create({ name: formName.trim(), color: formColor })
      await fetchGroups()
      setShowCreate(false)
      setFormName('')
      setFormColor('#e11d48')
    } catch (err: any) {
      setError(err.message || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingGroup || !formName.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.tags.update(editingGroup.id, { name: formName.trim(), color: formColor })
      await fetchGroups()
      setEditingGroup(null)
      setFormName('')
    } catch (err: any) {
      setError(err.message || '更新失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group: Group) => {
    if (group.type === 'category') {
      alert('系统分类不能删除')
      return
    }
    if (!confirm(`确定要删除 "${group.name}" 吗？分组内的单词不会删除，只是移除标签。`)) return
    try {
      await api.tags.delete(group.id)
      await fetchGroups()
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  const startEdit = (group: Group) => {
    if (group.type === 'category') {
      alert('系统分类不能编辑')
      return
    }
    setEditingGroup(group)
    setFormName(group.name)
    setFormColor(group.color)
    setError('')
  }

  const cancelEdit = () => {
    setEditingGroup(null)
    setShowCreate(false)
    setFormName('')
    setError('')
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

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-surface-100">词汇分组管理</h1>
            <p className="text-surface-400 text-sm mt-1">
              共 {groups.length} 个分组，创建自定义分组来分类你的词汇
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setEditingGroup(null); setError('') }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-primary/15
                       text-accent-primary border border-accent-primary/30
                       hover:bg-accent-primary/25 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建分组
          </button>
        </div>

        {/* 表单区 */}
        <AnimatePresence>
          {(showCreate || editingGroup) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-5 rounded-xl border border-surface-700/40 bg-surface-800/50 backdrop-blur-sm"
            >
              <h3 className="text-sm font-semibold text-surface-100 mb-4">
                {editingGroup ? `编辑分组: ${editingGroup.name}` : '创建新分组'}
              </h3>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-accent-error/10 border border-accent-error/20 text-accent-error text-xs">
                  {error}
                </div>
              )}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-surface-400 mb-1.5">分组名称</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例如：雅思词汇、四级词汇"
                    className="w-full px-4 py-2.5 rounded-lg bg-surface-900/60 border border-surface-600/30
                               text-surface-100 text-sm placeholder:text-surface-500
                               focus:outline-none focus:border-accent-primary/40 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && (editingGroup ? handleUpdate() : handleCreate())}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-surface-400 mb-1.5">颜色</label>
                  <div className="flex gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFormColor(c)}
                        className="w-7 h-7 rounded-full border-2 transition-all"
                        style={{
                          backgroundColor: c,
                          borderColor: formColor === c ? '#ffffff' : 'transparent',
                          boxShadow: formColor === c ? `0 0 8px ${c}60` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={editingGroup ? handleUpdate : handleCreate}
                    disabled={saving || !formName.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-accent-primary
                               text-surface-950 text-sm font-semibold hover:bg-accent-primary/90
                               disabled:opacity-40 transition-colors"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {editingGroup ? '保存' : '创建'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg
                               text-surface-400 text-sm hover:text-surface-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    取消
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 分组列表 */}
        {groups.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-surface-800/50 border border-surface-700/30
                           flex items-center justify-center mx-auto mb-4">
              <Tag className="w-8 h-8 text-surface-500" />
            </div>
            <h3 className="text-surface-300 font-medium mb-1">还没有词汇分组</h3>
            <p className="text-surface-500 text-sm mb-4">创建你的第一个分组来组织词汇</p>
            <button
              onClick={() => { setShowCreate(true); setEditingGroup(null); setError('') }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新建分组
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((group, i) => {
              const Icon = GROUP_ICONS[group.name] || BookOpen
              const isCategory = group.type === 'category'
              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`group/card p-5 rounded-xl border-2 transition-all duration-200
                    ${isCategory
                      ? 'border-surface-600/30 bg-surface-800/50'
                      : 'border-surface-700/20 bg-surface-800/30 hover:border-surface-500/40'
                    }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl border flex items-center justify-center"
                        style={{
                          backgroundColor: `${group.color}15`,
                          borderColor: `${group.color}30`,
                        }}
                      >
                        <Icon className="w-6 h-6" style={{ color: group.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-surface-100 font-semibold">{group.name}</h3>
                          {isCategory && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-400">
                              系统
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-surface-400 font-mono">
                          {group.word_count} 个单词
                        </span>
                      </div>
                    </div>
                    {!isCategory && (
                      <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(group)}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-accent-primary
                                     hover:bg-accent-primary/10 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(group)}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-accent-error
                                     hover:bg-accent-error/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="w-full bg-surface-700/30 rounded-full h-1.5 overflow-hidden mb-4">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(3, group.word_count * 0.5))}%`,
                        backgroundColor: group.color,
                      }}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/study?group=${group.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                                 text-xs font-medium border transition-colors"
                      style={{
                        color: group.color,
                        borderColor: `${group.color}30`,
                        backgroundColor: `${group.color}08`,
                      }}
                    >
                      开始学习
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href={isCategory ? `/words?category_id=${group.id}` : `/words?tag_id=${group.id}`}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                                 text-xs text-surface-400 border border-surface-700/30
                                 hover:text-surface-200 hover:border-surface-500/40 transition-colors"
                    >
                      <Users className="w-3 h-3" />
                      查看词汇
                    </Link>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
