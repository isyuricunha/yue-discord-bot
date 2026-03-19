import { useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { useLocation, useParams } from 'react-router-dom'

const base_url = 'https://yuebot.yuricunha.com'

type seo_payload = {
  title: string
  description: string
  indexable: boolean
}

function normalize_pathname(pathname: string) {
  if (!pathname) return '/'
  if (!pathname.startsWith('/')) return `/${pathname}`
  return pathname
}

function build_canonical(pathname: string) {
  const normalized = normalize_pathname(pathname)
  return `${base_url}${normalized}`
}

function resolve_payload(pathname: string, guild_id?: string): seo_payload {
  const normalized = normalize_pathname(pathname)

  if (normalized === '/' || normalized === '/moderation') {
    return {
      title: 'Yue Bot - Painel de Gerenciamento',
      description: 'Painel de gerenciamento do Yue Bot para configurar moderação, logs e recursos do seu servidor no Discord.',
      indexable: false,
    }
  }

  if (normalized === '/login') {
    return {
      title: 'Login - Yue Bot',
      description: 'Acesse o painel do Yue Bot para gerenciar seu servidor no Discord.',
      indexable: true,
    }
  }

  if (normalized.startsWith('/extras')) {
    if (normalized === '/extras') {
      return {
        title: 'Extras - Yue Bot',
        description: 'Páginas públicas com informações e recursos do Yue Bot.',
        indexable: true,
      }
    }

    if (normalized === '/extras/sobre') {
      return {
        title: 'Sobre - Yue Bot',
        description: 'Conheça o Yue Bot e seus recursos para servidores no Discord.',
        indexable: true,
      }
    }

    if (normalized === '/extras/moderacao') {
      return {
        title: 'Moderação - Yue Bot',
        description: 'Informações públicas sobre moderação e boas práticas para o Yue Bot.',
        indexable: true,
      }
    }

    if (normalized === '/extras/comandos') {
      return {
        title: 'Comandos - Yue Bot',
        description: 'Lista de comandos e exemplos de uso do Yue Bot.',
        indexable: true,
      }
    }

    if (normalized === '/extras/placeholders') {
      return {
        title: 'Placeholders - Yue Bot',
        description: 'Referência de placeholders para mensagens e templates do Yue Bot.',
        indexable: true,
      }
    }

    if (normalized === '/extras/apelo-de-ban') {
      return {
        title: 'Apelo de Ban - Yue Bot',
        description: 'Formulário e informações para apelo de ban.',
        indexable: true,
      }
    }

    return {
      title: 'Extras - Yue Bot',
      description: 'Páginas públicas com informações e recursos do Yue Bot.',
      indexable: true,
    }
  }

  if (normalized === '/termos') {
    return {
      title: 'Termos - Yue Bot',
      description: 'Termos de uso do Yue Bot.',
      indexable: true,
    }
  }

  if (normalized === '/privacidade') {
    return {
      title: 'Privacidade - Yue Bot',
      description: 'Política de privacidade do Yue Bot.',
      indexable: true,
    }
  }

  if (normalized.startsWith('/guild/')) {
    const suffix = guild_id ? ` (${guild_id})` : ''
    return {
      title: `Painel da Guild${suffix} - Yue Bot`,
      description: 'Área autenticada do painel do Yue Bot para configurar recursos do servidor.',
      indexable: false,
    }
  }

  if (normalized === '/owner' || normalized.startsWith('/owner/')) {
    return {
      title: 'Owner - Yue Bot',
      description: 'Área administrativa do Yue Bot.',
      indexable: false,
    }
  }

  return {
    title: 'Yue Bot',
    description: 'Painel de gerenciamento do Yue Bot para servidores no Discord.',
    indexable: true,
  }
}

export function Seo() {
  const location = useLocation()
  const { guildId } = useParams()

  const payload = useMemo(() => resolve_payload(location.pathname, guildId), [location.pathname, guildId])
  const canonical = useMemo(() => build_canonical(location.pathname), [location.pathname])

  const robots = payload.indexable ? 'index,follow' : 'noindex,nofollow'

  return (
    <Helmet>
      <title>{payload.title}</title>
      <meta name="description" content={payload.description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonical} />

      <meta property="og:title" content={payload.title} />
      <meta property="og:description" content={payload.description} />
      <meta property="og:url" content={canonical} />

      <meta name="twitter:title" content={payload.title} />
      <meta name="twitter:description" content={payload.description} />
    </Helmet>
  )
}
