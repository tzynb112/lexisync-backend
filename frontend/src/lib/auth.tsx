'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { api } from '@/lib/api'
import type { User } from '@/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('tzynb_token')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const userData = await api.auth.me() as User
      setUser(userData)
    } catch {
      localStorage.removeItem('tzynb_token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  useEffect(() => {
    if (loading) return
    const token = localStorage.getItem('tzynb_token')
    if (!token && pathname !== '/login') {
      router.push('/login')
    }
  }, [loading, pathname, router])

  const login = async (username: string, password: string) => {
    const res = (await api.auth.login(username, password)) as any
    localStorage.setItem('tzynb_token', res.access_token)
    setUser(res.user)
  }

  const register = async (email: string, username: string, password: string) => {
    const res = (await api.auth.register(email, username, password)) as any
    localStorage.setItem('tzynb_token', res.access_token)
    setUser(res.user)
  }

  const logout = () => {
    localStorage.removeItem('tzynb_token')
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
