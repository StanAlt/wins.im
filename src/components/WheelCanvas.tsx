'use client'

import { useRef, useEffect, useCallback } from 'react'
import { THEME_PALETTES, type WheelTheme } from '@/lib/constants'

interface WheelCanvasProps {
  names: string[]
  size?: number
  rotation?: number
  spinning?: boolean
  theme?: WheelTheme
}

export default function WheelCanvas({ names, size = 400, rotation = 0, spinning = false, theme = 'default' }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const palette = THEME_PALETTES[theme] || THEME_PALETTES.default

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 12

    // Clear
    ctx.clearRect(0, 0, size, size)

    if (names.length === 0) {
      // Empty wheel
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = palette.emptyBg
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = `500 ${size * 0.04}px Satoshi, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Add participants to begin', cx, cy)
      return
    }

    const sliceAngle = (Math.PI * 2) / names.length
    const rotRad = (rotation * Math.PI) / 180

    // Draw slices
    names.forEach((name, i) => {
      const startAngle = i * sliceAngle + rotRad - Math.PI / 2
      const endAngle = startAngle + sliceAngle

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radius, startAngle, endAngle)
      ctx.closePath()

      const colorIndex = i % palette.sliceColors.length
      ctx.fillStyle = palette.sliceColors[colorIndex]
      ctx.fill()

      // Slice border
      ctx.strokeStyle = theme === 'minimal' ? 'rgba(100,116,139,0.2)' : 'rgba(0,0,0,0.15)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Draw name
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(startAngle + sliceAngle / 2)

      const isBright = palette.brightSlices.has(colorIndex)
      ctx.fillStyle = isBright ? (theme === 'minimal' ? '#1E293B' : '#0A1628') : '#F8FAFB'

      const fontSize = Math.min(size * 0.035, 14)
      ctx.font = `600 ${fontSize}px "Clash Display", sans-serif`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'

      const maxTextWidth = radius * 0.55
      let displayName = name
      while (ctx.measureText(displayName).width > maxTextWidth && displayName.length > 2) {
        displayName = displayName.slice(0, -1)
      }
      if (displayName !== name) displayName += '..'

      ctx.fillText(displayName, radius * 0.85, 0)
      ctx.restore()
    })

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = palette.outerRing
    ctx.lineWidth = 6
    ctx.stroke()

    // Inner ring glow
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2)
    const glowAlpha = theme === 'neon' ? '0.5' : '0.3'
    ctx.strokeStyle = palette.outerRing.replace(')', `, ${glowAlpha})`).replace('#', 'rgba(')
    // Simpler approach: use the glow color from palette
    ctx.strokeStyle = palette.glowColor
    ctx.lineWidth = 2
    ctx.stroke()

    // Center hub
    const hubRadius = size * 0.08
    ctx.beginPath()
    ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2)
    const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, hubRadius)
    hubGrad.addColorStop(0, palette.hubGradient[0])
    hubGrad.addColorStop(1, palette.hubGradient[1])
    ctx.fillStyle = hubGrad
    ctx.fill()
    ctx.strokeStyle = palette.hubStroke
    ctx.lineWidth = 3
    ctx.stroke()

    // Center "W"
    ctx.fillStyle = palette.hubText
    ctx.font = `700 ${hubRadius * 1.1}px "Clash Display", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('W', cx, cy + 1)

    // Pointer arrow at top
    const pointerSize = size * 0.04
    ctx.beginPath()
    ctx.moveTo(cx, 4)
    ctx.lineTo(cx - pointerSize, -2)
    ctx.lineTo(cx + pointerSize, -2)
    ctx.closePath()
    ctx.fillStyle = palette.pointerColor
    ctx.fill()

    // Pointer body
    ctx.beginPath()
    ctx.moveTo(cx, 0)
    ctx.lineTo(cx - pointerSize * 0.6, -pointerSize * 1.2)
    ctx.lineTo(cx + pointerSize * 0.6, -pointerSize * 1.2)
    ctx.closePath()
    ctx.fillStyle = palette.pointerColor
    ctx.fill()
  }, [names, size, rotation, theme])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={spinning ? 'animate-pulse-glow rounded-full' : 'rounded-full'}
      />
    </div>
  )
}
