'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Atom, Eye, EyeOff, Loader2 } from 'lucide-react'

import { useAuth } from '@/lib/auth'

function LoginForm() {
  const router = useRouter()
  const { login, register, isAuthenticated, loading: authLoading } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        await login(username, password)
      } else {
        await register(email, username, password)
      }
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <Atom className="w-8 h-8 text-accent-primary animate-spin" style={{ animationDuration: '3s' }} />
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <Atom className="w-8 h-8 text-accent-primary animate-spin" style={{ animationDuration: '3s' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                          bg-accent-primary/8 border border-accent-primary/15 mb-4 animate-glow-pulse">
            <Atom className="w-8 h-8 text-accent-primary" />
          </div>
          <h1 className="text-2xl font-bold text-surface-100 tracking-tight">TZYNB</h1>
          <p className="text-surface-400 text-xs mt-1 font-mono tracking-wider">
            AI驱动科学词汇学习
          </p>
        </div>

        <div className="card-sci rounded-2xl p-6">
          <div className="flex mb-6 bg-surface-900/80 rounded-lg p-1 border border-surface-700/30">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isLogin
                  ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/20'
                  : 'text-surface-400 hover:text-surface-200 border border-transparent'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isLogin
                  ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/20'
                  : 'text-surface-400 hover:text-surface-200 border border-transparent'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-[10px] font-medium text-surface-400 mb-1.5 font-mono uppercase tracking-wider">
                  邮箱
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-medium text-surface-400 mb-1.5 font-mono uppercase tracking-wider">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="your_username"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-surface-400 mb-1.5 font-mono uppercase tracking-wider">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400
                             hover:text-surface-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-accent-error/8 border border-accent-error/15 text-accent-error text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium text-sm
                         bg-accent-primary/15 text-accent-primary border border-accent-primary/25
                         hover:bg-accent-primary/25 hover:border-accent-primary/40
                         hover:shadow-[0_0_15px_rgba(0,229,191,0.15)]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? '处理中...' : isLogin ? '登录' : '创建账户'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <LoginForm />
}
