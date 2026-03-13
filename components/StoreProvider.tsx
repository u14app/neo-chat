'use client'
import { useLayoutEffect } from 'react'
import { detectLanguage } from '@/utils/common'
import { useEnvStore } from '@/store/setting'

const NEXT_PUBLIC_BUILD_MODE = process.env.NEXT_PUBLIC_BUILD_MODE || 'default'

interface Props {
  children: React.ReactNode
}

function StoreProvider({ children }: Props) {
  useLayoutEffect(() => {
    const { update } = useEnvStore.getState()
    if (NEXT_PUBLIC_BUILD_MODE !== 'export') {
      fetch('/api/env')
        .then(async (response) => {
          if (!response.ok) throw new Error(`Failed to fetch env: ${response.status}`)
          const env = await response.json()
          update({ ...env, loaded: true })
        })
        .catch((error) => {
          console.error(error)
          update({ buildMode: NEXT_PUBLIC_BUILD_MODE, localeFromIp: 'en-US', loaded: true })
        })
      return
    }
    update({ buildMode: 'export', localeFromIp: detectLanguage(), loaded: true })
  }, [])

  return children
}

export default StoreProvider
