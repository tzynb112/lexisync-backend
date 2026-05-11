const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tzynb_token') : null

  const isFormData = options.body instanceof FormData

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  }

  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    cache: 'no-store',
  })

  if (!res.ok) {
    let errorMessage = `请求失败，状态码 ${res.status}`
    if (res.status !== 204) {
      const errorData = await res.json().catch(() => ({}))
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((d: any) => {
            if (d.loc && Array.isArray(d.loc)) {
              const field = d.loc.join('.')
              return `${field}: ${d.msg || String(d)}`
            }
            return d.msg || String(d)
          }).join('\n')
        } else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail
        } else {
          errorMessage = JSON.stringify(errorData.detail)
        }
      }
    }
    throw new ApiError(errorMessage, res.status)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return res.json()
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),

    register: (email: string, username: string, password: string) =>
      request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      }),

    me: () => request('/api/auth/me'),
  },

  words: {
    list: (q?: string, page = 1, filters?: { part_of_speech?: string; tag_id?: string; category_id?: string; sort_by?: string; sort_order?: string }) => {
      const params = new URLSearchParams()
      params.set('q', q || '')
      params.set('page', String(page))
      params.set('page_size', '20')
      if (filters?.part_of_speech) params.set('part_of_speech', filters.part_of_speech)
      if (filters?.tag_id) params.set('tag_id', filters.tag_id)
      if (filters?.category_id) params.set('category_id', filters.category_id)
      if (filters?.sort_by) params.set('sort_by', filters.sort_by)
      if (filters?.sort_order) params.set('sort_order', filters.sort_order)
      return request(`/api/words?${params.toString()}`)
    },

    get: (id: string) => request(`/api/words/${id}`),

    getDetail: (id: string) => request(`/api/words/${id}/detail`),

    create: (data: { word: string; definition: string; phonetic?: string; part_of_speech?: string }) =>
      request('/api/words', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    importCsv: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request('/api/words/import/csv', {
        method: 'POST',
        body: formData,
      })
    },

    importJson: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request('/api/words/import/json', {
        method: 'POST',
        body: formData,
      })
    },

    batchStartLearning: (wordIds: string[]) =>
      request('/api/words/batch/start-learning', {
        method: 'POST',
        body: JSON.stringify({ word_ids: wordIds }),
      }),

    batchAddTag: (wordIds: string[], tagId: string) =>
      request('/api/words/batch/add-tag', {
        method: 'POST',
        body: JSON.stringify({ word_ids: wordIds, tag_id: tagId }),
      }),

    batchFavorite: (wordIds: string[]) =>
      request('/api/words/batch/favorite', {
        method: 'POST',
        body: JSON.stringify({ word_ids: wordIds }),
      }),

    delete: (wordId: string) =>
      request(`/api/words/${wordId}`, { method: 'DELETE' }),

    exportData: (format: 'json' | 'csv' = 'json') =>
      request(`/api/words/export/data?format=${format}`),

    search: (q: string, limit: number = 10) =>
      request(`/api/words/search?q=${encodeURIComponent(q)}&limit=${limit}`),

    wordOfTheDay: (tagId?: string) => {
      let url = '/api/words/word-of-the-day'
      if (tagId) url += `?tag_id=${tagId}`
      return request(url)
    },

    categories: () => request('/api/words/categories'),

    addToCategory: (wordId: string, categoryId: string) =>
      request(`/api/words/categories/link?word_id=${wordId}&category_id=${categoryId}`, {
        method: 'POST',
      }),

    categoryDetail: (categoryId: string, page = 1, pageSize = 20) =>
      request(`/api/words/categories/${categoryId}?page=${page}&page_size=${pageSize}`),
  },

  review: {
    due: (limit = 20, tagId?: string, categoryId?: string) => {
      let url = `/api/review/due?limit=${limit}`
      if (tagId) url += `&tag_id=${tagId}`
      if (categoryId) url += `&category_id=${categoryId}`
      return request(url)
    },

    feedback: (word_record_id: string, quality: number) =>
      request('/api/review/feedback', {
        method: 'POST',
        body: JSON.stringify({ word_record_id, quality }),
      }),

    testFeedback: (word_record_id: string, correct: boolean) =>
      request('/api/review/test-feedback', {
        method: 'POST',
        body: JSON.stringify({ word_record_id, correct }),
      }),

    start: (word_id: string) =>
      request(`/api/review/words/${word_id}/start`, {
        method: 'POST',
      }),

    stats: (tagId?: string, categoryId?: string) => {
      let url = '/api/review/stats'
      if (tagId) url += `?tag_id=${tagId}`
      if (categoryId) url += `${tagId ? '&' : '?'}category_id=${categoryId}`
      return request(url)
    },

    detailedStats: (days = 14, tagId?: string, categoryId?: string) => {
      let url = `/api/review/detailed-stats?days=${days}`
      if (tagId) url += `&tag_id=${tagId}`
      if (categoryId) url += `&category_id=${categoryId}`
      return request(url)
    },

    startAll: (tagId?: string, categoryId?: string) => {
      let url = '/api/review/start-all'
      const params: string[] = []
      if (tagId) params.push(`tag_id=${tagId}`)
      if (categoryId) params.push(`category_id=${categoryId}`)
      if (params.length) url += `?${params.join('&')}`
      return request(url, { method: 'POST' })
    },

    choiceTest: (limit = 10, tagId?: string, categoryId?: string) => {
      let url = `/api/review/choice-test?limit=${limit}`
      if (tagId) url += `&tag_id=${tagId}`
      if (categoryId) url += `&category_id=${categoryId}`
      return request(url)
    },

    spellingTest: (limit = 10, tagId?: string, categoryId?: string) => {
      let url = `/api/review/spelling-test?limit=${limit}`
      if (tagId) url += `&tag_id=${tagId}`
      if (categoryId) url += `&category_id=${categoryId}`
      return request(url)
    },

    wrongWords: (page = 1, pageSize = 20, tagId?: string, categoryId?: string) => {
      let url = `/api/review/wrong-words?page=${page}&page_size=${pageSize}`
      if (tagId) url += `&tag_id=${tagId}`
      if (categoryId) url += `&category_id=${categoryId}`
      return request(url)
    },

    getCalendar: (year: number, month: number) =>
      request(`/api/review/calendar?year=${year}&month=${month}`),
  },

  ai: {
    context: (word_id: string) =>
      request(`/api/ai/context/${word_id}`, {
        method: 'POST',
      }),

    contextByText: (word: string, definition: string) =>
      request('/api/ai/context', {
        method: 'POST',
        body: JSON.stringify({ word, definition }),
      }),

    getRecommendations: (limit: number = 5, tagId?: string) => {
      let url = `/api/ai/recommendations?limit=${limit}`
      if (tagId) url += `&tag_id=${tagId}`
      return request(url)
    },
  },

  tags: {
    list: () => request('/api/tags'),

    create: (data: { name: string; color?: string }) =>
      request('/api/tags', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (tagId: string, data: { name: string; color?: string }) =>
      request(`/api/tags/${tagId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (tagId: string) =>
      request(`/api/tags/${tagId}`, { method: 'DELETE' }),

    addWordTag: (wordId: string, tagId: string) =>
      request('/api/tags/word-tag', {
        method: 'POST',
        body: JSON.stringify({ word_id: wordId, tag_id: tagId }),
      }),

    removeWordTag: (wordId: string, tagId: string) =>
      request('/api/tags/word-tag', {
        method: 'DELETE',
        body: JSON.stringify({ word_id: wordId, tag_id: tagId }),
      }),

    toggleFavorite: (wordId: string) =>
      request('/api/tags/favorite', {
        method: 'POST',
        body: JSON.stringify({ word_id: wordId }),
      }),

    isFavorite: (wordId: string) =>
      request(`/api/tags/is-favorite/${wordId}`),

    listFavorites: () => request('/api/tags/favorites'),

    getSettings: () => request('/api/tags/settings'),

    updateSettings: (data: {
      daily_goal?: number
      preferred_study_mode?: string
      enable_sound?: boolean
      enable_ai_context?: boolean
      reminder_enabled?: boolean
      reminder_time?: string
      openai_api_key?: string
    }) =>
      request('/api/tags/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getStats: () => request('/api/tags/stats'),
  },

  achievements: {
    list: () => request('/api/achievements'),

    check: () =>
      request('/api/achievements/check', {
        method: 'POST',
      }),
  },

  wordNotes: {
    list: (wordId: string) => request(`/api/word-notes/${wordId}`),

    create: (wordId: string, content: string) =>
      request('/api/word-notes', {
        method: 'POST',
        body: JSON.stringify({ word_id: wordId, content }),
      }),

    update: (noteId: string, content: string) =>
      request(`/api/word-notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),

    delete: (noteId: string) =>
      request(`/api/word-notes/${noteId}`, {
        method: 'DELETE',
      }),
  },

  wordRelations: {
    list: (wordId: string) => request(`/api/word-relations/${wordId}`),

    create: (wordId: string, relatedWordId: string, relationType: string) =>
      request('/api/word-relations', {
        method: 'POST',
        body: JSON.stringify({ word_id: wordId, related_word_id: relatedWordId, relation_type: relationType }),
      }),

    delete: (relationId: string) =>
      request(`/api/word-relations/${relationId}`, {
        method: 'DELETE',
      }),
  },

  studyPlans: {
    getWeek: (startDate?: string) =>
      request(`/api/study-plans/week${startDate ? `?start_date=${startDate}` : ''}`),

    createOrUpdate: (planDate: string, targetWords: number, note?: string) =>
      request('/api/study-plans', {
        method: 'POST',
        body: JSON.stringify({ plan_date: planDate, target_words: targetWords, note }),
      }),
  },

  customPlans: {
    list: () => request('/api/custom-plans'),

    create: (data: {
      title: string
      description?: string
      tag_id?: string
      target_words: number
      start_date: string
      end_date: string
      daily_goal: number
    }) =>
      request('/api/custom-plans', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (planId: string, data: Partial<{
      title: string
      description: string
      tag_id: string
      target_words: number
      start_date: string
      end_date: string
      daily_goal: number
      is_active: boolean
    }>) =>
      request(`/api/custom-plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (planId: string) =>
      request(`/api/custom-plans/${planId}`, { method: 'DELETE' }),

    updateProgress: (planId: string) =>
      request(`/api/custom-plans/${planId}/progress`, { method: 'POST' }),
  },

  leaderboard: {
    get: (period: string = 'week', sortBy: string = 'reviews', tagId?: string, signal?: AbortSignal) => {
      let url = `/api/leaderboard?period=${period}&sort_by=${sortBy}`
      if (tagId) url += `&tag_id=${tagId}`
      return request(url, { signal })
    },
  },

  learningPaths: {
    list: (category?: string) =>
      request(`/api/learning-paths${category ? `?category=${category}` : ''}`),

    categories: () => request('/api/learning-paths/categories'),

    getDetail: (pathId: string) => request(`/api/learning-paths/${pathId}`),

    start: (pathId: string) =>
      request(`/api/learning-paths/${pathId}/start`, { method: 'POST' }),
  },
}

export { ApiError }
