'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  X,
  FileJson,
  FileSpreadsheet,
  Rocket,
  Star,
  Tag as TagIcon,
  Heart,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/AppShell'
import { SpeakButton } from '@/components/SpeakButton'
import { api } from '@/lib/api'
import { useGroup } from '@/contexts/GroupContext'
import type { Word, Tag, BatchOperationResult, PaginatedWordsResponse } from '@/types'

type ImportFormat = 'csv' | 'json'

const PART_OF_SPEECH_OPTIONS = [
  { value: '', label: '全部词性' },
  { value: 'noun', label: '名词' },
  { value: 'verb', label: '动词' },
  { value: 'adjective', label: '形容词' },
  { value: 'adverb', label: '副词' },
  { value: 'preposition', label: '介词' },
  { value: 'conjunction', label: '连词' },
]

function WordManager({ initialTagId }: { initialTagId?: string }) {
  const [words, setWords] = useState<Word[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [showTagMenu, setShowTagMenu] = useState<string | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  const { selectedGroupId, setSelectedGroupId, selectedGroupType } = useGroup()

  const [filterPos, setFilterPos] = useState('')
  const [filterTagId, setFilterTagId] = useState(initialTagId || '')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [sortBy, setSortBy] = useState<'word' | 'created_at'>('word')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showFilters, setShowFilters] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalWords, setTotalWords] = useState(0)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)

  const [newWord, setNewWord] = useState({
    word: '',
    definition: '',
    phonetic: '',
    part_of_speech: '',
  })

  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#00e5bf')

  useEffect(() => {
    if (selectedGroupType === 'category') {
      setFilterCategoryId(selectedGroupId)
      setFilterTagId('')
    } else {
      setFilterTagId(selectedGroupId || '')
      setFilterCategoryId('')
    }
  }, [selectedGroupId, selectedGroupType])

  const fetchWords = useCallback(async (q = '', page = 1) => {
    setLoading(true)
    setError('')
    try {
      const data = await api.words.list(q, page, {
        part_of_speech: filterPos || undefined,
        tag_id: filterTagId || undefined,
        category_id: filterCategoryId || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      }) as PaginatedWordsResponse
      setWords(data.words)
      setTotalPages(data.total_pages)
      setTotalWords(data.total)
      setCurrentPage(data.page)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filterPos, filterTagId, filterCategoryId, sortBy, sortOrder])

  const fetchTags = async () => {
    try {
      const data = await api.tags.list() as Tag[]
      setTags(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchWords()
    fetchTags()
  }, [fetchWords])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchWords(searchQuery, 1)
  }

  const handlePageChange = (page: number) => {
    fetchWords(searchQuery, page)
  }

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWord.word || !newWord.definition) return
    try {
      const created = await api.words.create({
        word: newWord.word,
        definition: newWord.definition,
        phonetic: newWord.phonetic || undefined,
        part_of_speech: newWord.part_of_speech || undefined,
      }) as Word

      // 关联到当前选中的分组
      if (selectedGroupType === 'category' && filterCategoryId) {
        await api.words.addToCategory(created.id, filterCategoryId).catch((err) => {
          console.error('添加到分类失败:', err)
        })
      } else if (filterTagId) {
        await api.tags.addWordTag(created.id, filterTagId).catch((err) => {
          console.error('添加标签失败:', err)
        })
      }

      const allWordsTag = tags.find((t) => t.name === '全部词汇')
      if (allWordsTag && allWordsTag.id !== filterTagId) {
        await api.tags.addWordTag(created.id, allWordsTag.id).catch((err) => {
          console.error('添加全部词汇标签失败:', err)
        })
      }

      setSuccessMsg(`"${newWord.word}" 添加成功`)
      setNewWord({ word: '', definition: '', phonetic: '', part_of_speech: '' })
      setShowAddForm(false)
      fetchWords(searchQuery, 1)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.message || '添加失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>, format: ImportFormat) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      let imported: any
      if (format === 'csv') {
        imported = await api.words.importCsv(file)
      } else {
        imported = await api.words.importJson(file)
      }
      setSuccessMsg(`成功导入 ${imported.length} 个单词 (${format.toUpperCase()})`)
      fetchWords(searchQuery, 1)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.message || `导入 ${format.toUpperCase()} 失败`)
      setTimeout(() => setError(''), 3000)
    }
    if (format === 'csv' && csvInputRef.current) csvInputRef.current.value = ''
    if (format === 'json' && jsonInputRef.current) jsonInputRef.current.value = ''
  }

  const handleStartLearning = async (wordId: string) => {
    try {
      await api.review.start(wordId)
      setSuccessMsg('已加入学习队列')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.message || '操作失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleStartAll = async () => {
    if (!confirm('确认将所有单词加入学习队列？')) return
    setLoading(true)
    try {
      const isCategory = selectedGroupType === 'category'
      const result = await api.review.startAll(
        isCategory ? undefined : (selectedGroupId || undefined),
        isCategory ? selectedGroupId : undefined
      ) as any
      setSuccessMsg(`已添加 ${result.added} 个单词！${result.skipped > 0 ? `(${result.skipped} 个已在队列中)` : ''}`)
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err: any) {
      setError(err.message || '操作失败')
      setTimeout(() => setError(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFavorite = async (wordId: string) => {
    try {
      const result = await api.tags.toggleFavorite(wordId) as any
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (result.favorited) {
          next.add(wordId)
        } else {
          next.delete(wordId)
        }
        return next
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    try {
      await api.tags.create({ name: newTagName.trim(), color: newTagColor })
      setNewTagName('')
      fetchTags()
    } catch (err: any) {
      setError(err.message || '创建标签失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleAddWordTag = async (wordId: string, tagId: string) => {
    try {
      await api.tags.addWordTag(wordId, tagId)
      setSuccessMsg('标签已添加')
      setTimeout(() => setSuccessMsg(''), 2000)
    } catch (err: any) {
      if (err.status !== 409) {
        setError(err.message || '添加标签失败')
        setTimeout(() => setError(''), 3000)
      }
    }
    setShowTagMenu(null)
  }

  const handleDeleteTag = async (tagId: string) => {
    try {
      await api.tags.delete(tagId)
      if (filterTagId === tagId) setFilterTagId('')
      fetchTags()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteWord = async (wordId: string) => {
    if (!confirm('确定要删除这个单词吗？此操作不可撤销。')) return
    try {
      await api.words.delete(wordId)
      setSuccessMsg('单词已删除')
      setTimeout(() => setSuccessMsg(''), 3000)
      fetchWords(searchQuery, currentPage)
    } catch (err: any) {
      setError(err.message || '删除失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  const toggleSelect = (wordId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(wordId)) {
        next.delete(wordId)
      } else {
        next.add(wordId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === words.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(words.map((w) => w.id)))
    }
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleBatchStartLearning = async () => {
    if (selectedIds.size === 0) return
    setBatchLoading(true)
    try {
      const result = await api.words.batchStartLearning(Array.from(selectedIds)) as BatchOperationResult
      setSuccessMsg(`批量添加完成：成功 ${result.success}，跳过 ${result.skipped}，失败 ${result.failed}`)
      setTimeout(() => setSuccessMsg(''), 4000)
      exitSelectMode()
    } catch (err: any) {
      setError(err.message || '批量操作失败')
      setTimeout(() => setError(''), 3000)
    } finally {
      setBatchLoading(false)
    }
  }

  const handleBatchAddTag = async (tagId: string) => {
    if (selectedIds.size === 0) return
    setBatchLoading(true)
    try {
      const result = await api.words.batchAddTag(Array.from(selectedIds), tagId) as BatchOperationResult
      setSuccessMsg(`批量加标签完成：成功 ${result.success}，跳过 ${result.skipped}，失败 ${result.failed}`)
      setTimeout(() => setSuccessMsg(''), 4000)
      exitSelectMode()
    } catch (err: any) {
      setError(err.message || '批量操作失败')
      setTimeout(() => setError(''), 3000)
    } finally {
      setBatchLoading(false)
    }
  }

  const handleBatchFavorite = async () => {
    if (selectedIds.size === 0) return
    setBatchLoading(true)
    try {
      const result = await api.words.batchFavorite(Array.from(selectedIds)) as BatchOperationResult
      setSuccessMsg(`批量收藏完成：成功 ${result.success}，跳过 ${result.skipped}，失败 ${result.failed}`)
      setTimeout(() => setSuccessMsg(''), 4000)
      exitSelectMode()
    } catch (err: any) {
      setError(err.message || '批量操作失败')
      setTimeout(() => setError(''), 3000)
    } finally {
      setBatchLoading(false)
    }
  }

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const blob = await api.words.exportData(format) as any
      const url = window.URL.createObjectURL(new Blob([typeof blob === 'string' ? blob : JSON.stringify(blob)]))
      const a = document.createElement('a')
      a.href = url
      a.download = `lexisync_export.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setSuccessMsg(`导出成功 (${format.toUpperCase()})`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.message || '导出失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 tracking-tight">词汇管理</h1>
          <p className="text-surface-400 text-xs mt-1 font-mono">浏览、搜索和导入词汇</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleStartAll}
            className="btn-primary flex items-center gap-2 bg-accent-primary/20 text-accent-primary border-accent-primary/30 hover:bg-accent-primary/30"
          >
            <Rocket className="w-4 h-4" />
            全部开始
          </button>
          <button
            onClick={() => csvInputRef.current?.click()}
            className="btn-secondary flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            导入CSV
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => handleFileImport(e, 'csv')}
            className="hidden"
          />
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="btn-secondary flex items-center gap-2"
          >
            <FileJson className="w-4 h-4" />
            导入JSON
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            onChange={(e) => handleFileImport(e, 'json')}
            className="hidden"
          />
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加单词
          </button>
          <div className="relative group">
            <button className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              导出
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px]
                            bg-surface-800 border border-surface-700/50 rounded-lg
                            shadow-xl py-1 hidden group-hover:block">
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-3 py-1.5 text-xs text-surface-300
                           hover:bg-surface-700/50 flex items-center gap-2 transition-colors"
              >
                <FileJson className="w-3 h-3" />
                JSON 格式
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="w-full text-left px-3 py-1.5 text-xs text-surface-300
                           hover:bg-surface-700/50 flex items-center gap-2 transition-colors"
              >
                <FileSpreadsheet className="w-3 h-3" />
                CSV 格式
              </button>
            </div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-primary/8 border border-accent-primary/15 text-accent-primary text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-error/8 border border-accent-error/15 text-accent-error text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddWord} className="card-sci rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-100">添加新单词</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-surface-400 hover:text-surface-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-surface-400 mb-1 font-mono uppercase tracking-wider">单词 *</label>
              <input
                value={newWord.word}
                onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
                className="input-field"
                placeholder="例如：ubiquitous"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-surface-400 mb-1 font-mono uppercase tracking-wider">音标</label>
              <input
                value={newWord.phonetic}
                onChange={(e) => setNewWord({ ...newWord, phonetic: e.target.value })}
                className="input-field"
                placeholder="例如：juːˈbɪkwɪtəs"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-medium text-surface-400 mb-1 font-mono uppercase tracking-wider">定义 *</label>
              <textarea
                value={newWord.definition}
                onChange={(e) => setNewWord({ ...newWord, definition: e.target.value })}
                className="input-field min-h-[80px] resize-none"
                placeholder="输入定义..."
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-surface-400 mb-1 font-mono uppercase tracking-wider">词性</label>
              <select
                value={newWord.part_of_speech}
                onChange={(e) => setNewWord({ ...newWord, part_of_speech: e.target.value })}
                className="input-field"
              >
                <option value="">选择...</option>
                <option value="noun">名词</option>
                <option value="verb">动词</option>
                <option value="adjective">形容词</option>
                <option value="adverb">副词</option>
                <option value="preposition">介词</option>
                <option value="conjunction">连词</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary">取消</button>
            <button type="submit" className="btn-primary">添加单词</button>
          </div>
        </form>
      )}

      <div className="card-data rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TagIcon className="w-4 h-4 text-accent-secondary" />
          <h3 className="text-sm font-semibold text-surface-200">标签管理</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.filter((t) => !t.is_system).map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-700/50 bg-surface-800/50"
            >
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: tag.color }} />
              <span className="text-xs text-surface-300">{tag.name}</span>
              <span className="text-[10px] text-surface-500 font-mono">({tag.word_count})</span>
              <button
                onClick={() => handleDeleteTag(tag.id)}
                className="text-surface-500 hover:text-accent-error transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
          />
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            placeholder="新标签名称..."
            className="input-field flex-1 text-sm"
          />
          <button onClick={handleCreateTag} className="btn-primary text-xs px-3 py-1.5">
            创建
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="按名称或定义搜索单词..."
            className="input-field pl-10 pr-24"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5
                       rounded-md text-xs font-medium bg-accent-primary/15 text-accent-primary
                       hover:bg-accent-primary/25 border border-accent-primary/20
                       transition-colors font-mono"
          >
            搜索
          </button>
        </form>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary flex items-center gap-1.5 text-xs ${showFilters ? 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary' : ''}`}
        >
          <Filter className="w-3.5 h-3.5" />
          筛选
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          className={`btn-secondary flex items-center gap-1.5 text-xs ${selectMode ? 'bg-accent-secondary/10 border-accent-secondary/20 text-accent-secondary' : ''}`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          {selectMode ? '取消选择' : '批量操作'}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card-data rounded-xl p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-surface-500 font-mono uppercase">词性</span>
                <select
                  value={filterPos}
                  onChange={(e) => setFilterPos(e.target.value)}
                  className="input-field text-xs py-1.5 min-w-[120px]"
                >
                  {PART_OF_SPEECH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-surface-500 font-mono uppercase">标签</span>
                <select
                  value={filterTagId}
                  onChange={(e) => { setFilterTagId(e.target.value); setSelectedGroupId(e.target.value) }}
                  className="input-field text-xs py-1.5 min-w-[120px]"
                >
                  <option value="">全部标签</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-surface-500 font-mono uppercase">排序</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'word' | 'created_at')}
                  className="input-field text-xs py-1.5 min-w-[100px]"
                >
                  <option value="word">按字母</option>
                  <option value="created_at">按时间</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 rounded-lg bg-surface-700/40 text-surface-300 hover:text-surface-100 transition-colors"
                  title={sortOrder === 'asc' ? '升序' : '降序'}
                >
                  <ArrowUpDown className={`w-3.5 h-3.5 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                </button>
              </div>

              <button
                onClick={() => { setFilterPos(''); setFilterTagId(''); setSortBy('word'); setSortOrder('asc') }}
                className="text-[10px] text-surface-500 hover:text-surface-300 font-mono transition-colors"
              >
                重置
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card-sci rounded-xl p-3 flex items-center gap-3 flex-wrap"
          >
            <span className="text-xs text-surface-300 font-mono">
              已选 <span className="text-accent-secondary font-semibold">{selectedIds.size}</span> 个
            </span>
            <button
              onClick={handleBatchStartLearning}
              disabled={batchLoading}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <Rocket className="w-3 h-3" />
              批量开始学习
            </button>
            <div className="relative group">
              <button
                disabled={batchLoading}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <TagIcon className="w-3 h-3" />
                批量加标签
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute left-0 top-full mt-1 z-20 min-w-[140px]
                              bg-surface-800 border border-surface-700/50 rounded-lg
                              shadow-xl py-1 hidden group-hover:block">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleBatchAddTag(tag.id)}
                    className="w-full text-left px-3 py-1.5 text-xs text-surface-300
                               hover:bg-surface-700/50 flex items-center gap-2 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleBatchFavorite}
              disabled={batchLoading}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <Heart className="w-3 h-3" />
              批量收藏
            </button>
            {batchLoading && <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      ) : words.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <BookOpen className="w-12 h-12 text-surface-600" />
          <p className="text-surface-400 text-sm">未找到单词。添加单词或导入文件开始使用。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {selectMode && (
            <div className="flex items-center gap-2 px-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
              >
                {selectedIds.size === words.length ? (
                  <CheckSquare className="w-4 h-4 text-accent-secondary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {selectedIds.size === words.length ? '取消全选' : '全选'}
              </button>
            </div>
          )}
          {words.map((word) => (
            <div
              key={word.id}
              className={`card-data rounded-xl p-4 flex items-start gap-3
                         hover:border-surface-500/40 transition-colors relative
                         ${selectedIds.has(word.id) ? 'border-accent-secondary/30 bg-accent-secondary/5' : ''}`}
            >
              {selectMode && (
                <button
                  onClick={() => toggleSelect(word.id)}
                  className="mt-1 shrink-0"
                >
                  {selectedIds.has(word.id) ? (
                    <CheckSquare className="w-5 h-5 text-accent-secondary" />
                  ) : (
                    <Square className="w-5 h-5 text-surface-500 hover:text-surface-300" />
                  )}
                </button>
              )}
              <Link href={`/words/detail?id=${word.id}`} className="flex-1 min-w-0 group/link">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-surface-100 group-hover/link:text-accent-primary transition-colors">{word.word}</h3>
                  <SpeakButton text={word.word} size="sm" />
                  {word.phonetic && (
                    <span className="text-xs text-surface-400 font-mono">/{word.phonetic}/</span>
                  )}
                  {word.part_of_speech && (
                    <span className="label-tag bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20">
                      {word.part_of_speech}
                    </span>
                  )}
                </div>
                <p className="text-sm text-surface-300 line-clamp-2">{word.definition}</p>
              </Link>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDeleteWord(word.id)}
                  className="p-1.5 rounded-lg text-surface-500 hover:text-accent-error hover:bg-accent-error/5 transition-colors"
                  title="删除单词"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleFavorite(word.id)}
                  className={`p-1.5 rounded-lg transition-colors
                    ${favoriteIds.has(word.id)
                      ? 'text-accent-error bg-accent-error/10'
                      : 'text-surface-500 hover:text-accent-error hover:bg-accent-error/5'
                    }`}
                >
                  <Heart className={`w-4 h-4 ${favoriteIds.has(word.id) ? 'fill-current' : ''}`} />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowTagMenu(showTagMenu === word.id ? null : word.id)}
                    className="p-1.5 rounded-lg text-surface-500 hover:text-accent-secondary hover:bg-accent-secondary/5 transition-colors"
                  >
                    <TagIcon className="w-4 h-4" />
                  </button>
                  <AnimatePresence>
                    {showTagMenu === word.id && tags.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute right-0 top-full mt-1 z-20 min-w-[140px]
                                   bg-surface-800 border border-surface-700/50 rounded-lg
                                   shadow-xl py-1 overflow-hidden"
                      >
                        <p className="px-3 py-1.5 text-[10px] text-surface-500 font-mono uppercase">添加标签</p>
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => handleAddWordTag(word.id, tag.id)}
                            className="w-full text-left px-3 py-1.5 text-xs text-surface-300
                                       hover:bg-surface-700/50 flex items-center gap-2 transition-colors"
                          >
                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => handleStartLearning(word.id)}
                  className="btn-primary text-xs px-3 py-1.5 font-mono"
                >
                  + 学习
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800/60
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              if (totalPages <= 7) return true
              if (p === 1 || p === totalPages) return true
              if (Math.abs(p - currentPage) <= 1) return true
              return false
            })
            .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
              if (idx > 0) {
                const prev = arr[idx - 1]
                if (p - prev > 1) {
                  acc.push('ellipsis')
                }
              }
              acc.push(p)
              return acc
            }, [])
            .map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`e-${idx}`} className="px-2 text-surface-500 text-xs">...</span>
              ) : (
                <button
                  key={item}
                  onClick={() => handlePageChange(item)}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-mono transition-colors
                    ${item === currentPage
                      ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                    }`}
                >
                  {item}
                </button>
              )
            )}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800/60
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {totalWords > 0 && (
        <p className="text-center text-xs text-surface-500 font-mono">
          共 {totalWords} 个词汇，第 {currentPage}/{totalPages} 页
        </p>
      )}
    </div>
  )
}

function WordManagerWrapper() {
  const searchParams = useSearchParams()
  const tagId = searchParams.get('tag_id') || undefined
  return <WordManager initialTagId={tagId} />
}

export default function WordsPage() {
  return (
    <AppShell>
      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      }>
        <WordManagerWrapper />
      </Suspense>
    </AppShell>
  )
}
