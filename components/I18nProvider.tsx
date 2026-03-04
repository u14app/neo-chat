'use client'
import { useLayoutEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { useSettingStore } from '@/store/setting'
import i18n from '@/utils/i18n'

function I18Provider({ children }: { children: React.ReactNode }) {
  const { lang } = useSettingStore()

  useLayoutEffect(() => {
    if (!lang) return
    i18n.changeLanguage(lang)
  }, [lang])
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

export default I18Provider
