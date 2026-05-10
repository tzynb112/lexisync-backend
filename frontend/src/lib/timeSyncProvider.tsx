'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { startAutoSync, getSyncedDate, getTimeOffset, getLastSyncTime, syncTime } from './timeSync'

interface TimeSyncContextType {
  now: Date
  synced: boolean
  offset: number
  lastSyncTime: number
  refresh: () => Promise<boolean>
}

const TimeSyncContext = createContext<TimeSyncContextType | undefined>(undefined)

export function TimeSyncProvider({ children }: { children: ReactNode }) {
  const [synced, setSynced] = useState(false)
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState<Date>(getSyncedDate())

  useEffect(() => {
    // 启动自动同步
    const cleanup = startAutoSync(5)

    // 每秒更新一次显示时间
    const interval = setInterval(() => {
      setNow(getSyncedDate())
    }, 1000)

    // 首次同步
    syncTime().then((success) => {
      setSynced(success)
      setOffset(getTimeOffset())
      setNow(getSyncedDate())
    })

    return () => {
      cleanup()
      clearInterval(interval)
    }
  }, [])

  const refresh = async () => {
    const success = await syncTime()
    setSynced(success)
    setOffset(getTimeOffset())
    setNow(getSyncedDate())
    return success
  }

  return (
    <TimeSyncContext.Provider
      value={{ now, synced, offset, lastSyncTime: getLastSyncTime(), refresh }}
    >
      {children}
    </TimeSyncContext.Provider>
  )
}

export function useTimeSync() {
  const context = useContext(TimeSyncContext)
  if (!context) {
    throw new Error('useTimeSync must be used within TimeSyncProvider')
  }
  return context
}
