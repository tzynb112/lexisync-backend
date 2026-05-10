'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { translations, type Language } from '@/lib/i18n'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'zh',
  setLanguage: () => {},
  t: () => '',
})

export function useLanguage() {
  return useContext(LanguageContext)
}

export function useT() {
  const { t } = useContext(LanguageContext)
  return t
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('lexisync_lang') as Language | null
    if (stored === 'zh' || stored === 'en') {
      setLanguageState(stored)
    } else {
      const browserLang = navigator.language.toLowerCase()
      setLanguageState(browserLang.startsWith('zh') ? 'zh' : 'en')
    }
    setMounted(true)
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('lexisync_lang', lang)
  }, [])

  const t = useCallback(
    (key: string) => {
      const keys = key.split('.')
      let value: any = translations[language]
      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k]
        } else {
          return key
        }
      }
      return typeof value === 'string' ? value : key
    },
    [language],
  )

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
