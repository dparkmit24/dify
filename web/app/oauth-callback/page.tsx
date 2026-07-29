'use client'
import { useTranslation } from 'react-i18next'
import { useOAuthCallback } from '@/hooks/use-oauth'

const OAuthCallback = () => {
  const { t } = useTranslation()
  const hasOpener = useOAuthCallback()

  if (hasOpener) return <div />

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="system-md-regular text-text-secondary">
        {t(($) => $['callback.canCloseWindow'], { ns: 'oauth' })}
      </p>
    </div>
  )
}

export default OAuthCallback
