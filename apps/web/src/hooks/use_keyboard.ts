import { useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'

type shortcut_handler = (e: KeyboardEvent) => void

interface shortcut_map {
  [key: string]: shortcut_handler
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const { guildId } = useParams()
  const location = useLocation()

  const goBack = useCallback(() => {
    if (location.pathname !== '/') {
      navigate(-1)
    }
  }, [navigate, location.pathname])

  const goToDashboard = useCallback(() => {
    navigate('/')
  }, [navigate])

  const goToGuild = useCallback(() => {
    if (guildId) {
      navigate(`/guild/${guildId}`)
    }
  }, [navigate, guildId])

  useEffect(() => {
    const shortcuts: shortcut_map = {
      // Escape to go back (when not on input/textarea)
      Escape: (e) => {
        const target = e.target as HTMLElement
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        
        if (!isInput && location.pathname !== '/') {
          e.preventDefault()
          goBack()
        }
      },
      
      // g + d = go to dashboard
      'g+d': (e) => {
        if (location.pathname !== '/') {
          e.preventDefault()
          goToDashboard()
        }
      },
      
      // g + g = go to guild home (when in guild)
      'g+g': (e) => {
        if (guildId) {
          e.preventDefault()
          goToGuild()
        }
      },
    }

    let keyBuffer: string[] = []
    let bufferTimeout: ReturnType<typeof setTimeout> | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if meta/ctrl key is pressed (except for specific combos)
      if (e.metaKey || e.ctrlKey) return
      
      // Ignore if typing in input fields (except Escape)
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      
      if (isInput && e.key !== 'Escape') return

      // Handle single key shortcuts
      if (shortcuts[e.key] && !isInput) {
        shortcuts[e.key](e)
        return
      }

      // Handle chord shortcuts (g+d style)
      if (e.key.length === 1) {
        keyBuffer.push(e.key.toLowerCase())
        
        if (bufferTimeout) clearTimeout(bufferTimeout)
        bufferTimeout = setTimeout(() => {
          keyBuffer = []
        }, 1000)

        const chord = keyBuffer.slice(-2).join('+')
        if (shortcuts[chord]) {
          shortcuts[chord](e)
          keyBuffer = []
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (bufferTimeout) clearTimeout(bufferTimeout)
    }
  }, [goBack, goToDashboard, goToGuild, location.pathname, guildId])
}
