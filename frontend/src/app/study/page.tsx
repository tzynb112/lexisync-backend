'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import {
  Loader2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Brain,
  ArrowRight,
  LayoutGrid,
  PenLine,
  ListChecks,
  ArrowLeft,
  Star,
  X,
  Volume2,
  Mic,
  MicOff,
  BookOpen,
  GraduationCap,
  School,
  Plus,
  Settings2,
} from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { Flashcard } from '@/components/Flashcard'
import { SpeakButton } from '@/components/SpeakButton'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { api } from '@/lib/api'
import { useGroup } from '@/contexts/GroupContext'
import type { DueWord, ChoiceTestQuestion, SpellingTestQuestion, StudyMode } from '@/types'

interface VocabularyGroup {
  id: string
  name: string
  color: string
  word_count: number
  type?: 'tag' | 'category'
}

function GroupSelector({
  groups,
  onSelect,
  onBack,
}: {
  groups: VocabularyGroup[]
  onSelect: (group: VocabularyGroup | null) => void
  onBack?: () => void
}) {
  const groupIcons: Record<string, React.ElementType> = {
    '考研词汇': GraduationCap,
    '中考词汇': School,
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20
                     flex items-center justify-center mx-auto mb-4"
        >
          <BookOpen className="w-8 h-8 text-accent-primary" />
        </motion.div>
        <h1 className="text-2xl font-bold text-surface-100 mb-2">选择词汇组</h1>
        <p className="text-surface-400 text-sm">选择你要学习的词汇分组，专注高效背诵</p>
      </div>

      {/* 全部词汇 */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => onSelect(null)}
        className="w-full text-left p-5 rounded-xl border-2 border-surface-600/30
                   bg-gradient-to-r from-surface-800/40 to-surface-800/10
                   hover:border-accent-primary/40 hover:shadow-lg hover:shadow-accent-primary/5
                   transition-all duration-200 group mb-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-accent-primary/10 border border-accent-primary/20
                          flex items-center justify-center group-hover:scale-110 transition-transform">
            <Brain className="w-7 h-7 text-accent-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-surface-100 font-semibold text-lg mb-0.5">全部词汇</h3>
            <p className="text-surface-400 text-xs">所有词库混合复习，全面覆盖</p>
          </div>
          <ArrowRight className="w-5 h-5 text-surface-500 group-hover:text-surface-300 group-hover:translate-x-1 transition-all" />
        </div>
      </motion.button>

      {/* 分组词汇 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((group, i) => {
          const Icon = groupIcons[group.name] || BookOpen
          return (
            <motion.button
              key={group.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => onSelect(group)}
              className="text-left p-5 rounded-xl border-2 border-surface-600/20
                         bg-surface-800/30 backdrop-blur-sm
                         hover:border-surface-500/40 hover:shadow-lg
                         transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-xl border flex items-center justify-center
                             group-hover:scale-110 transition-transform"
                  style={{
                    backgroundColor: `${group.color}15`,
                    borderColor: `${group.color}30`,
                  }}
                >
                  <Icon className="w-6 h-6" style={{ color: group.color }} />
                </div>
                <span className="text-sm text-surface-400 font-mono">{group.word_count} 词</span>
              </div>
              <h3 className="text-surface-100 font-semibold mb-1">{group.name}</h3>
              <div className="w-full bg-surface-700/30 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (group.word_count / 2000) * 100)}%`,
                    backgroundColor: group.color,
                  }}
                />
              </div>
            </motion.button>
          )
        })}
      </div>

      {groups.length === 0 && (
        <p className="text-center text-surface-500 text-sm mt-8">暂无词汇分组，请先在设置中创建</p>
      )}
    </div>
  )
}

function ModeSelector({
  onSelect,
  dueCount,
  notStartedCount,
  totalStarted,
  selectedGroup,
  onBack,
}: {
  onSelect: (mode: StudyMode) => void
  dueCount: number
  notStartedCount: number
  totalStarted: number
  selectedGroup: VocabularyGroup | null
  onBack: () => void
}) {
  const modes = [
    {
      id: 'flashcard' as StudyMode,
      title: '闪卡模式',
      desc: '翻转卡片，自我评估掌握程度',
      icon: LayoutGrid,
      color: 'accent-primary',
      gradient: 'from-accent-primary/20 to-accent-primary/5',
    },
    {
      id: 'choice' as StudyMode,
      title: '选择题模式',
      desc: '四选一，快速检验词义理解',
      icon: ListChecks,
      color: 'accent-secondary',
      gradient: 'from-accent-secondary/20 to-accent-secondary/5',
    },
    {
      id: 'spelling' as StudyMode,
      title: '拼写模式',
      desc: '根据释义拼出单词，深度记忆',
      icon: PenLine,
      color: 'accent-info',
      gradient: 'from-accent-info/20 to-accent-info/5',
    },
  ]

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20
                     flex items-center justify-center mx-auto mb-4"
        >
          <Brain className="w-8 h-8 text-accent-primary" />
        </motion.div>
        <h1 className="text-2xl font-bold text-surface-100 mb-2">选择学习模式</h1>
        <p className="text-surface-400 text-sm mb-3">
          {selectedGroup ? (
            <>
              词汇组 <span className="text-accent-primary font-semibold">{selectedGroup.name}</span>
            </>
          ) : (
            <>全部词汇</>
          )}
        </p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-error/10 border border-accent-error/20">
            <RefreshCw className="w-3.5 h-3.5 text-accent-error" />
            <span className="text-surface-500">待复习</span>
            <span className="text-accent-error font-bold">{dueCount}</span>
            <span className="text-surface-500">个</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-info/10 border border-accent-info/20">
            <Brain className="w-3.5 h-3.5 text-accent-info" />
            <span className="text-surface-500">学习中</span>
            <span className="text-accent-info font-bold">{totalStarted}</span>
            <span className="text-surface-500">个</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/50 border border-surface-600/50">
            <BookOpen className="w-3.5 h-3.5 text-surface-400" />
            <span className="text-surface-500">未开始</span>
            <span className="text-surface-300 font-bold">{notStartedCount}</span>
            <span className="text-surface-500">个</span>
          </div>
        </div>
        {dueCount === 0 && totalStarted > 0 && (
          <p className="text-accent-secondary text-sm mt-3">
            ✅ 今日复习已完成！已掌握的单词会按记忆曲线自动安排下次复习时间。
          </p>
        )}
        {totalStarted === 0 && notStartedCount > 0 && (
          <p className="text-accent-secondary text-sm mt-3">
            💡 点击下方按钮开始学习新单词（会加入SM-2复习循环）
          </p>
        )}
        {totalStarted === 0 && notStartedCount === 0 && (
          <p className="text-surface-500 text-sm mt-3">
            该词汇组暂无单词，请先添加词汇
          </p>
        )}
      </div>

      <div className="grid gap-4">
        {modes.map((mode, i) => (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelect(mode.id)}
            className={`w-full text-left p-5 rounded-xl border border-surface-700/50
                       bg-gradient-to-r ${mode.gradient} backdrop-blur-sm
                       hover:border-${mode.color}/30 hover:shadow-lg hover:shadow-${mode.color}/5
                       transition-colors duration-200 group`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-${mode.color}/10 border border-${mode.color}/20
                              flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <mode.icon className={`w-6 h-6 text-${mode.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-surface-100 font-semibold mb-0.5">{mode.title}</h3>
                <p className="text-surface-400 text-xs">{mode.desc}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-surface-500 group-hover:text-surface-300 group-hover:translate-x-1 transition-transform duration-200" />
            </div>
          </motion.button>
        ))}
      </div>

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mx-auto mt-6 text-xs text-surface-500 hover:text-surface-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        重新选择词汇组
      </button>
    </div>
  )
}

function FlashcardMode({ tagId, categoryId }: { tagId?: string; categoryId?: string }) {
  const [words, setWords] = useState<DueWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sessionComplete, setSessionComplete] = useState(false)
  const [lastFeedback, setLastFeedback] = useState<any>(null)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [answered, setAnswered] = useState(false)

  const currentWord = words[currentIndex]

  const fetchDueWords = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.review.due(20, tagId, categoryId) as DueWord[]
      setWords(data)
      setCurrentIndex(0)
      setSessionComplete(false)
      setReviewedCount(0)
      setLastFeedback(null)
      setAnswered(false)
    } catch (err: any) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [tagId, categoryId])

  useEffect(() => { fetchDueWords() }, [fetchDueWords])

  const handleFeedback = async (quality: number) => {
    if (!currentWord || submitting || answered) return
    setSubmitting(true)
    try {
      const feedback = await api.review.feedback(currentWord.word_record_id, quality)
      setLastFeedback(feedback)
      setReviewedCount((c) => c + 1)
      setAnswered(true)
      setSubmitting(false)
    } catch (err: any) {
      setError(err.message || '提交失败')
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setLastFeedback(null)
      setAnswered(false)
    } else {
      setSessionComplete(true)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setLastFeedback(null)
      setAnswered(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Brain className="w-10 h-10 text-accent-primary animate-pulse" />
          <p className="text-surface-400 text-sm font-mono">加载复习队列...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-2xl bg-accent-error/10 border border-accent-error/20
                     flex items-center justify-center"
        >
          <AlertCircle className="w-12 h-12 text-accent-error" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface-100 mb-2">加载失败</h2>
          <p className="text-surface-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchDueWords()}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            重新加载
          </button>
        </div>
      </div>
    )
  }

  if (sessionComplete || words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-2xl bg-accent-primary/10 border border-accent-primary/20
                     flex items-center justify-center animate-glow-pulse"
        >
          <CheckCircle2 className="w-12 h-12 text-accent-primary" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface-100 mb-2">
            {words.length === 0 ? '全部完成！' : '学习会话完成！'}
          </h2>
          <p className="text-surface-400 text-sm">
            {words.length === 0 ? '没有需要复习的单词。太棒了！' : `您在这次会话中复习了 ${reviewedCount} 个单词。`}
          </p>
          {words.length === 0 && !sessionComplete && (
            <div className="flex flex-col items-center gap-3 mt-4">
              <p className="text-xs text-surface-500">如果词汇表中确实有单词，请尝试以下操作：</p>
              <button
          onClick={() => fetchDueWords()}
          className="btn-primary flex items-center gap-2"
        >
                <RefreshCw className="w-4 h-4" />
                重新加载学习队列
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-surface-100 tracking-tight">闪卡模式</h1>
          <p className="text-surface-400 text-xs mt-0.5 font-mono">{currentIndex + 1} / {words.length} 剩余</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-primary/8 border border-accent-primary/15">
            <LayoutGrid className="w-3.5 h-3.5 text-accent-primary" />
            <span className="text-[10px] text-accent-primary font-mono tracking-wider uppercase">闪卡</span>
          </div>
      </div>

      <div className="w-full bg-surface-800/50 rounded-full h-1 mb-4 overflow-hidden border border-surface-700/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-primary/60 to-accent-primary transition-all duration-300 ease-out"
          style={{
            width: `${((currentIndex + 1) / words.length) * 100}%`,
            willChange: 'width',
          }}
        />
      </div>

      <div className="flex justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentWord.word_record_id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{
              duration: 0.2,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            style={{ willChange: 'transform, opacity' }}
          >
            <Flashcard word={currentWord} onFeedback={handleFeedback} disabled={submitting} />
          </motion.div>
        </AnimatePresence>
      </div>

      {lastFeedback && (
        <div className="mt-3 card-data rounded-xl p-2.5 text-center animate-fade-in-up">
          <p className="text-[11px] text-surface-400 mb-1 font-mono">
            下次复习: <span className="text-accent-primary font-semibold">{lastFeedback.interval}</span> 天
            {' · '}难度: <span className="text-accent-secondary font-semibold">{lastFeedback.easiness_factor}</span>
            {' · '}次数: <span className="text-accent-info font-semibold">{lastFeedback.repetitions}</span>
          </p>
        </div>
      )}

      {/* 手动切换按钮 */}
      {answered && (
        <div className="flex justify-center mt-4 animate-fade-in-up">
          <div className="flex justify-center gap-2 flex-wrap">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium
                       bg-surface-700/40 text-surface-300 border border-surface-600/30
                       hover:bg-surface-600/40 hover:text-surface-200
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            上一个
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium
                       bg-accent-primary/15 text-accent-primary border border-accent-primary/30
                       hover:bg-accent-primary/25 hover:border-accent-primary/50
                       transition-colors duration-200"
          >
            {currentIndex < words.length - 1 ? '下一个' : '完成'}
            <ArrowRight className="w-4 h-4" />
          </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChoiceMode({ tagId, categoryId }: { tagId?: string; categoryId?: string }) {
  const [questions, setQuestions] = useState<ChoiceTestQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [submitting, setSubmitting] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.review.choiceTest(10, tagId, categoryId) as ChoiceTestQuestion[]
      setQuestions(data)
      setCurrentIndex(0)
      setScore({ correct: 0, total: 0 })
      setSelected(null)
      setIsCorrect(null)
      setSessionComplete(false)
    } catch (err: any) {
      console.error('加载选择题失败:', err)
    } finally {
      setLoading(false)
    }
  }, [tagId, categoryId])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

  const currentQ = questions[currentIndex]

  const handleSelect = async (option: string) => {
    if (selected || !currentQ || submitting) return
    setSelected(option)
    const correct = option === currentQ.correct_definition
    setIsCorrect(correct)

    setSubmitting(true)
    try {
      await api.review.testFeedback(currentQ.word_record_id, correct)
    } catch (err) {
      console.error('提交选择题反馈失败:', err)
    }
    setSubmitting(false)

    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }))

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setSelected(null)
        setIsCorrect(null)
      } else {
        setSessionComplete(true)
      }
    }, 1200)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Brain className="w-10 h-10 text-accent-secondary animate-pulse" />
      </div>
    )
  }

  if (sessionComplete || questions.length === 0) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-2xl bg-accent-secondary/10 border border-accent-secondary/20
                     flex items-center justify-center"
        >
          <ListChecks className="w-12 h-12 text-accent-secondary" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface-100 mb-2">选择题完成！</h2>
          <p className="text-surface-400 text-sm">
            正确率 <span className="text-accent-secondary font-semibold">{pct}%</span>
            {' '}({score.correct}/{score.total})
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-surface-100 tracking-tight">选择题模式</h1>
          <p className="text-surface-400 text-xs mt-0.5 font-mono">{currentIndex + 1} / {questions.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-surface-400 font-mono">
            <Star className="w-3 h-3 inline text-accent-secondary mr-1" />
            {score.correct}/{score.total}
          </span>
        </div>
      </div>

      <div className="w-full bg-surface-800/50 rounded-full h-1 mb-8 overflow-hidden border border-surface-700/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-secondary/60 to-accent-secondary transition-all duration-300 ease-out"
          style={{
            width: `${((currentIndex + 1) / questions.length) * 100}%`,
            willChange: 'width',
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ.word_record_id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{
            duration: 0.2,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="card-data rounded-xl p-6 mb-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-surface-100">{currentQ.word}</h2>
              <SpeakButton text={currentQ.word} size="sm" />
            </div>
            {currentQ.phonetic && (
              <p className="text-surface-400 text-sm font-mono">{currentQ.phonetic}</p>
            )}

            {currentQ.example_sentence && (
              <div className="mt-4 p-3 rounded-lg bg-surface-700/10 border border-surface-600/20 text-left">
                <p className="text-[10px] text-surface-500 mb-1 font-mono uppercase tracking-wider">例句</p>
                <div className="flex items-start gap-2">
                  <p className="text-sm text-surface-300 italic flex-1">{currentQ.example_sentence}</p>
                  <SpeakButton text={currentQ.example_sentence} size="sm" />
                </div>
                {currentQ.sentence_cn && (
                  <p className="text-xs text-surface-400 mt-1">{currentQ.sentence_cn}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {currentQ.options.map((option, i) => {
              let optClass = 'border-surface-700/50 hover:border-accent-secondary/30 hover:bg-accent-secondary/5'
              if (selected) {
                if (option === currentQ.correct_definition) {
                  optClass = 'border-accent-primary/50 bg-accent-primary/10'
                } else if (option === selected && !isCorrect) {
                  optClass = 'border-accent-error/50 bg-accent-error/10'
                } else {
                  optClass = 'border-surface-700/30 opacity-50'
                }
              }
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(option)}
                  disabled={!!selected}
                  className={`w-full text-left p-4 rounded-xl border ${optClass}
                             transition-all duration-150`}
                  style={{
                    animationDelay: `${i * 40}ms`,
                    willChange: 'transform',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-surface-700/50 flex items-center justify-center
                                   text-xs font-mono text-surface-400 shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm text-surface-200">{option}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {selected && (
            <div className="mt-4 text-center animate-fade-in-up">
              <span className={`text-sm font-semibold ${isCorrect ? 'text-accent-primary' : 'text-accent-error'}`}>
                {isCorrect ? '✓ 回答正确！' : `✗ 正确答案: ${currentQ.correct_definition}`}
              </span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function SpellingMode({ tagId, categoryId }: { tagId?: string; categoryId?: string }) {
  const [questions, setQuestions] = useState<SpellingTestQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userInput, setUserInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [sessionComplete, setSessionComplete] = useState(false)

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    lang: 'en-US',
    onResult: (text) => {
      setUserInput(text.trim())
    },
  })

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.review.spellingTest(10, tagId, categoryId) as SpellingTestQuestion[]
      setQuestions(data)
      setCurrentIndex(0)
      setScore({ correct: 0, total: 0 })
      setUserInput('')
      setSubmitted(false)
      setIsCorrect(false)
      setSessionComplete(false)
    } catch (err: any) {
      console.error('加载拼写题失败:', err)
    } finally {
      setLoading(false)
    }
  }, [tagId, categoryId])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

  const currentQ = questions[currentIndex]

  const handleSubmit = async () => {
    if (!currentQ || submitted || !userInput.trim()) return

    const correct = userInput.trim().toLowerCase() === currentQ.answer.toLowerCase()
    setIsCorrect(correct)
    setSubmitted(true)

    try {
      await api.review.testFeedback(currentQ.word_record_id, correct)
    } catch (err) {
      console.error('提交拼写题反馈失败:', err)
    }

    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }))

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setUserInput('')
        setSubmitted(false)
        setIsCorrect(false)
      } else {
        setSessionComplete(true)
      }
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !submitted) {
      handleSubmit()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Brain className="w-10 h-10 text-accent-info animate-pulse" />
      </div>
    )
  }

  if (sessionComplete || questions.length === 0) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-2xl bg-accent-info/10 border border-accent-info/20
                     flex items-center justify-center"
        >
          <PenLine className="w-12 h-12 text-accent-info" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-surface-100 mb-2">拼写测试完成！</h2>
          <p className="text-surface-400 text-sm">
            正确率 <span className="text-accent-info font-semibold">{pct}%</span>
            {' '}({score.correct}/{score.total})
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-surface-100 tracking-tight">拼写模式</h1>
          <p className="text-surface-400 text-xs mt-0.5 font-mono">{currentIndex + 1} / {questions.length}</p>
        </div>
        <span className="text-xs text-surface-400 font-mono">
          <Star className="w-3 h-3 inline text-accent-info mr-1" />
          {score.correct}/{score.total}
        </span>
      </div>

      <div className="w-full bg-surface-800/50 rounded-full h-1 mb-8 overflow-hidden border border-surface-700/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-info/60 to-accent-info transition-all duration-300 ease-out"
          style={{
            width: `${((currentIndex + 1) / questions.length) * 100}%`,
            willChange: 'width',
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ.word_record_id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{
            duration: 0.2,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="card-data rounded-xl p-6 mb-6">
            <div className="text-center mb-4">
              <p className="text-lg text-surface-100 font-semibold mb-2">{currentQ.definition}</p>
              {currentQ.part_of_speech && (
                <span className="text-xs text-surface-400 font-mono bg-surface-700/50 px-2 py-0.5 rounded">
                  {currentQ.part_of_speech}
                </span>
              )}
            </div>
            {currentQ.phonetic && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <p className="text-sm text-surface-400 font-mono">{currentQ.phonetic}</p>
                <SpeakButton text={currentQ.answer} size="sm" />
              </div>
            )}
            {currentQ.example_sentence && (
              <div className="mb-3">
                <div className="flex items-start gap-2 justify-center">
                  <p className="text-xs text-surface-500 italic">{currentQ.example_sentence}</p>
                  <SpeakButton text={currentQ.example_sentence} size="sm" />
                </div>
                {currentQ.sentence_cn && (
                  <p className="text-xs text-surface-400 text-center mt-0.5">{currentQ.sentence_cn}</p>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={submitted}
                placeholder="输入单词拼写..."
                className={`flex-1 p-4 rounded-xl border bg-surface-800/50 text-surface-100
                          placeholder-surface-500 text-center text-lg font-mono
                          focus:outline-none focus:ring-2 transition-colors duration-200
                          ${submitted
                            ? isCorrect
                              ? 'border-accent-primary/50 ring-accent-primary/20'
                              : 'border-accent-error/50 ring-accent-error/20'
                            : 'border-surface-700/50 focus:border-accent-info/50 focus:ring-accent-info/20'
                          }`}
                autoFocus
              />
              {isSupported && !submitted && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`p-4 rounded-xl border transition-colors duration-200
                    ${isListening
                      ? 'bg-accent-error/20 border-accent-error/40 text-accent-error animate-pulse'
                      : 'bg-surface-800/50 border-surface-700/50 text-surface-400 hover:text-accent-primary hover:border-accent-primary/40'
                    }`}
                  title={isListening ? '停止录音' : '语音输入'}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {!submitted && (
            <div className="flex justify-center mt-4">
              <button
                onClick={handleSubmit}
                disabled={!userInput.trim()}
                className="btn-primary flex items-center gap-2 disabled:opacity-30"
              >
                <ArrowRight className="w-4 h-4" />
                提交
              </button>
            </div>
          )}

          {submitted && (
            <div className="mt-4 text-center animate-fade-in-up">
              {isCorrect ? (
                <span className="text-accent-primary font-semibold">✓ 拼写正确！</span>
              ) : (
                <div>
                  <span className="text-accent-error font-semibold">✗ 正确拼写: </span>
                  <span className="text-accent-info font-mono font-semibold">{currentQ.answer}</span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function StudyPageContent() {
  const searchParams = useSearchParams()
  const { selectedGroupId, setSelectedGroupId, groups, selectedGroupType } = useGroup()
  const [step, setStep] = useState<'group' | 'mode' | 'study'>('group')
  const [mode, setMode] = useState<StudyMode | null>(null)
  const [dueCount, setDueCount] = useState(0)
  const [notStartedCount, setNotStartedCount] = useState(0)
  const [totalStarted, setTotalStarted] = useState(0)
  const [selectedGroup, setSelectedGroup] = useState<VocabularyGroup | null>(null)

  const vocabularyGroups = groups as VocabularyGroup[]

  useEffect(() => {
    const isCategory = selectedGroupType === 'category'
    api.review.stats(
      isCategory ? undefined : (selectedGroupId || undefined),
      isCategory ? selectedGroupId : undefined
    ).then((stats: any) => {
      setDueCount(stats.due_today || 0)
      setNotStartedCount(stats.not_started || 0)
      setTotalStarted(stats.total_words || 0)
    }).catch(() => {})

    const groupId = searchParams.get('group') || selectedGroupId
    if (groupId) {
      const found = vocabularyGroups.find((g: VocabularyGroup) => g.id === groupId)
      if (found) {
        setSelectedGroup(found)
        setSelectedGroupId(groupId)
        setStep('mode')
        return
      }
    }

    if (selectedGroupId) {
      const found = vocabularyGroups.find((g: VocabularyGroup) => g.id === selectedGroupId)
      if (found) {
        setSelectedGroup(found)
        setStep('mode')
        return
      }
    }
  }, [searchParams, selectedGroupId, selectedGroupType, vocabularyGroups.length])

  const handleGroupSelect = (group: VocabularyGroup | null) => {
    setSelectedGroup(group)
    setSelectedGroupId(group?.id || '')
    setStep('mode')
  }

  const handleModeSelect = (m: StudyMode) => {
    setMode(m)
    setStep('study')
  }

  const handleBackToGroup = () => {
    setStep('group')
    setMode(null)
  }

  const handleBackToMode = () => {
    setStep('mode')
    setMode(null)
  }

  const isSelectedCategory = selectedGroup?.type === 'category'

  return (
    <>
      {step === 'group' && (
        <GroupSelector groups={vocabularyGroups} onSelect={handleGroupSelect} />
      )}
      {step === 'mode' && (
        <ModeSelector
          onSelect={handleModeSelect}
          dueCount={dueCount}
          notStartedCount={notStartedCount}
          totalStarted={totalStarted}
          selectedGroup={selectedGroup}
          onBack={handleBackToGroup}
        />
      )}
      {step === 'study' && mode && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBackToMode}
              className="flex items-center gap-1.5 text-surface-400 hover:text-surface-200
                         text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回模式选择
            </button>
            {selectedGroup && (
              <span
                className="text-xs px-3 py-1 rounded-full border font-mono"
                style={{
                  color: selectedGroup.color,
                  borderColor: `${selectedGroup.color}40`,
                  backgroundColor: `${selectedGroup.color}10`,
                }}
              >
                {selectedGroup.name}
              </span>
            )}
          </div>
          {mode === 'flashcard' && (
            <FlashcardMode
              tagId={isSelectedCategory ? undefined : selectedGroup?.id}
              categoryId={isSelectedCategory ? selectedGroup?.id : undefined}
            />
          )}
          {mode === 'choice' && (
            <ChoiceMode
              tagId={isSelectedCategory ? undefined : selectedGroup?.id}
              categoryId={isSelectedCategory ? selectedGroup?.id : undefined}
            />
          )}
          {mode === 'spelling' && (
            <SpellingMode
              tagId={isSelectedCategory ? undefined : selectedGroup?.id}
              categoryId={isSelectedCategory ? selectedGroup?.id : undefined}
            />
          )}
        </div>
      )}
    </>
  )
}

export default function StudyRoute() {
  return (
    <AppShell>
      <StudyPage />
    </AppShell>
  )
}

function StudyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      }
    >
      <StudyPageContent />
    </Suspense>
  )
}
