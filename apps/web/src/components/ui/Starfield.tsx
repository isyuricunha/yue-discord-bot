import { useEffect, useRef } from 'react'

import { cn } from '../../lib/cn'

/**
 * Ambient Starfield Depth background, ported from the YuTheme optional effect.
 *
 * Rendered on a decorative fixed canvas beneath app content. Motion is
 * frame-based (no fixed duration): 180 stars with per-star depth drive both
 * speed and size, and a translucent trail is kept between frames. Honors
 * `prefers-reduced-motion` by drawing a single static frame, resizes with the
 * viewport, and returns a dispose function. The consumer owns the layer.
 */
const STAR_COUNT = 180
const TRAIL_ALPHA = 0.72

type star = {
  x: number
  y: number
  z: number
  size: number
}

export function Starfield({ className }: { className?: string }) {
  const canvas_ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvas_ref.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let dpr = 1
    let frame = 0
    let disposed = false

    const stars: star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: 0,
      y: 0,
      z: 0.15 + Math.random() * 0.9,
      size: 1,
    }))

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Seed positions across the full surface.
      for (const star of stars) {
        star.x = Math.random() * width
        star.y = Math.random() * height
        star.size = (0.35 + star.z * 1.3) * 1
      }
      context.fillStyle = '#000000'
      context.fillRect(0, 0, width, height)
    }

    const draw = () => {
      // Translucent trail: previous frame fades instead of clearing hard.
      context.fillStyle = `rgba(0, 0, 0, ${TRAIL_ALPHA})`
      context.fillRect(0, 0, width, height)

      for (const star of stars) {
        star.y += (0.12 + star.z * 0.8) * star.size * 1
        if (star.y > height + 2) {
          star.y = -2
          star.x = Math.random() * width
        }

        const radius = (0.35 + star.z * 1.3) * 1
        const opacity = (0.1 + star.z * 0.4) * 1.3

        context.beginPath()
        context.arc(star.x, star.y, radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(196, 220, 216, ${opacity})`
        context.fill()
      }
    }

    const loop = () => {
      if (disposed) return
      draw()
      frame = requestAnimationFrame(loop)
    }

    resize()

    if (reduced_motion) {
      // Static frame: draw once so the layer is not empty, then stop.
      for (let i = 0; i < 3; i += 1) draw()
    } else {
      frame = requestAnimationFrame(loop)
    }

    const on_resize = () => {
      resize()
      if (reduced_motion) {
        for (let i = 0; i < 3; i += 1) draw()
      }
    }
    window.addEventListener('resize', on_resize)

    return () => {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', on_resize)
    }
  }, [])

  return (
    <canvas
      ref={canvas_ref}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  )
}
