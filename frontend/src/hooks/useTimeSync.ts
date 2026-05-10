import { useEffect, useState } from 'react'
import { startAutoSync, getSyncedDate, getTimeOffset, getLastSyncTime } from '@/lib/timeSync'

export function useTimeSync() {
  const [synced, setSynced] = useState(false)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const cleanup = startAutoSync(5)

    // 延迟一点后标记为已同步（给首次同步留时间）
    const timer = setTimeout(() => {
      setSynced(true)
      setOffset(getTimeOffset())
    }, 1000)

    return () => {
      cleanup()
      clearTimeout(timer)
    }
  }, [])

  return {
    now: getSyncedDate(),
    synced,
    offset,
    lastSyncTime: getLastSyncTime(),
  }
}
