'use client'

import { useRef, useCallback, useState } from 'react'
import { Share2, Download, Loader2, Check } from 'lucide-react'

interface ShareCardProps {
  word: string
  phonetic?: string | null
  definition: string
  partOfSpeech?: string | null
  exampleSentence?: string | null
}

export function ShareCard({ word, phonetic, definition, partOfSpeech, exampleSentence }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateCard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 600
    canvas.height = 400

    const gradient = ctx.createLinearGradient(0, 0, 600, 400)
    gradient.addColorStop(0, '#0a0e1a')
    gradient.addColorStop(1, '#141e33')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 600, 400)

    ctx.strokeStyle = 'rgba(0, 229, 191, 0.15)'
    ctx.lineWidth = 1
    ctx.strokeRect(20, 20, 560, 360)

    ctx.fillStyle = 'rgba(0, 229, 191, 0.08)'
    ctx.fillRect(20, 20, 560, 360)

    ctx.fillStyle = '#00e5bf'
    ctx.font = 'bold 36px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(word, 300, 120)

    if (phonetic) {
      ctx.fillStyle = '#64748b'
      ctx.font = '16px "JetBrains Mono", monospace'
      ctx.fillText(`/${phonetic}/`, 300, 155)
    }

    if (partOfSpeech) {
      ctx.fillStyle = '#8b5cf6'
      ctx.font = '12px sans-serif'
      const posX = 300
      const posY = 180
      const posWidth = ctx.measureText(partOfSpeech).width + 16
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)'
      ctx.beginPath()
      ctx.roundRect(posX - posWidth / 2, posY - 10, posWidth, 22, 11)
      ctx.fill()
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)'
      ctx.stroke()
      ctx.fillStyle = '#8b5cf6'
      ctx.fillText(partOfSpeech, posX, posY + 6)
    }

    ctx.fillStyle = '#cbd5e1'
    ctx.font = '15px sans-serif'
    ctx.textAlign = 'center'
    const defLines = wrapText(ctx, definition, 480)
    defLines.forEach((line, i) => {
      ctx.fillText(line, 300, 230 + i * 22)
    })

    if (exampleSentence) {
      const exY = 230 + defLines.length * 22 + 20
      ctx.fillStyle = '#64748b'
      ctx.font = 'italic 13px sans-serif'
      const exLines = wrapText(ctx, `"${exampleSentence}"`, 480)
      exLines.forEach((line, i) => {
        ctx.fillText(line, 300, exY + i * 18)
      })
    }

    ctx.fillStyle = '#334155'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('LexiSync · AI-Powered Vocabulary', 300, 370)
  }, [word, phonetic, definition, partOfSpeech, exampleSentence])

  const handleDownload = useCallback(() => {
    setGenerating(true)
    setTimeout(() => {
      generateCard()
      const canvas = canvasRef.current
      if (!canvas) {
        setGenerating(false)
        return
      }
      const link = document.createElement('a')
      link.download = `lexisync-${word}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      setGenerating(false)
    }, 100)
  }, [generateCard, word])

  const handleCopy = useCallback(async () => {
    setGenerating(true)
    setTimeout(async () => {
      generateCard()
      const canvas = canvasRef.current
      if (!canvas) {
        setGenerating(false)
        return
      }
      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png')
        )
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ])
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }
      } catch {} finally {
        setGenerating(false)
      }
    }, 100)
  }, [generateCard])

  return (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={handleDownload}
        disabled={generating}
        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium w-full sm:w-auto
                   bg-surface-700/40 text-surface-300 hover:text-accent-primary hover:bg-accent-primary/10
                   border border-surface-600/30 hover:border-accent-primary/30 transition-colors"
      >
        {generating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        下载卡片
      </button>
      <button
        onClick={handleCopy}
        disabled={generating}
        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium w-full sm:w-auto
                   bg-surface-700/40 text-surface-300 hover:text-accent-secondary hover:bg-accent-secondary/10
                   border border-surface-600/30 hover:border-accent-secondary/30 transition-colors"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-accent-primary" />
        ) : generating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Share2 className="w-3.5 h-3.5" />
        )}
        {copied ? '已复制' : '复制分享'}
      </button>
    </div>
  )
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const char of text) {
    const test = current + char
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current)
      current = char
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}
