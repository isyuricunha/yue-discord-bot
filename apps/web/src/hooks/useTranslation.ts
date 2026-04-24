import { useMemo } from 'react'

// Simple i18n hook - can be replaced with react-i18next in the future
type Translations = {
  [key: string]: string | Translations
}

const translations: Record<string, Translations> = {
  'pt-BR': {
    login: {
      title: 'Yue Bot',
      subtitle: 'Gerencie seu servidor com excelência',
      description: 'Faça login com sua conta Discord para gerenciar seus servidores de forma simples e eficiente.',
      servers: 'Servidores',
      users: 'Usuários',
      loginButton: 'Entrar com Discord',
      inviteButton: 'Convidar Bot',
      or: 'ou',
      termsNotice: 'Ao fazer login, você concorda com nossos {termsLink} e {privacyLink}.',
      terms: 'termos',
      privacy: 'política de privacidade'
    },
    errors: {
      statsLoadError: 'Não foi possível carregar estatísticas do bot',
      invalidResponse: 'Formato de resposta inválido',
      unknownError: 'Erro desconhecido',
      configIncomplete: 'Configuração do painel incompleta'
    },
    footer: {
      viewExtras: 'Ver Extras',
      faq: 'FAQ',
      placeholders: 'Placeholders',
      guides: 'Guias'
    }
  }
}

interface UseTranslationOptions {
  lang?: string
}

export function useTranslation(namespace: string = 'common', options: UseTranslationOptions = {}) {
  const { lang = 'pt-BR' } = options

  const t = useMemo(() => {
    return (key: string, interpolations: Record<string, string> = {}): string => {
      const translationMap = translations[lang]?.[namespace] as Translations | undefined

      if (!translationMap) {
        console.warn(`Missing translations for namespace: ${namespace}, key: ${key}, lang: ${lang}`)
        return key
      }

      const translation = translationMap[key] as string | undefined

      if (!translation) {
        console.warn(`Missing translation for key: ${key} in namespace: ${namespace}, lang: ${lang}`)
        return key
      }

      // Replace placeholders like {termsLink} with values from interpolations
      return Object.entries(interpolations).reduce((result, [placeholder, value]) => {
        return result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value)
      }, translation)
    }
  }, [lang, namespace])

  return { t, lang }
}