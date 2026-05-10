/**
 * 时间同步工具 - 自动校准客户端时间
 * 通过请求服务器时间头来计算偏移量，确保时间准确
 */

let timeOffset = 0 // 服务器时间与本地时间的偏移量（毫秒）
let lastSyncTime = 0
let isSyncing = false

/**
 * 获取校准后的当前时间
 */
export function getSyncedDate(): Date {
  return new Date(Date.now() + timeOffset)
}

/**
 * 获取校准后的时间戳
 */
export function getSyncedTime(): number {
  return Date.now() + timeOffset
}

/**
 * 同步服务器时间
 */
export async function syncTime(): Promise<boolean> {
  if (isSyncing) return false
  isSyncing = true

  try {
    const startTime = Date.now()
    const res = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
    })
    const endTime = Date.now()

    const serverDateStr = res.headers.get('date')
    if (!serverDateStr) {
      console.warn('[TimeSync] Server did not return Date header')
      return false
    }

    const serverTime = new Date(serverDateStr).getTime()
    const rtt = endTime - startTime // 往返时间
    const estimatedLatency = rtt / 2 // 估计单向延迟

    // 计算偏移量：服务器时间 - (本地时间 + 估计延迟)
    const newOffset = serverTime - (endTime + estimatedLatency)
    timeOffset = newOffset
    lastSyncTime = Date.now()

    console.log(
      `[TimeSync] Synced successfully. Offset: ${newOffset}ms, RTT: ${rtt}ms`
    )
    return true
  } catch (err) {
    console.error('[TimeSync] Failed to sync time:', err)
    return false
  } finally {
    isSyncing = false
  }
}

/**
 * 启动自动时间同步
 * @param intervalMinutes 同步间隔（分钟），默认 5 分钟
 */
export function startAutoSync(intervalMinutes = 5): () => void {
  // 立即同步一次
  syncTime()

  // 定期同步
  const intervalId = setInterval(() => {
    syncTime()
  }, intervalMinutes * 60 * 1000)

  // 页面重新可见时同步
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const timeSinceLastSync = Date.now() - lastSyncTime
      // 如果超过 1 分钟没有同步，重新同步
      if (timeSinceLastSync > 60000) {
        syncTime()
      }
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 返回清理函数
  return () => {
    clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

/**
 * 获取上次同步时间
 */
export function getLastSyncTime(): number {
  return lastSyncTime
}

/**
 * 获取当前时间偏移量
 */
export function getTimeOffset(): number {
  return timeOffset
}

/**
 * 格式化日期（使用校准后的时间）
 */
export function formatSyncedDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseLocalDate(date)

  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  })
}

/**
 * 将无时区的 ISO 字符串解析为本地时间 Date 对象
 * 后端数据库存储的是 UTC 时间（如 2025-05-07T04:26:09），
 * 但返回给前端的是无时区字符串，需要当作 UTC 解析后再转本地时间
 */
export function parseLocalDate(dateStr: string | number | Date): Date {
  if (dateStr instanceof Date) return dateStr

  const str = String(dateStr).trim()

  // 纯日期格式（如 2025-05-07），解析为本地午夜
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  // 如果是无时区的 ISO 格式（如 2025-05-07T04:26:09 或 2025-05-07T04:26:09.000），
  // 后端存储的是 UTC 时间，需要追加 'Z' 当作 UTC 解析，
  // 然后 toLocaleString 会自动转换为本地时间
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    return new Date(str + 'Z')
  }

  return new Date(str)
}

/**
 * 格式化日期时间（使用校准后的时间）
 */
export function formatSyncedDateTime(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseLocalDate(date)

  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  })
}

/**
 * 格式化时间为 HH:mm（用于最近复习等场景）
 */
export function formatTimeOnly(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseLocalDate(date)

  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  })
}

/**
 * 格式化日期为 MM/dd（用于图表等场景）
 */
export function formatShortDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseLocalDate(date)

  return d.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    ...options,
  })
}
