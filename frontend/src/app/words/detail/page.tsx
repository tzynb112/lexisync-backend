'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Heart,
  Tag as TagIcon,
  BookOpen,
  Brain,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  Hash,
  Calendar,
  Rocket,
  StickyNote,
  Plus,
  Trash2,
  Edit3,
} from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { SpeakButton } from '@/components/SpeakButton'
import { ShareCard } from '@/components/ShareCard'
import { api } from '@/lib/api'
import { parseLocalDate } from '@/lib/timeSync'
import type { WordDetail, WordNote, WordRelation } from '@/types'

export default function WordDetailPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-surface-700" />
            <div className="absolute inset-0 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
          </div>
        </div>
      </AppShell>
    }>
      <WordDetailInner />
    </Suspense>
  )
}

function WordDetailInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const wordId = searchParams.get('id') || ''

  const [word, setWord] = useState<WordDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [notes, setNotes] = useState<WordNote[]>([])
  const [relations, setRelations] = useState<WordRelation[]>([])
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (!wordId) return
    setLoading(true)
    Promise.all([
      api.words.getDetail(wordId) as Promise<WordDetail>,
      api.wordNotes.list(wordId) as Promise<WordNote[]>,
      api.wordRelations.list(wordId) as Promise<WordRelation[]>,
    ])
      .then(([wordData, notesData, relationsData]) => {
        setWord(wordData)
        setNotes(notesData)
        setRelations(relationsData)
      })
      .catch((err) => setError(err.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [wordId])

  const handleToggleFavorite = async () => {
    if (!word) return
    try {
      const result = await api.tags.toggleFavorite(word.id) as any
      setWord({ ...word, is_favorited: result.favorited })
    } catch (err) {
      console.error(err)
    }
  }

  const handleStartLearning = async () => {
    if (!word) return
    try {
      await api.review.start(word.id)
      setSuccessMsg('已加入学习队列')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setError(err.message || '操作失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !word) return
    try {
      const note = await api.wordNotes.create(word.id, newNoteContent.trim()) as WordNote
      setNotes((prev) => [note, ...prev])
      setNewNoteContent('')
    } catch (err: any) {
      setError(err.message || '添加笔记失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) return
    try {
      const updated = await api.wordNotes.update(noteId, editContent.trim()) as WordNote
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      setEditingNoteId(null)
      setEditContent('')
    } catch (err: any) {
      setError(err.message || '更新笔记失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('确认删除这条笔记？')) return
    try {
      await api.wordNotes.delete(noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (err: any) {
      setError(err.message || '删除笔记失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  if (!wordId) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <BookOpen className="w-12 h-12 text-surface-600" />
          <p className="text-surface-400">请选择一个单词</p>
          <button onClick={() => router.push('/words')} className="btn-secondary">
            返回词汇列表
          </button>
        </div>
      </AppShell>
    )
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

  if (error || !word) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <BookOpen className="w-12 h-12 text-surface-600" />
          <p className="text-surface-400">{error || '单词未找到'}</p>
          <button onClick={() => router.push('/words')} className="btn-secondary">
            返回词汇列表
          </button>
        </div>
      </AppShell>
    )
  }

  const ri = word.review_info
  const accuracy = ri && ri.total_reviews > 0
    ? Math.round((ri.correct_count / ri.total_reviews) * 100)
    : 0

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => router.push('/words')}
          className="flex items-center gap-1.5 text-surface-400 hover:text-surface-200 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回词汇列表
        </button>

        {successMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-primary/8 border border-accent-primary/15 text-accent-primary text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-error/8 border border-accent-error/15 text-accent-error text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="card-sci rounded-2xl p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-surface-100">{word.word}</h1>
                <SpeakButton text={word.word} size="md" />
                <button
                  onClick={handleToggleFavorite}
                  className={`p-2 rounded-lg transition-colors
                    ${word.is_favorited
                      ? 'text-accent-error bg-accent-error/10'
                      : 'text-surface-500 hover:text-accent-error hover:bg-accent-error/5'
                    }`}
                >
                  <Heart className={`w-5 h-5 ${word.is_favorited ? 'fill-current' : ''}`} />
                </button>
                <ShareCard
                  word={word.word}
                  phonetic={word.phonetic}
                  definition={word.definition}
                  partOfSpeech={word.part_of_speech}
                  exampleSentence={word.example_sentence}
                />
              </div>
              {word.phonetic && (
                <p className="text-surface-400 text-lg font-mono mb-2">/{word.phonetic}/</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {word.part_of_speech && (
                  <span className="label-tag bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20">
                    {word.part_of_speech}
                  </span>
                )}
                {word.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      borderColor: `${tag.color}30`,
                      color: tag.color,
                    }}
                  >
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleStartLearning}
              className="btn-primary flex items-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              开始学习
            </button>
          </div>

          <div className="p-5 rounded-xl bg-surface-800/40 border border-surface-700/30 mb-6">
            <h3 className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mb-2">释义</h3>
            <p className="text-surface-200 text-lg leading-relaxed">{word.definition}</p>
          </div>

          {word.example_sentence && (
            <div className="p-4 rounded-xl bg-surface-800/20 border border-surface-700/20 mb-4">
              <h3 className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mb-1">例句</h3>
              <div className="flex items-start gap-2">
                <p className="text-surface-300 italic flex-1">{word.example_sentence}</p>
                <SpeakButton text={word.example_sentence} size="sm" />
              </div>
              {word.sentence_cn && (
                <p className="text-surface-400 text-sm mt-1.5 pl-0">{word.sentence_cn}</p>
              )}
            </div>
          )}

          {word.etymology && (
            <div className="p-4 rounded-xl bg-surface-800/20 border border-surface-700/20">
              <h3 className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mb-1">词源</h3>
              <p className="text-surface-400 text-sm italic">{word.etymology}</p>
            </div>
          )}
        </div>

        {ri && (
          <div className="card-data rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-4 h-4 text-accent-info" />
              <h2 className="section-title">学习数据</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/30 text-center">
                <p className="text-2xl font-bold text-accent-primary font-mono">{ri.total_reviews}</p>
                <p className="text-[10px] text-surface-500 mt-1 font-mono uppercase">总复习次数</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/30 text-center">
                <p className="text-2xl font-bold text-accent-primary font-mono">{accuracy}%</p>
                <p className="text-[10px] text-surface-500 mt-1 font-mono uppercase">正确率</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/30 text-center">
                <p className="text-2xl font-bold text-accent-secondary font-mono">{ri.interval}</p>
                <p className="text-[10px] text-surface-500 mt-1 font-mono uppercase">当前间隔(天)</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/30 text-center">
                <p className="text-2xl font-bold text-accent-info font-mono">{ri.easiness_factor.toFixed(1)}</p>
                <p className="text-[10px] text-surface-500 mt-1 font-mono uppercase">难度系数(EF)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800/30">
                <Hash className="w-3.5 h-3.5 text-surface-500" />
                <div>
                  <p className="text-xs text-surface-300 font-mono">{ri.repetitions}</p>
                  <p className="text-[9px] text-surface-500">重复次数</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-primary" />
                <div>
                  <p className="text-xs text-surface-300 font-mono">{ri.correct_count}</p>
                  <p className="text-[9px] text-surface-500">正确</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800/30">
                <XCircle className="w-3.5 h-3.5 text-accent-error" />
                <div>
                  <p className="text-xs text-surface-300 font-mono">{ri.incorrect_count}</p>
                  <p className="text-[9px] text-surface-500">错误</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800/30">
                <Calendar className="w-3.5 h-3.5 text-surface-500" />
                <div>
                  <p className="text-xs text-surface-300 font-mono">
                    {ri.next_review_at
                      ? parseLocalDate(ri.next_review_at).toLocaleDateString('zh-CN')
                      : '即刻'}
                  </p>
                  <p className="text-[9px] text-surface-500">下次复习</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {word.review_history.length > 0 && (
          <div className="card-data rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-accent-secondary" />
              <h2 className="section-title">复习历史</h2>
            </div>

            <div className="space-y-2">
              {word.review_history.slice(0, 15).map((log, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-800/30 border border-surface-700/20"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${log.quality >= 3 ? 'bg-accent-primary' : 'bg-accent-error'}`} />
                    <span className="text-sm text-surface-300 font-mono">
                      质量: {log.quality}/5
                    </span>
                    <span className="text-xs text-surface-500">
                      EF: {log.easiness_factor_before.toFixed(1)} → {log.easiness_factor_after.toFixed(1)}
                    </span>
                    <span className="text-xs text-surface-500">
                      间隔: {log.interval_before}d → {log.interval_after}d
                    </span>
                  </div>
                  <span className="text-[10px] text-surface-500 font-mono">
                    {log.reviewed_at
                      ? parseLocalDate(log.reviewed_at).toLocaleString('zh-CN')
                      : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card-data rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <StickyNote className="w-4 h-4 text-amber-400" />
            <h2 className="section-title">学习笔记</h2>
            <span className="text-[10px] text-surface-500 font-mono">({notes.length})</span>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="添加一条笔记..."
              className="input-field flex-1 text-sm py-2"
            />
            <button
              onClick={handleAddNote}
              disabled={!newNoteContent.trim()}
              className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              添加
            </button>
          </div>

          {notes.length > 0 ? (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg bg-surface-800/30 border border-surface-700/20 group"
                >
                  {editingNoteId === note.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateNote(note.id)}
                        className="input-field flex-1 text-sm py-1.5"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdateNote(note.id)}
                        className="btn-primary text-xs px-2 py-1"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-surface-200 whitespace-pre-wrap break-words">{note.content}</p>
                        <p className="text-[10px] text-surface-500 font-mono mt-1.5">
                          {parseLocalDate(note.created_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => {
                            setEditingNoteId(note.id)
                            setEditContent(note.content)
                          }}
                          className="p-1 rounded text-surface-500 hover:text-accent-info hover:bg-surface-700/50 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 rounded text-surface-500 hover:text-accent-error hover:bg-surface-700/50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 text-sm text-center py-4">暂无笔记，添加一条吧</p>
          )}
        </div>

        {relations.length > 0 && (
          <div className="card-data rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-accent-secondary" />
              <h2 className="section-title">关联词汇</h2>
            </div>
            <div className="space-y-2">
              {relations.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/words/detail?id=${rel.related_word_id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/30 border border-surface-700/20
                             hover:border-accent-secondary/30 hover:bg-surface-700/30 transition-colors group"
                >
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase shrink-0
                    ${rel.relation_type === 'synonym'
                      ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                      : rel.relation_type === 'antonym'
                        ? 'bg-accent-error/10 text-accent-error border border-accent-error/20'
                        : 'bg-accent-info/10 text-accent-info border border-accent-info/20'
                    }`}>
                    {rel.relation_type === 'synonym' ? '同义' : rel.relation_type === 'antonym' ? '反义' : '相关'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-surface-200 group-hover:text-accent-secondary transition-colors font-mono">
                        {rel.related_word}
                      </span>
                      {rel.related_part_of_speech && (
                        <span className="text-[10px] text-surface-500">{rel.related_part_of_speech}</span>
                      )}
                    </div>
                    <p className="text-xs text-surface-400 truncate">{rel.related_definition}</p>
                  </div>
                  <ArrowLeft className="w-3.5 h-3.5 text-surface-600 group-hover:text-accent-secondary transition-colors rotate-180 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {!ri && (
          <div className="card-data rounded-2xl p-8 text-center">
            <Brain className="w-10 h-10 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400 text-sm">该单词尚未加入学习队列</p>
            <button
              onClick={handleStartLearning}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              开始学习
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}