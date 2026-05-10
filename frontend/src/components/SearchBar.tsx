'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

import { api } from '@/lib/api'
import type { Word } from '@/types'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Word[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const data = await api.words.search(q, 8) as Word[]
      setResults(data)
      setOpen(data.length > 0)
      setSelectedIndex(-1)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      window.location.href = `/words/${results[selectedIndex].id}`
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="搜索单词... (Ctrl+K)"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/30
                     text-sm text-surface-100 placeholder-surface-500
                     focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20
                     transition-colors"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="w-3.5 h-3.5 text-surface-500 animate-spin" />}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono
                         bg-surface-700/50 text-surface-500 border border-surface-600/30">
            ⌘K
          </kbd>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 w-full rounded-xl bg-surface-800 border border-surface-700/30
                       shadow-xl shadow-black/20 overflow-hidden z-50"
          >
            {results.map((word, i) => (
              <Link
                key={word.id}
                href={`/words/${word.id}`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 transition-colors group
                  ${i === selectedIndex ? 'bg-accent-primary/10' : 'hover:bg-surface-700/50'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-surface-200 font-mono group-hover:text-accent-primary transition-colors">
                      {word.word}
                    </span>
                    {word.part_of_speech && (
                      <span className="text-[10px] text-surface-500">{word.part_of_speech}</span>
                    )}
                  </div>
                  <p className="text-xs text-surface-400 truncate">{word.definition}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-accent-primary transition-colors shrink-0" />
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
