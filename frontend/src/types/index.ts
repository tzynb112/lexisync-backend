export interface User {
  id: string
  email: string
  username: string
  is_active: boolean
  created_at: string
}

export interface AuthTokens {
  access_token: string
  token_type: string
  user: User
}

export interface Word {
  id: string
  word: string
  phonetic: string | null
  definition: string
  part_of_speech: string | null
  etymology: string | null
  example_sentence: string | null
  sentence_cn?: string | null
  language: string
  created_at: string
  is_favorite?: boolean
  tags?: Tag[]
}

export interface WordRecord {
  id: string
  user_id: string
  word_id: string
  easiness_factor: number
  interval: number
  repetitions: number
  next_review_at: string
  total_reviews: number
  correct_count: number
  incorrect_count: number
}

export interface DueWord {
  word_record_id: string
  word: Word
  easiness_factor: number
  interval: number
  repetitions: number
  next_review_at: string
}

export interface ReviewFeedback {
  word_record_id: string
  quality: number
}

export interface ReviewFeedbackResponse {
  word_record_id: string
  word: Word
  interval: number
  easiness_factor: number
  repetitions: number
  next_review_at: string
}

export interface DashboardStats {
  due_today: number
  mastered_words: number
  total_words: number
  not_started: number
  total_reviews: number
  streak_days: number
  today_reviews: number
  heatmap_data: { date: string; count: number }[]
  daily_goal: number
  daily_goal_progress: number
}

export interface AIContext {
  domain_0_example: string
  domain_1_example: string
  domain_0_name: string
  domain_1_name: string
  domain_0_color: string
  domain_1_color: string
  translation: string
}

export interface HeatmapDay {
  date: string
  count: number
}

export interface Tag {
  id: string
  name: string
  color: string
  word_count: number
  created_at: string
  is_system?: boolean
}

export interface FavoriteWord {
  id: string
  word_id: string
  word: string
  phonetic: string | null
  definition: string
  part_of_speech: string | null
  created_at: string
}

export interface UserSettings {
  daily_goal: number
  preferred_study_mode: string
  enable_sound: boolean
  reminder_enabled: boolean
  reminder_time: string
  enable_ai_context?: boolean
  openai_api_key?: string | null
}

export interface ChoiceTestQuestion {
  word_record_id: string
  word: string
  phonetic: string | null
  correct_definition: string
  options: string[]
  example_sentence?: string | null
  sentence_cn?: string | null
}

export interface SpellingTestQuestion {
  word_record_id: string
  definition: string
  part_of_speech: string | null
  phonetic: string | null
  example_sentence: string | null
  sentence_cn?: string | null
  answer: string
}

export interface TestFeedback {
  word_record_id: string
  correct: boolean
}

export interface DetailedStats {
  accuracy_trend: { date: string; accuracy: number; total: number }[]
  mastery_distribution: {
    new_words: number
    learning: number
    familiar: number
    mastered: number
  }
  daily_goal_progress: {
    goal: number
    completed: number
    percentage: number
  }
  recent_reviews: { word: string; quality: number; reviewed_at: string }[]
}

export type StudyMode = 'flashcard' | 'choice' | 'spelling'

export interface PaginatedWordsResponse {
  words: Word[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface WordDetail {
  id: string
  word: string
  phonetic: string | null
  definition: string
  part_of_speech: string | null
  etymology: string | null
  example_sentence: string | null
  sentence_cn?: string | null
  language: string
  created_at: string
  tags: { id: string; name: string; color: string }[]
  is_favorited: boolean
  review_info: {
    easiness_factor: number
    interval: number
    repetitions: number
    next_review_at: string | null
    total_reviews: number
    correct_count: number
    incorrect_count: number
  } | null
  review_history: {
    quality: number
    interval_before: number
    interval_after: number
    easiness_factor_before: number
    easiness_factor_after: number
    reviewed_at: string | null
  }[]
}

export interface BatchOperationResult {
  success: number
  skipped: number
  failed: number
}

export interface WordCategory {
  id: string
  name: string
  description: string | null
  color: string
  icon: string | null
  word_count: number
}

export interface WordCategoryDetail extends WordCategory {
  words: Word[]
}

export interface Achievement {
  key: string
  name: string
  description: string
  icon: string
  tier: number
  unlocked: boolean
  unlocked_at: string | null
}

export interface WordFilterParams {
  part_of_speech?: string
  tag_id?: string
  sort_by?: 'word' | 'created_at'
  sort_order?: 'asc' | 'desc'
}

export interface WrongWord {
  word_record_id: string
  word_id: string
  word: string
  phonetic: string | null
  definition: string
  part_of_speech: string | null
  wrong_count: number
  last_wrong_at: string | null
  easiness_factor: number
  interval: number
  repetitions: number
  next_review_at: string | null
}

export interface WrongWordsResponse {
  items: WrongWord[]
  total: number
  page: number
  page_size: number
}

export interface WordNote {
  id: string
  word_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface WordRelation {
  id: string
  word_id: string
  related_word_id: string
  relation_type: 'synonym' | 'antonym' | 'related'
  related_word: string
  related_phonetic: string | null
  related_definition: string
  related_part_of_speech: string | null
}

export interface StudyPlan {
  id: string
  plan_date: string
  target_words: number
  completed_words: number
  note: string | null
  created_at: string
  updated_at: string
}

export interface CustomPlan {
  id: string
  title: string
  description: string | null
  tag_id: string | null
  tag_name: string | null
  target_words: number
  start_date: string
  end_date: string
  daily_goal: number
  completed_words: number
  is_active: boolean
  progress_percent: number
  created_at: string
  updated_at: string
}
