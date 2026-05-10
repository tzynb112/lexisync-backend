'use client'

import { useState } from 'react'

export default function DebugPage() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const testApi = async (endpoint: string) => {
    setLoading(true)
    setResult('Loading...')
    try {
      const token = localStorage.getItem('tzynb_token')
      setResult(`Token: ${token ? token.substring(0, 30) + '...' : 'NO TOKEN FOUND'}\n\nFetching: ${endpoint}\n\n`)

      const res = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const text = await res.text()
      setResult(prev => prev + `Status: ${res.status} ${res.statusText}\n\nBody: ${text.substring(0, 500)}`)
    } catch (err: any) {
      setResult(prev => prev + `Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testLogin = async () => {
    setLoading(true)
    setResult('Logging in...')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'tzynb', password: 'tzynb112' }),
      })
      const data = await res.json()
      if (data.access_token) {
        localStorage.setItem('tzynb_token', data.access_token)
        setResult(`Login OK! Token saved.\n\nToken: ${data.access_token.substring(0, 30)}...`)
      } else {
        setResult(`Login failed: ${JSON.stringify(data)}`)
      }
    } catch (err: any) {
      setResult(`Login error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#fff', background: '#1a1a2e', minHeight: '100vh' }}>
      <h1>API Debug Page</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={testLogin} disabled={loading} style={{ padding: '8px 16px', background: '#00e5bf', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          1. Login
        </button>
        <button onClick={() => testApi('/api/review/stats')} disabled={loading} style={{ padding: '8px 16px', background: '#00e5bf', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          2. Stats
        </button>
        <button onClick={() => testApi('/api/review/due?limit=3')} disabled={loading} style={{ padding: '8px 16px', background: '#00e5bf', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          3. Due Words
        </button>
        <button onClick={() => testApi('/api/words?page=1&page_size=3')} disabled={loading} style={{ padding: '8px 16px', background: '#00e5bf', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          4. Words List
        </button>
      </div>
      <pre style={{ background: '#0d0d1a', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', border: '1px solid #333' }}>
        {result || 'Click a button to test...'}
      </pre>
    </div>
  )
}
