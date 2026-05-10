'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Atom } from 'lucide-react'

function HomeContent() {
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }
  }, [isAuthenticated, loading, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Atom className="w-14 h-14 text-accent-primary animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-0 w-14 h-14 rounded-full bg-accent-primary/10 animate-glow-pulse" />
        </div>
        <p className="text-surface-400 text-sm font-mono tracking-wider">TZYNB 加载中...</p>
      </div>
    </div>
  )
}

export default function Home() {
  return <HomeContent />
}
