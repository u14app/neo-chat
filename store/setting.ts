import { create } from 'zustand'
import { persist, type StorageValue } from 'zustand/middleware'
import { DefaultModel } from '@/constant/model'

type DefaultSetting = Omit<Setting, 'isProtected' | 'talkMode' | 'sidebarState'>

interface SettingStore extends Setting {
  update: (values: Partial<Setting>) => void
  reset: () => DefaultSetting
}

interface EnvStore {
  modelList: string
  uploadLimit: number
  buildMode: string
  isProtected: boolean
  countryCode: string
  localeFromIp: string
  loaded: boolean
  update: (values: Partial<Omit<EnvStore, 'update'>>) => void
}

const defaultSetting: DefaultSetting = {
  password: '',
  apiKey: '',
  apiProxy: '',
  model: DefaultModel,
  sttLang: '',
  ttsLang: '',
  ttsVoice: '',
  lang: '',
  maxHistoryLength: 0,
  assistantIndexUrl: '',
  topP: 0.95,
  topK: 40,
  temperature: 1,
  maxOutputTokens: 8192,
  safety: 'none',
  autoStartRecord: false,
  autoStopRecord: false,
}

export const useSettingStore = create(
  persist<SettingStore>(
    (set) => ({
      ...defaultSetting,
      talkMode: 'chat',
      sidebarState: 'collapsed',
      update: (values) => set((state) => ({ ...state, ...values })),
      reset: () => {
        set(defaultSetting)
        return defaultSetting
      },
    }),
    {
      name: 'twg-settings',
      version: 1,
      storage: {
        getItem: (key: string) => {
          const value = localStorage.getItem(key)
          return value ? JSON.parse(value) : null
        },
        setItem: (key: string, value: StorageValue<SettingStore>) => {
          const { update, reset, ...stateToSave } = value.state
          localStorage.setItem(
            key,
            JSON.stringify({
              state: stateToSave,
              version: value.version,
            }),
          )
        },
        removeItem: (key: string) => localStorage.removeItem(key),
      },
    },
  ),
)

export const useEnvStore = create<EnvStore>((set) => ({
  modelList: '',
  uploadLimit: 0,
  buildMode: '',
  isProtected: true,
  countryCode: '',
  localeFromIp: 'en-US',
  loaded: false,
  update: (values) => set((state) => ({ ...state, ...values })),
}))
