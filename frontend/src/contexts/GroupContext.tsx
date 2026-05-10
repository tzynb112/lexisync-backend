'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '@/lib/api'

export type GroupType = 'tag' | 'category'

export interface VocabularyGroup {
  id: string
  name: string
  color: string
  word_count: number
  created_at?: string
  type: GroupType
  description?: string | null
  icon?: string | null
}

export interface SelectedGroup {
  id: string
  type: GroupType
}

interface GroupContextType {
  selectedGroupId: string
  setSelectedGroupId: (id: string) => void
  selectedGroup: VocabularyGroup | null
  groups: VocabularyGroup[]
  loading: boolean
  selectedGroupType: GroupType
}

const GroupContext = createContext<GroupContextType | null>(null)

const STORAGE_KEY = 'lexisync_selected_group'

function parseStoredGroup(raw: string): SelectedGroup {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.id === 'string' && (parsed.type === 'tag' || parsed.type === 'category')) {
      return parsed
    }
  } catch {
    // 旧格式兼容：纯字符串 ID 视为 tag
  }
  return { id: raw, type: 'tag' }
}

export function GroupProvider({ children }: { children: ReactNode }) {
  const [selectedGroupId, setSelectedGroupIdState] = useState('')
  const [selectedType, setSelectedType] = useState<GroupType>('tag')
  const [groups, setGroups] = useState<VocabularyGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved) {
      const parsed = parseStoredGroup(saved)
      setSelectedGroupIdState(parsed.id)
      setSelectedType(parsed.type)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      api.tags.list().catch(() => []),
      api.words.categories().catch(() => []),
    ])
      .then(([tagsData, categoriesData]: [any, any]) => {
        const tags = Array.isArray(tagsData) ? tagsData : (tagsData?.tags || [])
        const categories = Array.isArray(categoriesData) ? categoriesData : []

        const tagGroups: VocabularyGroup[] = tags
          .filter((t: any) => !t.is_system)
          .map((t: any) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            word_count: t.word_count || 0,
            created_at: t.created_at,
            type: 'tag' as GroupType,
          }))

        const categoryGroups: VocabularyGroup[] = categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          word_count: c.word_count || 0,
          created_at: c.created_at,
          type: 'category' as GroupType,
          description: c.description,
          icon: c.icon,
        }))

        // 系统分类排在前面
        setGroups([...categoryGroups, ...tagGroups])
      })
      .catch((err) => {
        console.error('[GroupContext] 加载分组失败:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  const setSelectedGroupId = useCallback((id: string) => {
    const group = groups.find((g) => g.id === id)
    const type = group?.type || 'tag'
    setSelectedGroupIdState(id)
    setSelectedType(type)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, type }))
    }
  }, [groups])

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null

  return (
    <GroupContext.Provider
      value={{
        selectedGroupId,
        setSelectedGroupId,
        selectedGroup,
        groups,
        loading,
        selectedGroupType: selectedType,
      }}
    >
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const ctx = useContext(GroupContext)
  if (!ctx) {
    throw new Error('useGroup must be used within GroupProvider')
  }
  return ctx
}
