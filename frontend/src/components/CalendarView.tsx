'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { api } from '@/lib/api'
import { getSyncedDate } from '@/lib/timeSync'

interface CalendarDay {
  date: string
  day: number
  month: number
  is_current_month: boolean
  count: number
}

interface CalendarData {
  year: number
  month: number
  weeks: CalendarDay[][]
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function getIntensityClass(count: number): string {
  if (count === 0) return 'bg-surface-800/40'
  if (count <= 3) return 'bg-accent-primary/15'
  if (count <= 8) return 'bg-accent-primary/30'
  if (count <= 15) return 'bg-accent-primary/50'
  return 'bg-accent-primary/70'
}

export function CalendarView() {
  const [year, setYear] = useState(getSyncedDate().getFullYear())
  const [month, setMonth] = useState(getSyncedDate().getMonth() + 1)
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.review.getCalendar(year, month) as CalendarData
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

  return (
    <div className="card-data rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 rounded-lg hover:bg-surface-700/50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-surface-400" />
        </button>
        <h3 className="text-sm font-semibold text-surface-200">
          {monthNames[month - 1]} {year}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-1.5 rounded-lg hover:bg-surface-700/50 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-surface-400" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
        </div>
      ) : data ? (
        <div>
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] text-surface-500 font-mono py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {data.weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day, di) => (
                  <motion.div
                    key={`${wi}-${di}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (wi * 7 + di) * 0.01 }}
                    className={`
                      aspect-square rounded-lg flex flex-col items-center justify-center
                      text-xs font-mono transition-colors relative
                      ${day.is_current_month
                        ? getIntensityClass(day.count)
                        : 'bg-transparent'
                      }
                    `}
                    title={`${day.date}: ${day.count} 次复习`}
                  >
                    {day.is_current_month && (
                      <>
                        <span className={day.count > 0 ? 'text-surface-200' : 'text-surface-600'}>
                          {day.day}
                        </span>
                        {day.count > 0 && (
                          <span className="text-[8px] text-surface-400">{day.count}</span>
                        )}
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-[10px] text-surface-500">少</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`w-3 h-3 rounded ${getIntensityClass(level === 0 ? 0 : level * 4)}`}
              />
            ))}
            <span className="text-[10px] text-surface-500">多</span>
          </div>
        </div>
      ) : (
        <p className="text-center text-surface-500 text-sm py-8">暂无数据</p>
      )}
    </div>
  )
}
